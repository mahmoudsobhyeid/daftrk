-- Add default_warehouse_id column to products table
-- This allows each product to be assigned to a specific warehouse by default

ALTER TABLE products
ADD COLUMN IF NOT EXISTS default_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- Add comment
COMMENT ON COLUMN products.default_warehouse_id IS 'Default warehouse where this product is stored. When invoiced, quantity will be deducted from this warehouse.';
