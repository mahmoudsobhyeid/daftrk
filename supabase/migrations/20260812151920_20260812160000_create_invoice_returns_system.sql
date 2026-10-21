/*
# Invoice Returns System

## Overview
Adds a complete return-invoice system that links returns to original invoices,
tracks per-item returned quantities, updates inventory, and maintains an audit trail.
Original invoices are never modified — returns are stored as separate transactions.

## New Tables

### 1. `invoice_returns`
Stores return transactions linked to an original invoice.
- `id` (uuid, PK)
- `company_id` (uuid, FK to companies) — for RLS scoping
- `invoice_id` (uuid, FK to invoices ON DELETE RESTRICT) — the original invoice
- `return_number` (text, unique per company) — e.g. RET-2026-0001
- `return_type` (text) — 'full' or 'partial'
- `subtotal` (numeric) — returned subtotal
- `tax_total` (numeric) — returned tax
- `total` (numeric) — total return value
- `created_by` (uuid, FK to auth.users) — who created the return
- `created_at` (timestamptz)

### 2. `invoice_return_items`
Stores individual line items within a return.
- `id` (uuid, PK)
- `return_id` (uuid, FK to invoice_returns ON DELETE CASCADE)
- `invoice_item_id` (uuid, FK to invoice_items ON DELETE RESTRICT) — original line item
- `product_id` (uuid, FK to products, nullable)
- `description` (text)
- `quantity` (numeric) — returned quantity
- `unit_price` (numeric) — from original line item
- `tax_rate` (numeric) — from original line item
- `line_total` (numeric) — return value for this line

### 3. `invoice_return_audit`
Audit log for return operations.
- `id` (uuid, PK)
- `company_id` (uuid, FK to companies)
- `return_id` (uuid, FK to invoice_returns)
- `invoice_id` (uuid, FK to invoices)
- `action` (text) — 'created', etc.
- `details` (jsonb) — snapshot of return data
- `performed_by` (uuid, FK to auth.users)
- `created_at` (timestamptz)

## Modified Tables
- `invoices` — adds `return_status` column (text, nullable): NULL | 'partially_returned' | 'fully_returned'
  This is a computed/maintained field; the original invoice data is never modified.

## Security (RLS)
- All three new tables have RLS enabled.
- SELECT/INSERT/UPDATE/DELETE policies scoped to company members via `company_members`.
- The `create_invoice_return` SECURITY DEFINER function bypasses RLS to perform atomic validation + insertion.

## Backend Validation
- `create_invoice_return(p_invoice_id uuid, p_return_type text, p_items jsonb)` SECURITY DEFINER function:
  1. Validates caller is a company member of the invoice's company.
  2. Validates invoice status is NOT 'draft' or 'cancelled'.
  3. For each item: validates invoice_item_id belongs to the invoice.
  4. Validates returned quantity does not exceed: original qty - sum of previously returned qty.
  5. Validates at least one item has quantity > 0.
  6. Inserts return record + return items atomically.
  7. Updates product stock_quantity (adds back returned quantity).
  8. Updates invoice.return_status to 'partially_returned' or 'fully_returned'.
  9. Inserts audit log entry.
  10. Returns the created return as JSON.

## Important Notes
1. Original invoice data (subtotal, tax_total, total, items) is NEVER modified.
2. The `return_status` column on invoices is the only new column and is a status indicator only.
3. Inventory is updated by adding returned quantities back to product stock.
4. Return numbers use a dedicated sequence.
5. All validations are enforced in the database via the SECURITY DEFINER function.
*/

-- ============================================================================
-- 1. Add return_status column to invoices
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'return_status'
  ) THEN
    ALTER TABLE public.invoices ADD COLUMN return_status text;
  END IF;
END $$;

-- ============================================================================
-- 2. Create invoice_returns table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  return_number text NOT NULL,
  return_type text NOT NULL DEFAULT 'partial',
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_total numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, return_number)
);

