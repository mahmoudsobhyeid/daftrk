/*
# Create Warehouse & Inventory Management System

## Overview
Adds complete inventory management system with:
- Warehouse/Products table for stock management
- Low stock alerts system
- Automatic tracking of inventory levels

## Tables
1. warehouse_inventory - Central inventory tracking per product per company
2. low_stock_alerts - Tracks user-configured low stock thresholds and active alerts
3. inventory_transactions - Audit log of all stock movements
*/

-- Main inventory table (one row per product per company)
CREATE TABLE IF NOT EXISTS public.warehouse_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Stock levels
  quantity_in_stock integer NOT NULL DEFAULT 0,
  quantity_reserved integer NOT NULL DEFAULT 0,
  quantity_available integer NOT NULL DEFAULT 0,
  
  -- Low stock configuration
  low_stock_threshold integer,
  low_stock_unit text DEFAULT 'units', -- units, percentage, etc
  
  -- Reorder info
  reorder_quantity integer,
  reorder_point integer,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Unique constraint: one inventory record per product per company
  UNIQUE(company_id, product_id)
);

-- Low stock alerts table
CREATE TABLE IF NOT EXISTS public.low_stock_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.warehouse_inventory(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Alert details
  alert_type text NOT NULL DEFAULT 'low_stock', -- low_stock, out_of_stock, overstock
  current_quantity integer NOT NULL,
  threshold_quantity integer NOT NULL,
  message text,
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_acknowledged boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  triggered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Inventory transaction audit log
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.warehouse_inventory(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Transaction details
  transaction_type text NOT NULL, -- purchase, sale, adjustment, return, damage
  quantity_change integer NOT NULL,
  notes text,
  
  -- Performed by
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_company_id ON warehouse_inventory(company_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_inventory_product_id ON warehouse_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_company_id ON low_stock_alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_low_stock_alerts_is_active ON low_stock_alerts(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_company_id ON inventory_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_invoice_id ON inventory_transactions(invoice_id);

-- Enable RLS
ALTER TABLE warehouse_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE low_stock_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for warehouse_inventory
DROP POLICY IF EXISTS "company_members_read_warehouse_inventory" ON warehouse_inventory;
CREATE POLICY "company_members_read_warehouse_inventory" ON warehouse_inventory
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_members_write_warehouse_inventory" ON warehouse_inventory;
CREATE POLICY "company_members_write_warehouse_inventory" ON warehouse_inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_members_update_warehouse_inventory" ON warehouse_inventory;
CREATE POLICY "company_members_update_warehouse_inventory" ON warehouse_inventory
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for low_stock_alerts
DROP POLICY IF EXISTS "company_members_read_low_stock_alerts" ON low_stock_alerts;
CREATE POLICY "company_members_read_low_stock_alerts" ON low_stock_alerts
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_members_write_low_stock_alerts" ON low_stock_alerts;
CREATE POLICY "company_members_write_low_stock_alerts" ON low_stock_alerts
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_members_update_low_stock_alerts" ON low_stock_alerts;
CREATE POLICY "company_members_update_low_stock_alerts" ON low_stock_alerts
  FOR UPDATE TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for inventory_transactions
DROP POLICY IF EXISTS "company_members_read_inventory_transactions" ON inventory_transactions;
CREATE POLICY "company_members_read_inventory_transactions" ON inventory_transactions
  FOR SELECT TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "company_members_write_inventory_transactions" ON inventory_transactions;
CREATE POLICY "company_members_write_inventory_transactions" ON inventory_transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_members
      WHERE user_id = auth.uid()
    )
  );

-- Trigger to update quantity_available when stock or reserved quantities change
CREATE OR REPLACE FUNCTION update_quantity_available()
RETURNS TRIGGER AS $$
BEGIN
  NEW.quantity_available := NEW.quantity_in_stock - NEW.quantity_reserved;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_quantity_available ON warehouse_inventory;
CREATE TRIGGER trigger_update_quantity_available
BEFORE UPDATE ON warehouse_inventory
FOR EACH ROW
EXECUTE FUNCTION update_quantity_available();

-- Trigger to check and create low stock alerts
CREATE OR REPLACE FUNCTION check_low_stock_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold integer;
  v_alert_exists boolean;
BEGIN
  -- Get the low stock threshold for this product
  SELECT low_stock_threshold INTO v_threshold
  FROM warehouse_inventory
  WHERE id = NEW.id;
  
  -- Check if we should trigger an alert
  IF v_threshold IS NOT NULL AND NEW.quantity_available <= v_threshold THEN
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
        'Product quantity is below the low stock threshold',
        'low_stock'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_low_stock_alert ON warehouse_inventory;
CREATE TRIGGER trigger_check_low_stock_alert
AFTER UPDATE ON warehouse_inventory
FOR EACH ROW
EXECUTE FUNCTION check_low_stock_alert();
