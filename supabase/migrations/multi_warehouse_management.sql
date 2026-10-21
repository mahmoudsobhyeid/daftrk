/*
# Multi-Warehouse Management System

Brings the remote database in line with the multi-warehouse inventory design:

1. `warehouses` - multiple warehouse/locations per company
2. `warehouse_inventory` restructured to one row per product *per warehouse*
3. `stock_movements` - detailed audit trail (cardex) of every stock change
4. `stock_transfers` + `stock_transfer_lines` - warehouse-to-warehouse transfers
5. RPC helpers: `generate_transfer_number`, `record_stock_movement`,
   `process_stock_transfer_dispatch`, `process_stock_transfer_receive`

Idempotent: safe to run multiple times.
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Warehouses
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  name text NOT NULL,
  code text,
  location text,
  address text,
  city text,
  district text,
  postal_code text,
  country text DEFAULT 'Saudi Arabia',

  warehouse_type text NOT NULL DEFAULT 'main'
    CHECK (warehouse_type IN ('main', 'branch', 'transit', 'store', 'virtual')),

  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,

  capacity_units integer,
  capacity_volume numeric,
  notes text,

  manager_name text,
  manager_phone text,
  manager_email text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One code per company (code stays optional so warehouses can be created without one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'warehouses' AND constraint_name = 'warehouses_company_id_code_key'
  ) THEN
    ALTER TABLE public.warehouses ADD CONSTRAINT warehouses_company_id_code_key UNIQUE (company_id, code);
  END IF;
END $$;

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_read_warehouses" ON public.warehouses;
CREATE POLICY "company_members_read_warehouses" ON public.warehouses
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_warehouses" ON public.warehouses;
CREATE POLICY "company_members_write_warehouses" ON public.warehouses
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON public.warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active ON public.warehouses(company_id, is_active);

-- Hard limit: a company may have at most 10 warehouses.
CREATE OR REPLACE FUNCTION public.enforce_max_warehouses()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count
  FROM public.warehouses
  WHERE company_id = NEW.company_id;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'A company can have at most 10 warehouses';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_max_warehouses ON public.warehouses;
CREATE TRIGGER trg_enforce_max_warehouses
  BEFORE INSERT ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.enforce_max_warehouses();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. warehouse_inventory → per product / per warehouse
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS warehouse_id uuid;
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS average_cost numeric(18,4) DEFAULT 0;
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS last_costed_at timestamptz;
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS batch_number text;
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS lot_number text;
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS expiry_date date;
ALTER TABLE public.warehouse_inventory ADD COLUMN IF NOT EXISTS manufacturing_date date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'warehouse_inventory' AND constraint_name = 'warehouse_inventory_warehouse_id_fkey'
  ) THEN
    ALTER TABLE public.warehouse_inventory
      ADD CONSTRAINT warehouse_inventory_warehouse_id_fkey
      FOREIGN KEY (warehouse_id) REFERENCES public.warehouses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Replace the old one-row-per-product constraint with one-row-per-product-per-warehouse
ALTER TABLE public.warehouse_inventory DROP CONSTRAINT IF EXISTS warehouse_inventory_company_id_product_id_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'warehouse_inventory' AND constraint_name = 'warehouse_inventory_company_product_warehouse_unique'
  ) THEN
    ALTER TABLE public.warehouse_inventory
      ADD CONSTRAINT warehouse_inventory_company_product_warehouse_unique
      UNIQUE (company_id, product_id, warehouse_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_warehouse_id ON public.warehouse_inventory(warehouse_id);

-- Backfill: every company gets a default warehouse, and any inventory row that
-- predates multi-warehouse support is attached to it.
DO $$
DECLARE
  v_company RECORD;
  v_warehouse_id uuid;
BEGIN
  FOR v_company IN
    SELECT DISTINCT company_id FROM public.warehouse_inventory
    UNION
    SELECT DISTINCT company_id FROM public.products
  LOOP
    SELECT id INTO v_warehouse_id
    FROM public.warehouses
    WHERE company_id = v_company.company_id
    ORDER BY is_default DESC, created_at ASC
    LIMIT 1;

    IF v_warehouse_id IS NULL THEN
      INSERT INTO public.warehouses (company_id, name, code, location, is_active, is_default)
      VALUES (v_company.company_id, 'Main Warehouse', 'WH-01', 'Head Office', true, true)
      RETURNING id INTO v_warehouse_id;
    END IF;

    UPDATE public.warehouse_inventory
    SET warehouse_id = v_warehouse_id
    WHERE company_id = v_company.company_id
      AND warehouse_id IS NULL;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Stock movements (audit trail / cardex)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  movement_type text NOT NULL CHECK (movement_type IN (
    'purchase_receipt', 'sale_dispatch', 'sale_return', 'purchase_return',
    'transfer_out', 'transfer_in', 'adjustment_positive', 'adjustment_negative',
    'damage', 'expiry', 'production', 'consumption'
  )),

  quantity_before numeric(18,4) NOT NULL DEFAULT 0,
  quantity_change numeric(18,4) NOT NULL,
  quantity_after numeric(18,4) NOT NULL DEFAULT 0,

  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) GENERATED ALWAYS AS (quantity_change * unit_cost) STORED,

  reference_type text,
  reference_id uuid,
  reference_number text,

  batch_number text,
  lot_number text,
  expiry_date date,

  notes text,

  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  movement_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_read_stock_movements" ON public.stock_movements;
CREATE POLICY "company_members_read_stock_movements" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_stock_movements" ON public.stock_movements;
CREATE POLICY "company_members_write_stock_movements" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON public.stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON public.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON public.stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date ON public.stock_movements(movement_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Stock transfers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,

  transfer_number text NOT NULL UNIQUE,

  source_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,

  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'dispatched', 'in_transit', 'received', 'cancelled', 'partial'
  )),

  transfer_date date NOT NULL,
  expected_delivery_date date,
  actual_delivery_date date,

  notes text,
  reason text,

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  received_at timestamptz
);

ALTER TABLE public.stock_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_read_stock_transfers" ON public.stock_transfers;
CREATE POLICY "company_members_read_stock_transfers" ON public.stock_transfers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_stock_transfers" ON public.stock_transfers;
CREATE POLICY "company_members_write_stock_transfers" ON public.stock_transfers
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_stock_transfers_company_id ON public.stock_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_warehouse ON public.stock_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination_warehouse ON public.stock_transfers(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON public.stock_transfers(status);

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id uuid NOT NULL REFERENCES public.stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,

  quantity_requested numeric(18,4) NOT NULL,
  quantity_dispatched numeric(18,4) NOT NULL DEFAULT 0,
  quantity_received numeric(18,4) NOT NULL DEFAULT 0,

  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) GENERATED ALWAYS AS (quantity_requested * unit_cost) STORED,

  batch_number text,
  lot_number text,
  expiry_date date,

  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stock_transfer_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_members_read_stock_transfer_lines" ON public.stock_transfer_lines;
CREATE POLICY "company_members_read_stock_transfer_lines" ON public.stock_transfer_lines
  FOR SELECT TO authenticated
  USING (
    stock_transfer_id IN (
      SELECT id FROM public.stock_transfers
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "company_members_write_stock_transfer_lines" ON public.stock_transfer_lines;
CREATE POLICY "company_members_write_stock_transfer_lines" ON public.stock_transfer_lines
  FOR ALL TO authenticated
  USING (
    stock_transfer_id IN (
      SELECT id FROM public.stock_transfers
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    stock_transfer_id IN (
      SELECT id FROM public.stock_transfers
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_transfer_id ON public.stock_transfer_lines(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_product_id ON public.stock_transfer_lines(product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC helpers
-- ─────────────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.transfer_number_seq;

CREATE OR REPLACE FUNCTION public.generate_transfer_number()
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN 'TRF-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
         LPAD(nextval('public.transfer_number_seq')::text, 5, '0');
END;
$$;

-- Records a stock movement and keeps warehouse_inventory in sync.
-- Returns the created stock_movements id.
CREATE OR REPLACE FUNCTION public.record_stock_movement(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_movement_type text,
  p_quantity_change numeric,
  p_unit_cost numeric DEFAULT 0,
  p_reference_type text DEFAULT NULL,
  p_reference_id uuid DEFAULT NULL,
  p_reference_number text DEFAULT NULL,
  p_performed_by uuid DEFAULT NULL,
  p_batch_number text DEFAULT NULL,
  p_lot_number text DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_inventory_id uuid;
  v_quantity_before numeric;
  v_quantity_after numeric;
  v_movement_id uuid;
BEGIN
  SELECT id, quantity_in_stock
  INTO v_inventory_id, v_quantity_before
  FROM warehouse_inventory
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_warehouse_id;

  IF v_inventory_id IS NULL THEN
    INSERT INTO warehouse_inventory (
      company_id, product_id, warehouse_id,
      quantity_in_stock, quantity_reserved, average_cost
    ) VALUES (
      p_company_id, p_product_id, p_warehouse_id,
      0, 0, COALESCE(p_unit_cost, 0)
    ) RETURNING id INTO v_inventory_id;
    v_quantity_before := 0;
  END IF;

  v_quantity_after := v_quantity_before + p_quantity_change;

  INSERT INTO stock_movements (
    company_id, warehouse_id, product_id, movement_type,
    quantity_before, quantity_change, quantity_after, unit_cost,
    reference_type, reference_id, reference_number,
    batch_number, lot_number, expiry_date, notes, performed_by
  ) VALUES (
    p_company_id, p_warehouse_id, p_product_id, p_movement_type,
    v_quantity_before, p_quantity_change, v_quantity_after, COALESCE(p_unit_cost, 0),
    p_reference_type, p_reference_id, p_reference_number,
    p_batch_number, p_lot_number, p_expiry_date, p_notes, p_performed_by
  ) RETURNING id INTO v_movement_id;

  UPDATE warehouse_inventory
  SET quantity_in_stock = v_quantity_after,
      average_cost = CASE
        WHEN p_quantity_change > 0 AND (v_quantity_before + p_quantity_change) > 0 THEN
          ((COALESCE(average_cost, 0) * v_quantity_before) + (COALESCE(p_unit_cost, 0) * p_quantity_change))
            / (v_quantity_before + p_quantity_change)
        ELSE COALESCE(average_cost, 0)
      END,
      last_costed_at = now()
  WHERE id = v_inventory_id;

  RETURN v_movement_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_stock_transfer_dispatch(
  p_stock_transfer_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_source_id uuid;
  v_line RECORD;
BEGIN
  SELECT company_id, source_warehouse_id
  INTO v_company_id, v_source_id
  FROM stock_transfers
  WHERE id = p_stock_transfer_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Stock transfer not found';
  END IF;

  FOR v_line IN
    SELECT id, product_id, quantity_requested, unit_cost, batch_number, lot_number, expiry_date
    FROM stock_transfer_lines
    WHERE stock_transfer_id = p_stock_transfer_id
  LOOP
    PERFORM record_stock_movement(
      v_company_id, v_source_id, v_line.product_id, 'transfer_out',
      -v_line.quantity_requested, v_line.unit_cost,
      'stock_transfer', p_stock_transfer_id, NULL,
      NULL, v_line.batch_number, v_line.lot_number, v_line.expiry_date,
      'Transfer dispatch'
    );

    UPDATE stock_transfer_lines
    SET quantity_dispatched = quantity_requested
    WHERE id = v_line.id;
  END LOOP;

  UPDATE stock_transfers
  SET status = 'in_transit', dispatched_at = now(), updated_at = now()
  WHERE id = p_stock_transfer_id;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_stock_transfer_receive(
  p_stock_transfer_id uuid
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_destination_id uuid;
  v_line RECORD;
BEGIN
  SELECT company_id, destination_warehouse_id
  INTO v_company_id, v_destination_id
  FROM stock_transfers
  WHERE id = p_stock_transfer_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Stock transfer not found';
  END IF;

  FOR v_line IN
    SELECT id, product_id, quantity_requested, unit_cost, batch_number, lot_number, expiry_date
    FROM stock_transfer_lines
    WHERE stock_transfer_id = p_stock_transfer_id
  LOOP
    PERFORM record_stock_movement(
      v_company_id, v_destination_id, v_line.product_id, 'transfer_in',
      v_line.quantity_requested, v_line.unit_cost,
      'stock_transfer', p_stock_transfer_id, NULL,
      NULL, v_line.batch_number, v_line.lot_number, v_line.expiry_date,
      'Transfer receipt'
    );

    UPDATE stock_transfer_lines
    SET quantity_received = quantity_requested
    WHERE id = v_line.id;
  END LOOP;

  UPDATE stock_transfers
  SET status = 'received', received_at = now(),
      actual_delivery_date = CURRENT_DATE, updated_at = now()
  WHERE id = p_stock_transfer_id;

  RETURN true;
END;
$$;

COMMENT ON TABLE public.warehouses IS 'Multiple warehouse/locations for inventory management';
COMMENT ON TABLE public.stock_movements IS 'Audit trail (cardex) of all stock movements';
COMMENT ON TABLE public.stock_transfers IS 'Warehouse-to-warehouse stock transfers with dispatch/receive workflow';