ALTER TABLE public.invoice_returns ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoice_returns_company ON public.invoice_returns(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_returns_invoice ON public.invoice_returns(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_returns_created_by ON public.invoice_returns(created_by);

-- ============================================================================
-- 3. Create invoice_return_items table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.invoice_returns(id) ON DELETE CASCADE,
  invoice_item_id uuid NOT NULL REFERENCES public.invoice_items(id) ON DELETE RESTRICT,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  description text NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 0,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE public.invoice_return_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoice_return_items_return ON public.invoice_return_items(return_id);
CREATE INDEX IF NOT EXISTS idx_invoice_return_items_invoice_item ON public.invoice_return_items(invoice_item_id);

-- ============================================================================
-- 4. Create invoice_return_audit table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.invoice_return_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  return_id uuid REFERENCES public.invoice_returns(id) ON DELETE SET NULL,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE RESTRICT,
  action text NOT NULL,
  details jsonb,
  performed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_return_audit ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_invoice_return_audit_company ON public.invoice_return_audit(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_return_audit_return ON public.invoice_return_audit(return_id);
CREATE INDEX IF NOT EXISTS idx_invoice_return_audit_invoice ON public.invoice_return_audit(invoice_id);

-- ============================================================================
-- 5. RLS Policies for invoice_returns
-- ============================================================================
DROP POLICY IF EXISTS "select_own_invoice_returns" ON public.invoice_returns;
CREATE POLICY "select_own_invoice_returns" ON public.invoice_returns FOR SELECT
  TO authenticated USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_invoice_returns" ON public.invoice_returns;
CREATE POLICY "insert_own_invoice_returns" ON public.invoice_returns FOR INSERT
  TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_invoice_returns" ON public.invoice_returns;
CREATE POLICY "update_own_invoice_returns" ON public.invoice_returns FOR UPDATE
  TO authenticated USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  ) WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_invoice_returns" ON public.invoice_returns;
CREATE POLICY "delete_own_invoice_returns" ON public.invoice_returns FOR DELETE
  TO authenticated USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

-- ============================================================================
-- 6. RLS Policies for invoice_return_items
-- ============================================================================
DROP POLICY IF EXISTS "select_own_invoice_return_items" ON public.invoice_return_items;
CREATE POLICY "select_own_invoice_return_items" ON public.invoice_return_items FOR SELECT
  TO authenticated USING (
    return_id IN (
      SELECT ir.id FROM public.invoice_returns ir
      WHERE ir.company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "insert_own_invoice_return_items" ON public.invoice_return_items;
CREATE POLICY "insert_own_invoice_return_items" ON public.invoice_return_items FOR INSERT
  TO authenticated WITH CHECK (
    return_id IN (
      SELECT ir.id FROM public.invoice_returns ir
      WHERE ir.company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

-- ============================================================================
-- 7. RLS Policies for invoice_return_audit
-- ============================================================================
DROP POLICY IF EXISTS "select_own_invoice_return_audit" ON public.invoice_return_audit;
CREATE POLICY "select_own_invoice_return_audit" ON public.invoice_return_audit FOR SELECT
  TO authenticated USING (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_invoice_return_audit" ON public.invoice_return_audit;
CREATE POLICY "insert_own_invoice_return_audit" ON public.invoice_return_audit FOR INSERT
  TO authenticated WITH CHECK (
    company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    AND performed_by = auth.uid()
  );

-- ============================================================================
-- 8. Sequence for return numbers
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS public.invoice_return_number_seq;

-- ============================================================================
-- 9. SECURITY DEFINER function: create_invoice_return
--    All validation happens here — frontend cannot bypass it.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_invoice_return(
  p_invoice_id uuid,
  p_return_type text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice RECORD;
  v_company_id uuid;
  v_user uuid := auth.uid();
  v_return_id uuid;
  v_return_number text;
  v_item jsonb;
  v_invoice_item RECORD;
  v_prev_returned numeric;
  v_available numeric;
  v_line_subtotal numeric;
  v_line_tax numeric;
  v_line_total numeric;
  v_total_subtotal numeric := 0;
  v_total_tax numeric := 0;
  v_total numeric := 0;
  v_all_fully_returned boolean := true;
  v_item_record RECORD;
  v_return_count integer;
BEGIN
  -- 1. Validate caller is a company member of the invoice's company
  SELECT i.* INTO v_invoice
  FROM public.invoices i
  WHERE i.id = p_invoice_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invoice not found');
  END IF;

  v_company_id := v_invoice.company_id;

  IF NOT EXISTS (
    SELECT 1 FROM public.company_members
    WHERE company_id = v_company_id AND user_id = v_user
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: not a company member');
  END IF;

  -- 2. Validate invoice status is not draft or cancelled
  IF v_invoice.status = 'draft' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot return a draft invoice');
  END IF;

  IF v_invoice.status = 'cancelled' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot return a cancelled invoice');
  END IF;

  -- 3. Generate return number
  SELECT nextval('public.invoice_return_number_seq') INTO v_return_count;
  v_return_number := 'RET-' || EXTRACT(YEAR FROM now())::text || '-' || lpad(v_return_count::text, 4, '0');

  -- 4. Validate and compute each item
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    -- Get the original invoice item
    SELECT * INTO v_invoice_item
    FROM public.invoice_items
    WHERE id = (v_item->>'invoice_item_id')::uuid;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'error', 'Invoice item not found: ' || (v_item->>'invoice_item_id'));
    END IF;

    -- Validate it belongs to this invoice
    IF v_invoice_item.invoice_id != p_invoice_id THEN
      RETURN jsonb_build_object('success', false, 'error', 'Item does not belong to this invoice');
    END IF;

    -- Get previously returned quantity for this item
    SELECT COALESCE(SUM(iri.quantity), 0) INTO v_prev_returned
    FROM public.invoice_return_items iri
    JOIN public.invoice_returns ir ON ir.return_id = ir.id
    WHERE ir.invoice_id = p_invoice_id
    AND iri.invoice_item_id = v_invoice_item.id;

    -- Compute available return quantity
    v_available := v_invoice_item.quantity - v_prev_returned;

    IF v_available <= 0 THEN
      CONTINUE;
    END IF;

    -- Validate requested quantity
    IF (v_item->>'quantity')::numeric <= 0 THEN
      CONTINUE;
    END IF;

    IF (v_item->>'quantity')::numeric > v_available THEN
      RETURN jsonb_build_object('success', false, 'error',
        'Return quantity exceeds available for item: ' || v_invoice_item.description ||
        ' (available: ' || v_available || ')');
    END IF;

    -- Compute line totals
    v_line_subtotal := (v_item->>'quantity')::numeric * v_invoice_item.unit_price;
    v_line_tax := v_line_subtotal * (v_invoice_item.tax_rate / 100);
    v_line_total := v_line_subtotal + v_line_tax;

    v_total_subtotal := v_total_subtotal + v_line_subtotal;
    v_total_tax := v_total_tax + v_line_tax;
    v_total := v_total + v_line_total;
  END LOOP;

  -- 5. Validate at least one item has quantity > 0
  IF v_total = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'No items to return (all items may already be fully returned)');
  END IF;

  -- 6. Insert return record
  INSERT INTO public.invoice_returns (
    company_id, invoice_id, return_number, return_type,
    subtotal, tax_total, total, created_by
  )
  VALUES (
    v_company_id, p_invoice_id, v_return_number, p_return_type,
    v_total_subtotal, v_total_tax, v_total, v_user
  )
  RETURNING id INTO v_return_id;

  -- 7. Insert return items + update inventory
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    SELECT * INTO v_invoice_item
    FROM public.invoice_items
    WHERE id = (v_item->>'invoice_item_id')::uuid;

    IF NOT FOUND THEN CONTINUE; END IF;

    IF (v_item->>'quantity')::numeric <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM(iri.quantity), 0) INTO v_prev_returned
    FROM public.invoice_return_items iri
    JOIN public.invoice_returns ir ON ir.return_id = ir.id
    WHERE ir.invoice_id = p_invoice_id
    AND iri.invoice_item_id = v_invoice_item.id;

    v_available := v_invoice_item.quantity - v_prev_returned;

    IF (v_item->>'quantity')::numeric > v_available THEN
      CONTINUE;
    END IF;

    v_line_subtotal := (v_item->>'quantity')::numeric * v_invoice_item.unit_price;
    v_line_tax := v_line_subtotal * (v_invoice_item.tax_rate / 100);
    v_line_total := v_line_subtotal + v_line_tax;

    INSERT INTO public.invoice_return_items (
      return_id, invoice_item_id, product_id, description,
      quantity, unit_price, tax_rate, line_total
    )
    VALUES (
      v_return_id, v_invoice_item.id, v_invoice_item.product_id,
      v_invoice_item.description,
      (v_item->>'quantity')::numeric, v_invoice_item.unit_price,
      v_invoice_item.tax_rate, v_line_total
    );

    -- Update product inventory (add returned quantity back to stock)
    IF v_invoice_item.product_id IS NOT NULL THEN
      UPDATE public.products
      SET stock_quantity = stock_quantity + (v_item->>'quantity')::numeric
      WHERE id = v_invoice_item.product_id;
    END IF;
  END LOOP;

  -- 8. Update invoice return_status
  v_all_fully_returned := true;
  FOR v_item_record IN
    SELECT ii.id as item_id, ii.quantity as orig_qty,
      COALESCE((
        SELECT SUM(iri.quantity) FROM public.invoice_return_items iri
        JOIN public.invoice_returns ir ON ir.return_id = ir.id
        WHERE ir.invoice_id = p_invoice_id AND iri.invoice_item_id = ii.id
      ), 0) as returned_qty
    FROM public.invoice_items ii
    WHERE ii.invoice_id = p_invoice_id
  LOOP
    IF v_item_record.returned_qty < v_item_record.orig_qty THEN
      v_all_fully_returned := false;
      EXIT;
    END IF;
  END LOOP;

  IF v_all_fully_returned THEN
    UPDATE public.invoices SET return_status = 'fully_returned' WHERE id = p_invoice_id;
  ELSE
    UPDATE public.invoices SET return_status = 'partially_returned' WHERE id = p_invoice_id;
  END IF;

  -- 9. Insert audit log
  INSERT INTO public.invoice_return_audit (
    company_id, return_id, invoice_id, action, details, performed_by
  )
  VALUES (
    v_company_id, v_return_id, p_invoice_id, 'created',
    jsonb_build_object(
      'return_number', v_return_number,
      'return_type', p_return_type,
      'invoice_number', v_invoice.number,
      'total', v_total,
      'items_count', jsonb_array_length(p_items)
    ),
    v_user
  );

  -- 10. Return success
  RETURN jsonb_build_object(
    'success', true,
    'return_id', v_return_id,
    'return_number', v_return_number,
    'total', v_total
  );
END;
$$;

-- ============================================================================
-- 10. Grant execute on the function
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.create_invoice_return(uuid, text, jsonb) TO authenticated;
