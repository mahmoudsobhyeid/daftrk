/*
# Comprehensive Multi-Warehouse & Inventory Management System

## Overview
Upgrades the existing inventory system to support:
- Multiple warehouses/locations with per-warehouse stock tracking
- Complete inventory & accounting cycle with double-entry GL integration
- Stock transfer workflow (dispatch → in-transit → receive)
- Inventory valuation methods (FIFO/LIFO/Standard Costing)
- Physical stocktaking/adjustment module
- Comprehensive audit trail and reporting

## Key Changes
1. Add `warehouses` table for multiple warehouse locations
2. Restructure `warehouse_inventory` to be per-product-per-warehouse
3. Add `stock_movements` for detailed audit trail with cost tracking
4. Add `stock_transfers` for warehouse-to-warehouse transfers
5. Add `stock_adjustments` for physical count adjustments
6. Add `stock_layers` for FIFO/LIFO cost tracking
7. Add GL journal entries integration for stock movements
8. Add inventory valuation reports functions
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Warehouses Table (Multiple Locations)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Warehouse Details
  name text NOT NULL,
  code text NOT NULL UNIQUE, -- WH-01, WH-02, etc.
  location text,
  address text,
  city text,
  district text,
  postal_code text,
  country text DEFAULT 'Saudi Arabia',
  
  -- Warehouse Type
  warehouse_type text NOT NULL DEFAULT 'main' CHECK (warehouse_type IN ('main', 'branch', 'transit', 'store', 'virtual')),
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  
  -- Capacity Info
  capacity_units integer, -- Maximum storage capacity
  capacity_volume numeric, -- Volume capacity in cubic meters
  
  -- Contact
  manager_name text,
  manager_phone text,
  manager_email text,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, code)
);

ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouses
DROP POLICY IF EXISTS "company_members_read_warehouses" ON warehouses;
CREATE POLICY "company_members_read_warehouses" ON warehouses
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_warehouses" ON warehouses;
CREATE POLICY "company_members_write_warehouses" ON warehouses
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_warehouses_company_id ON warehouses(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouses_is_active ON warehouses(company_id, is_active);

-- ─────────────────────────────────────────────────────────────────────────────
-- Restructure warehouse_inventory to be per-product-per-warehouse
-- ─────────────────────────────────────────────────────────────────────────────

-- Add warehouse_id column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'warehouse_inventory' AND column_name = 'warehouse_id'
  ) THEN
    ALTER TABLE warehouse_inventory ADD COLUMN warehouse_id uuid;
  END IF;
END $$;

-- Drop existing unique constraint
ALTER TABLE warehouse_inventory DROP CONSTRAINT IF EXISTS warehouse_inventory_company_id_product_id_key;

-- Add foreign key to warehouses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'warehouse_inventory_warehouse_id_fkey'
  ) THEN
    ALTER TABLE warehouse_inventory 
    ADD CONSTRAINT warehouse_inventory_warehouse_id_fkey 
    FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create new unique constraint: one inventory record per product per warehouse
ALTER TABLE warehouse_inventory 
ADD CONSTRAINT warehouse_inventory_company_product_warehouse_unique 
UNIQUE(company_id, product_id, warehouse_id);

-- Add cost tracking columns
ALTER TABLE warehouse_inventory 
ADD COLUMN IF NOT EXISTS average_cost numeric(18,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_value numeric(18,4) GENERATED ALWAYS AS (quantity_in_stock * average_cost) STORED,
ADD COLUMN IF NOT EXISTS last_costed_at timestamptz;

-- Add batch/lot tracking columns
ALTER TABLE warehouse_inventory
ADD COLUMN IF NOT EXISTS batch_number text,
ADD COLUMN IF NOT EXISTS lot_number text,
ADD COLUMN IF NOT EXISTS expiry_date date,
ADD COLUMN IF NOT EXISTS manufacturing_date date;

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock Movements Table (Detailed Audit Trail)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Movement Details
  movement_type text NOT NULL CHECK (movement_type IN (
    'purchase_receipt', -- Goods received from supplier
    'sale_dispatch', -- Goods sold to customer
    'sale_return', -- Goods returned by customer
    'purchase_return', -- Goods returned to supplier
    'transfer_out', -- Sent to another warehouse
    'transfer_in', -- Received from another warehouse
    'adjustment_positive', -- Physical count surplus
    'adjustment_negative', -- Physical count deficit/write-off
    'damage', -- Damaged goods
    'expiry', -- Expired goods
    'production', -- Manufactured goods
    'consumption' -- Used in production
  )),
  
  -- Quantities
  quantity_before numeric(18,4) NOT NULL DEFAULT 0,
  quantity_change numeric(18,4) NOT NULL,
  quantity_after numeric(18,4) NOT NULL DEFAULT 0,
  
  -- Cost & Valuation
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) GENERATED ALWAYS AS (quantity_change * unit_cost) STORED,
  cost_method text DEFAULT 'standard' CHECK (cost_method IN ('standard', 'fifo', 'lifo')),
  
  -- Reference
  reference_type text, -- invoice, purchase_order, transfer, adjustment
  reference_id uuid,
  reference_number text,
  
  -- Batch/Lot Info
  batch_number text,
  lot_number text,
  expiry_date date,
  
  -- Additional Info
  notes text,
  reason_code text, -- For adjustments
  reason_description text,
  
  -- Performed by
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  movement_date timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_movements
DROP POLICY IF EXISTS "company_members_read_stock_movements" ON stock_movements;
CREATE POLICY "company_members_read_stock_movements" ON stock_movements
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_stock_movements" ON stock_movements;
CREATE POLICY "company_members_write_stock_movements" ON stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_movements_company_id ON stock_movements(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_warehouse_id ON stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product_id ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_type ON stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_stock_movements_movement_date ON stock_movements(movement_date);
CREATE INDEX IF NOT EXISTS idx_stock_movements_reference ON stock_movements(reference_type, reference_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock Transfers Table (Warehouse-to-Warehouse)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Transfer Number
  transfer_number text NOT NULL UNIQUE,
  
  -- Source & Destination
  source_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  destination_warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'pending', 'dispatched', 'in_transit', 'received', 'cancelled', 'partial'
  )),
  
  -- Transfer Details
  transfer_date date NOT NULL,
  expected_delivery_date date,
  actual_delivery_date date,
  
  -- Notes
  notes text,
  reason text,
  
  -- Performed by
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dispatched_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  received_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  dispatched_at timestamptz,
  received_at timestamptz
);

ALTER TABLE stock_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_transfers
DROP POLICY IF EXISTS "company_members_read_stock_transfers" ON stock_transfers;
CREATE POLICY "company_members_read_stock_transfers" ON stock_transfers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_stock_transfers" ON stock_transfers;
CREATE POLICY "company_members_write_stock_transfers" ON stock_transfers
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_transfers_company_id ON stock_transfers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_source_warehouse ON stock_transfers(source_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_destination_warehouse ON stock_transfers(destination_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_status ON stock_transfers(status);
CREATE INDEX IF NOT EXISTS idx_stock_transfers_transfer_date ON stock_transfers(transfer_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock Transfer Lines (Items in a transfer)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  
  -- Quantities
  quantity_requested numeric(18,4) NOT NULL,
  quantity_dispatched numeric(18,4) NOT NULL DEFAULT 0,
  quantity_received numeric(18,4) NOT NULL DEFAULT 0,
  
  -- Cost
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) GENERATED ALWAYS AS (quantity_requested * unit_cost) STORED,
  
  -- Batch/Lot
  batch_number text,
  lot_number text,
  expiry_date date,
  
  -- Notes
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_transfer_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_members_read_stock_transfer_lines" ON stock_transfer_lines;
CREATE POLICY "company_members_read_stock_transfer_lines" ON stock_transfer_lines
  FOR SELECT TO authenticated
  USING (
    stock_transfer_id IN (
      SELECT id FROM stock_transfers 
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "company_members_write_stock_transfer_lines" ON stock_transfer_lines;
CREATE POLICY "company_members_write_stock_transfer_lines" ON stock_transfer_lines
  FOR ALL TO authenticated
  USING (
    stock_transfer_id IN (
      SELECT id FROM stock_transfers 
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    stock_transfer_id IN (
      SELECT id FROM stock_transfers 
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_transfer_id ON stock_transfer_lines(stock_transfer_id);
CREATE INDEX IF NOT EXISTS idx_stock_transfer_lines_product_id ON stock_transfer_lines(product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock Adjustments Table (Physical Count / Stocktaking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  
  -- Adjustment Number
  adjustment_number text NOT NULL UNIQUE,
  
  -- Adjustment Type
  adjustment_type text NOT NULL CHECK (adjustment_type IN (
    'physical_count', -- Stocktaking/cycle count
    'write_off', -- Damaged/expired goods
    'correction', -- System error correction
    'loss', -- Shrinkage/theft
    'gain' -- Surplus
  )),
  
  -- Status
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'posted')),
  
  -- Dates
  adjustment_date date NOT NULL,
  posted_date date,
  
  -- Notes
  notes text,
  reason_code text,
  reason_description text,
  
  -- Approval
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejection_reason text,
  
  -- Performed by
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_members_read_stock_adjustments" ON stock_adjustments;
CREATE POLICY "company_members_read_stock_adjustments" ON stock_adjustments
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_stock_adjustments" ON stock_adjustments;
CREATE POLICY "company_members_write_stock_adjustments" ON stock_adjustments
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_company_id ON stock_adjustments(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_warehouse_id ON stock_adjustments(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_status ON stock_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_stock_adjustments_adjustment_date ON stock_adjustments(adjustment_date);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock Adjustment Lines
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_adjustment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_adjustment_id uuid NOT NULL REFERENCES stock_adjustments(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  
  -- Quantities
  system_quantity numeric(18,4) NOT NULL DEFAULT 0,
  physical_quantity numeric(18,4) NOT NULL DEFAULT 0,
  adjustment_quantity numeric(18,4) GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  
  -- Cost
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  total_cost numeric(18,4) GENERATED ALWAYS AS (adjustment_quantity * unit_cost) STORED,
  
  -- Batch/Lot
  batch_number text,
  lot_number text,
  expiry_date date,
  
  -- Notes
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE stock_adjustment_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_members_read_stock_adjustment_lines" ON stock_adjustment_lines;
CREATE POLICY "company_members_read_stock_adjustment_lines" ON stock_adjustment_lines
  FOR SELECT TO authenticated
  USING (
    stock_adjustment_id IN (
      SELECT id FROM stock_adjustments 
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "company_members_write_stock_adjustment_lines" ON stock_adjustment_lines;
CREATE POLICY "company_members_write_stock_adjustment_lines" ON stock_adjustment_lines
  FOR ALL TO authenticated
  USING (
    stock_adjustment_id IN (
      SELECT id FROM stock_adjustments 
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    stock_adjustment_id IN (
      SELECT id FROM stock_adjustments 
      WHERE company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_lines_adjustment_id ON stock_adjustment_lines(stock_adjustment_id);
CREATE INDEX IF NOT EXISTS idx_stock_adjustment_lines_product_id ON stock_adjustment_lines(product_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Stock Layers Table (FIFO/LIFO Cost Tracking)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Layer Details
  layer_type text NOT NULL CHECK (layer_type IN ('purchase', 'production', 'transfer_in', 'adjustment')),
  
  -- Quantities
  original_quantity numeric(18,4) NOT NULL,
  remaining_quantity numeric(18,4) NOT NULL,
  
  -- Cost
  unit_cost numeric(18,4) NOT NULL,
  total_cost numeric(18,4) GENERATED ALWAYS AS (original_quantity * unit_cost) STORED,
  
  -- Reference
  reference_type text,
  reference_id uuid,
  reference_date date,
  
  -- Batch/Lot
  batch_number text,
  lot_number text,
  expiry_date date,
  
  -- Status
  is_exhausted boolean NOT NULL DEFAULT false,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  exhausted_at timestamptz
);

ALTER TABLE stock_layers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_members_read_stock_layers" ON stock_layers;
CREATE POLICY "company_members_read_stock_layers" ON stock_layers
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "company_members_write_stock_layers" ON stock_layers;
CREATE POLICY "company_members_write_stock_layers" ON stock_layers
  FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_layers_company_id ON stock_layers(company_id);
CREATE INDEX IF NOT EXISTS idx_stock_layers_warehouse_id ON stock_layers(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_layers_product_id ON stock_layers(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_layers_is_exhausted ON stock_layers(product_id, is_exhausted);
CREATE INDEX IF NOT EXISTS idx_stock_layers_expiry_date ON stock_layers(expiry_date) WHERE expiry_date IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Double-Entry Accounting Integration
-- ─────────────────────────────────────────────────────────────────────────────

-- Add reference columns to journal_entries table for stock movements
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'stock_movement_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN stock_movement_id uuid REFERENCES stock_movements(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'stock_adjustment_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN stock_adjustment_id uuid REFERENCES stock_adjustments(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'stock_transfer_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN stock_transfer_id uuid REFERENCES stock_transfers(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Functions for Stock Movement & Accounting
-- ─────────────────────────────────────────────────────────────────────────────

-- Function to record stock movement and create GL journal entry
CREATE OR REPLACE FUNCTION record_stock_movement(
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
RETURNS uuid AS $$
DECLARE
  v_inventory_id uuid;
  v_quantity_before numeric;
  v_quantity_after numeric;
  v_movement_id uuid;
  v_gl_account_debit uuid;
  v_gl_account_credit uuid;
  v_cost numeric;
BEGIN
  -- Get or create inventory record
  SELECT id INTO v_inventory_id
  FROM warehouse_inventory
  WHERE company_id = p_company_id 
    AND product_id = p_product_id 
    AND warehouse_id = p_warehouse_id;
  
  IF v_inventory_id IS NULL THEN
    INSERT INTO warehouse_inventory (
      company_id, product_id, warehouse_id,
      quantity_in_stock, quantity_available, average_cost
    ) VALUES (
      p_company_id, p_product_id, p_warehouse_id,
      0, 0, p_unit_cost
    ) RETURNING id INTO v_inventory_id;
  END IF;
  
  -- Get current quantity
  SELECT quantity_in_stock INTO v_quantity_before
  FROM warehouse_inventory
  WHERE id = v_inventory_id;
  
  -- Calculate new quantity
  v_quantity_after := v_quantity_before + p_quantity_change;
  v_cost := ABS(p_quantity_change * p_unit_cost);
  
  -- Create stock movement record
  INSERT INTO stock_movements (
    company_id, warehouse_id, product_id,
    movement_type, quantity_before, quantity_change, quantity_after,
    unit_cost, reference_type, reference_id, reference_number,
    batch_number, lot_number, expiry_date, notes, performed_by
  ) VALUES (
    p_company_id, p_warehouse_id, p_product_id,
    p_movement_type, v_quantity_before, p_quantity_change, v_quantity_after,
    p_unit_cost, p_reference_type, p_reference_id, p_reference_number,
    p_batch_number, p_lot_number, p_expiry_date, p_notes, p_performed_by
  ) RETURNING id INTO v_movement_id;
  
  -- Update inventory quantity
  UPDATE warehouse_inventory
  SET 
    quantity_in_stock = v_quantity_after,
    quantity_available = quantity_in_stock - quantity_reserved,
    average_cost = CASE 
      WHEN p_quantity_change > 0 THEN 
        (average_cost * quantity_in_stock + p_unit_cost * p_quantity_change) / (quantity_in_stock + p_quantity_change)
      ELSE average_cost
    END,
    last_costed_at = now()
  WHERE id = v_inventory_id;
  
  -- Create GL journal entry based on movement type
  IF p_movement_type IN ('sale_dispatch', 'damage', 'expiry', 'write_off') THEN
    -- Debit COGS, Credit Inventory
    INSERT INTO journal_entries (
      company_id, entry_date, reference_type, reference_id,
      description, stock_movement_id, created_by
    ) VALUES (
      p_company_id, CURRENT_DATE, p_movement_type, p_movement_id,
      'Stock movement: ' || p_movement_type, v_movement_id, p_performed_by
    ) RETURNING id;
    
    -- Create debit line (COGS)
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, debit_amount, credit_amount, description
    ) SELECT 
      id, 
      (SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '5000' LIMIT 1),
      v_cost, 0, 'COGS: ' || p_movement_type
    FROM journal_entries WHERE id = (SELECT max(id) FROM journal_entries);
    
    -- Create credit line (Inventory)
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, debit_amount, credit_amount, description
    ) SELECT 
      id, 
      (SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1200' LIMIT 1),
      0, v_cost, 'Inventory: ' || p_movement_type
    FROM journal_entries WHERE id = (SELECT max(id) FROM journal_entries);
    
  ELSIF p_movement_type IN ('purchase_receipt', 'transfer_in', 'adjustment_positive') THEN
    -- Debit Inventory, Credit AP/Cash
    INSERT INTO journal_entries (
      company_id, entry_date, reference_type, reference_id,
      description, stock_movement_id, created_by
    ) VALUES (
      p_company_id, CURRENT_DATE, p_movement_type, p_movement_id,
      'Stock movement: ' || p_movement_type, v_movement_id, p_performed_by
    ) RETURNING id;
    
    -- Create debit line (Inventory)
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, debit_amount, credit_amount, description
    ) SELECT 
      id, 
      (SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '1200' LIMIT 1),
      v_cost, 0, 'Inventory: ' || p_movement_type
    FROM journal_entries WHERE id = (SELECT max(id) FROM journal_entries);
    
    -- Create credit line (AP/Cash)
    INSERT INTO journal_entry_lines (
      journal_entry_id, account_id, debit_amount, credit_amount, description
    ) SELECT 
      id, 
      (SELECT id FROM chart_of_accounts WHERE company_id = p_company_id AND account_code = '2000' LIMIT 1),
      0, v_cost, 'Accounts Payable: ' || p_movement_type
    FROM journal_entries WHERE id = (SELECT max(id) FROM journal_entries);
  END IF;
  
  RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process stock transfer (dispatch)
CREATE OR REPLACE FUNCTION process_stock_transfer_dispatch(
  p_stock_transfer_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_company_id uuid;
  v_source_warehouse_id uuid;
  v_line RECORD;
BEGIN
  -- Get transfer details
  SELECT company_id, source_warehouse_id 
  INTO v_company_id, v_source_warehouse_id
  FROM stock_transfers
  WHERE id = p_stock_transfer_id;
  
  -- Process each line
  FOR v_line IN 
    SELECT product_id, quantity_requested, unit_cost, batch_number, lot_number, expiry_date
    FROM stock_transfer_lines
    WHERE stock_transfer_id = p_stock_transfer_id
  LOOP
    -- Record stock movement (out from source)
    PERFORM record_stock_movement(
      v_company_id,
      v_source_warehouse_id,
      v_line.product_id,
      'transfer_out',
      -v_line.quantity_requested,
      v_line.unit_cost,
      'stock_transfer',
      p_stock_transfer_id,
      NULL,
      NULL,
      NULL,
      v_line.batch_number,
      v_line.lot_number,
      v_line.expiry_date,
      'Transfer dispatch'
    );
    
    -- Update line as dispatched
    UPDATE stock_transfer_lines
    SET quantity_dispatched = quantity_requested
    WHERE id = v_line.id;
  END LOOP;
  
  -- Update transfer status
  UPDATE stock_transfers
  SET 
    status = 'in_transit',
    dispatched_at = now()
  WHERE id = p_stock_transfer_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to process stock transfer (receive)
CREATE OR REPLACE FUNCTION process_stock_transfer_receive(
  p_stock_transfer_id uuid
)
RETURNS boolean AS $$
DECLARE
  v_company_id uuid;
  v_destination_warehouse_id uuid;
  v_line RECORD;
BEGIN
  -- Get transfer details
  SELECT company_id, destination_warehouse_id 
  INTO v_company_id, v_destination_warehouse_id
  FROM stock_transfers
  WHERE id = p_stock_transfer_id;
  
  -- Process each line
  FOR v_line IN 
    SELECT product_id, quantity_requested, unit_cost, batch_number, lot_number, expiry_date
    FROM stock_transfer_lines
    WHERE stock_transfer_id = p_stock_transfer_id
  LOOP
    -- Record stock movement (in to destination)
    PERFORM record_stock_movement(
      v_company_id,
      v_destination_warehouse_id,
      v_line.product_id,
      'transfer_in',
      v_line.quantity_requested,
      v_line.unit_cost,
      'stock_transfer',
      p_stock_transfer_id,
      NULL,
      NULL,
      NULL,
      v_line.batch_number,
      v_line.lot_number,
      v_line.expiry_date,
      'Transfer receipt'
    );
    
    -- Update line as received
    UPDATE stock_transfer_lines
    SET quantity_received = quantity_requested
    WHERE id = v_line.id;
  END LOOP;
  
  -- Update transfer status
  UPDATE stock_transfers
  SET 
    status = 'received',
    received_at = now(),
    actual_delivery_date = CURRENT_DATE
  WHERE id = p_stock_transfer_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get FIFO cost for product
CREATE OR REPLACE FUNCTION get_fifo_cost(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric
)
RETURNS TABLE (unit_cost numeric, total_cost numeric) AS $$
BEGIN
  RETURN QUERY
  WITH layers AS (
    SELECT id, unit_cost, remaining_quantity
    FROM stock_layers
    WHERE company_id = p_company_id
      AND warehouse_id = p_warehouse_id
      AND product_id = p_product_id
      AND is_exhausted = false
      AND remaining_quantity > 0
    ORDER BY created_at ASC  -- FIFO: oldest first
  )
  SELECT 
    unit_cost,
    unit_cost * LEAST(remaining_quantity, p_quantity) as total_cost
  FROM layers
  WHERE remaining_quantity > 0
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get inventory valuation report
CREATE OR REPLACE FUNCTION get_inventory_valuation(
  p_company_id uuid,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS TABLE (
  warehouse_id uuid,
  warehouse_name text,
  product_id uuid,
  product_name text,
  product_sku text,
  quantity_on_hand numeric,
  average_cost numeric,
  total_value numeric,
  low_stock_threshold numeric,
  is_below_threshold boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.id as warehouse_id,
    w.name as warehouse_name,
    p.id as product_id,
    p.name as product_name,
    p.sku as product_sku,
    wi.quantity_in_stock as quantity_on_hand,
    wi.average_cost,
    wi.total_value,
    wi.low_stock_threshold,
    CASE 
      WHEN wi.quantity_available <= wi.low_stock_threshold THEN true
      ELSE false
    END as is_below_threshold
  FROM warehouse_inventory wi
  JOIN warehouses w ON wi.warehouse_id = w.id
  JOIN products p ON wi.product_id = p.id
  WHERE wi.company_id = p_company_id
    AND (p_warehouse_id IS NULL OR wi.warehouse_id = p_warehouse_id)
    AND w.is_active = true
  ORDER BY w.name, p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and trigger low stock alerts (updated)
CREATE OR REPLACE FUNCTION check_low_stock_alert_enhanced()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold integer;
  v_alert_exists boolean;
  v_warehouse_name text;
BEGIN
  -- Get the low stock threshold for this product
  SELECT low_stock_threshold INTO v_threshold
  FROM warehouse_inventory
  WHERE id = NEW.id;
  
  -- Check if we should trigger an alert
  IF v_threshold IS NOT NULL AND NEW.quantity_available <= v_threshold THEN
    -- Get warehouse name
    SELECT name INTO v_warehouse_name
    FROM warehouses
    WHERE id = NEW.warehouse_id;
    
    -- Check if an active alert already exists
    SELECT EXISTS(
      SELECT 1 FROM low_stock_alerts
      WHERE inventory_id = NEW.id
        AND is_active = true
    ) INTO v_alert_exists;
    
    -- Create alert if one doesn't exist
    IF NOT v_alert_exists THEN
      INSERT INTO low_stock_alerts (
        company_id, inventory_id, product_id,
        current_quantity, threshold_quantity,
        message, alert_type
      ) VALUES (
        NEW.company_id, NEW.id, NEW.product_id,
        NEW.quantity_available, v_threshold,
        'Product ' || (SELECT name FROM products WHERE id = NEW.product_id) || 
        ' in ' || COALESCE(v_warehouse_name, 'warehouse') || 
        ' is below the low stock threshold (' || v_threshold || ')',
        'low_stock'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update trigger to use enhanced function
DROP TRIGGER IF EXISTS trigger_check_low_stock_alert ON warehouse_inventory;
CREATE TRIGGER trigger_check_low_stock_alert
AFTER UPDATE ON warehouse_inventory
FOR EACH ROW
EXECUTE FUNCTION check_low_stock_alert_enhanced();

-- Function to generate transfer number
CREATE OR REPLACE FUNCTION generate_transfer_number()
RETURNS text AS $$
BEGIN
  RETURN 'TRF-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
         LPAD(nextval('transfer_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequence for transfer numbers
CREATE SEQUENCE IF NOT EXISTS transfer_number_seq;

-- Function to generate adjustment number
CREATE OR REPLACE FUNCTION generate_adjustment_number()
RETURNS text AS $$
BEGIN
  RETURN 'ADJ-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || 
         LPAD(nextval('adjustment_number_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequence for adjustment numbers
CREATE SEQUENCE IF NOT EXISTS adjustment_number_seq;

COMMENT ON TABLE warehouses IS 'Multiple warehouse/locations for inventory management';
COMMENT ON TABLE stock_movements IS 'Detailed audit trail of all stock movements with cost tracking';
COMMENT ON TABLE stock_transfers IS 'Warehouse-to-warehouse stock transfers with dispatch/receive workflow';
COMMENT ON TABLE stock_adjustments IS 'Physical stocktaking/adjustment records with approval workflow';
COMMENT ON TABLE stock_layers IS 'FIFO/LIFO cost tracking layers for accurate COGS calculation';
