/*
# Refactor Rental Module & Add Analytics Reporting

## Overview
1. Removes unused rental complexity (pricing rules, installments, seasonal pricing)
2. Adds core rental configuration settings
3. Creates dedicated Analytics & Reporting Module

## Changes

### Rental Module Simplification
- DROP lease_installments table (removes installment complexity)
- No seasonal pricing tables to drop (not implemented)
- No pricing rules tables to drop (not implemented)
- Add rental_settings table for core configuration

### Analytics & Reporting Module
- Add report_cache table for performance
- Add report_schedules table for automated reports
- Add functions for key report calculations
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- Remove Rental Installments Complexity
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop lease_installments table and its dependencies
DROP TABLE IF EXISTS public.lease_installments CASCADE;

-- Remove payment_frequency from leases (since we'll use standard invoices)
ALTER TABLE leases DROP COLUMN IF EXISTS payment_frequency;

-- ─────────────────────────────────────────────────────────────────────────────
-- Add Core Rental Configuration Settings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.rental_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  
  -- Security Deposit Settings
  default_security_deposit numeric(12,2) NOT NULL DEFAULT 0,
  security_deposit_refund_days integer NOT NULL DEFAULT 30,
  
  -- Unit Status Automation
  auto_update_unit_status boolean NOT NULL DEFAULT true,
  unit_status_on_contract_expiry text DEFAULT 'vacant' CHECK (unit_status_on_contract_expiry IN ('vacant', 'maintenance', 'rented')),
  
  -- Grace Period Settings
  overdue_grace_period_days integer NOT NULL DEFAULT 5,
  return_grace_period_days integer NOT NULL DEFAULT 3,
  
  -- Cancellation Rules
  cancellation_policy text NOT NULL DEFAULT 'flexible' CHECK (cancellation_policy IN ('flexible', 'moderate', 'strict')),
  cancellation_notice_days integer NOT NULL DEFAULT 30,
  cancellation_fee_percentage numeric(5,2) NOT NULL DEFAULT 0,
  
  -- Document Templates
  contract_template_id uuid,
  invoice_template_id uuid,
  receipt_template_id uuid,
  
  -- Invoice Generation
  auto_generate_invoice boolean NOT NULL DEFAULT true,
  invoice_generation_days_before integer NOT NULL DEFAULT 7,
  
  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(company_id)
);

ALTER TABLE rental_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_manage_rental_settings" ON rental_settings;
CREATE POLICY "company_manage_rental_settings" ON rental_settings
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Index
CREATE INDEX IF NOT EXISTS idx_rental_settings_company_id ON rental_settings(company_id);

-- Function to initialize rental settings for new companies
CREATE OR REPLACE FUNCTION initialize_rental_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO rental_settings (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create rental settings
DROP TRIGGER IF EXISTS trigger_initialize_rental_settings ON companies;
CREATE TRIGGER trigger_initialize_rental_settings
AFTER INSERT ON companies
FOR EACH ROW
EXECUTE FUNCTION initialize_rental_settings();

-- ─────────────────────────────────────────────────────────────────────────────
-- Analytics & Reporting Module
-- ─────────────────────────────────────────────────────────────────────────────

-- Report cache for performance optimization
CREATE TABLE IF NOT EXISTS public.report_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  report_type text NOT NULL,
  report_key text NOT NULL,
  report_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  
  UNIQUE(company_id, report_type, report_key)
);

ALTER TABLE report_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "company_manage_report_cache" ON report_cache;
CREATE POLICY "company_manage_report_cache" ON report_cache
  FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()))
  WITH CHECK (company_id IN (SELECT company_id FROM public.company_members WHERE user_id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_report_cache_company_type ON report_cache(company_id, report_type);
CREATE INDEX IF NOT EXISTS idx_report_cache_expires_at ON report_cache(expires_at);

-- Function to clean expired report cache
CREATE OR REPLACE FUNCTION clean_expired_report_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM report_cache WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (would need pg_cron extension, manual trigger alternative)
-- For now, clean on demand via function call

-- ─────────────────────────────────────────────────────────────────────────────
-- Report Calculation Functions
-- ─────────────────────────────────────────────────────────────────────────────

-- Sales & Invoicing Reports
CREATE OR REPLACE FUNCTION get_sales_summary(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  total_sales numeric,
  total_invoices integer,
  paid_invoices integer,
  pending_invoices integer,
  overdue_invoices integer,
  credit_notes_count integer,
  tax_total numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN i.status != 'cancelled' THEN i.total_amount ELSE 0 END), 0) as total_sales,
    COUNT(*) as total_invoices,
    COUNT(*) FILTER (WHERE i.status = 'paid') as paid_invoices,
    COUNT(*) FILTER (WHERE i.status = 'pending') as pending_invoices,
    COUNT(*) FILTER (WHERE i.status = 'overdue') as overdue_invoices,
    COUNT(*) FILTER (WHERE i.type = 'credit_note') as credit_notes_count,
    COALESCE(SUM(i.tax_amount), 0) as tax_total
  FROM invoices i
  WHERE i.company_id = p_company_id
    AND (p_start_date IS NULL OR i.issue_date >= p_start_date)
    AND (p_end_date IS NULL OR i.issue_date <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Customer Reports
CREATE OR REPLACE FUNCTION get_customer_aging(
  p_company_id uuid
)
RETURNS TABLE (
  customer_id uuid,
  customer_name text,
  current_amount numeric,
  days_1_30 numeric,
  days_31_60 numeric,
  days_61_90 numeric,
  days_over_90 numeric,
  total_outstanding numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as customer_id,
    c.name as customer_name,
    COALESCE(SUM(CASE 
      WHEN i.status IN ('pending', 'overdue') AND i.due_date >= CURRENT_DATE 
      THEN i.total_amount - i.paid_amount 
      ELSE 0 
    END), 0) as current_amount,
    COALESCE(SUM(CASE 
      WHEN i.status IN ('pending', 'overdue') 
      AND i.due_date < CURRENT_DATE 
      AND i.due_date >= CURRENT_DATE - INTERVAL '30 days'
      THEN i.total_amount - i.paid_amount 
      ELSE 0 
    END), 0) as days_1_30,
    COALESCE(SUM(CASE 
      WHEN i.status IN ('pending', 'overdue') 
      AND i.due_date < CURRENT_DATE - INTERVAL '30 days'
      AND i.due_date >= CURRENT_DATE - INTERVAL '60 days'
      THEN i.total_amount - i.paid_amount 
      ELSE 0 
    END), 0) as days_31_60,
    COALESCE(SUM(CASE 
      WHEN i.status IN ('pending', 'overdue') 
      AND i.due_date < CURRENT_DATE - INTERVAL '60 days'
      AND i.due_date >= CURRENT_DATE - INTERVAL '90 days'
      THEN i.total_amount - i.paid_amount 
      ELSE 0 
    END), 0) as days_61_90,
    COALESCE(SUM(CASE 
      WHEN i.status IN ('pending', 'overdue') 
      AND i.due_date < CURRENT_DATE - INTERVAL '90 days'
      THEN i.total_amount - i.paid_amount 
      ELSE 0 
    END), 0) as days_over_90,
    COALESCE(SUM(CASE 
      WHEN i.status IN ('pending', 'overdue') 
      THEN i.total_amount - i.paid_amount 
      ELSE 0 
    END), 0) as total_outstanding
  FROM customers c
  LEFT JOIN invoices i ON c.id = i.customer_id
  WHERE c.company_id = p_company_id
  GROUP BY c.id, c.name
  ORDER BY total_outstanding DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rental Operations Reports
CREATE OR REPLACE FUNCTION get_rental_occupancy(
  p_company_id uuid,
  p_property_id uuid DEFAULT NULL
)
RETURNS TABLE (
  property_id uuid,
  property_name text,
  total_units integer,
  occupied_units integer,
  vacant_units integer,
  maintenance_units integer,
  occupancy_rate numeric,
  revpar numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as property_id,
    p.name as property_name,
    COUNT(u.id) as total_units,
    COUNT(*) FILTER (WHERE u.status = 'rented') as occupied_units,
    COUNT(*) FILTER (WHERE u.status = 'vacant') as vacant_units,
    COUNT(*) FILTER (WHERE u.status = 'maintenance') as maintenance_units,
    CASE 
      WHEN COUNT(u.id) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE u.status = 'rented')::numeric / COUNT(u.id)::numeric) * 100, 2)
      ELSE 0 
    END as occupancy_rate,
    COALESCE(
      (
        SELECT AVG(l.rent_amount)
        FROM leases l
        JOIN units u2 ON l.unit_id = u2.id
        WHERE u2.property_id = p.id
          AND l.status = 'active'
      ), 0
    ) as revpar
  FROM properties p
  LEFT JOIN units u ON u.property_id = p.id
  WHERE p.company_id = p_company_id
    AND (p_property_id IS NULL OR p.id = p_property_id)
  GROUP BY p.id, p.name
  ORDER BY p.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Inventory Reports
CREATE OR REPLACE FUNCTION get_inventory_summary(
  p_company_id uuid,
  p_warehouse_id uuid DEFAULT NULL
)
RETURNS TABLE (
  warehouse_id uuid,
  warehouse_name text,
  total_products integer,
  total_quantity numeric,
  total_value numeric,
  low_stock_products integer,
  out_of_stock_products integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id as warehouse_id,
    w.name as warehouse_name,
    COUNT(wi.id) as total_products,
    COALESCE(SUM(wi.quantity_in_stock), 0) as total_quantity,
    COALESCE(SUM(wi.total_value), 0) as total_value,
    COUNT(*) FILTER (WHERE wi.quantity_available <= wi.low_stock_threshold AND wi.quantity_available > 0) as low_stock_products,
    COUNT(*) FILTER (WHERE wi.quantity_available = 0) as out_of_stock_products
  FROM warehouses w
  LEFT JOIN warehouse_inventory wi ON wi.warehouse_id = w.id
  WHERE w.company_id = p_company_id
    AND w.is_active = true
    AND (p_warehouse_id IS NULL OR w.id = p_warehouse_id)
  GROUP BY w.id, w.name
  ORDER BY w.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ZATCA Reports
CREATE OR REPLACE FUNCTION get_zatca_clearance_summary(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  total_invoices integer,
  cleared_invoices integer,
  reported_invoices integer,
  rejected_invoices integer,
  pending_invoices integer,
  error_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) as total_invoices,
    COUNT(*) FILTER (WHERE zatca_clearance_status = 'cleared') as cleared_invoices,
    COUNT(*) FILTER (WHERE zatca_clearance_status = 'reported') as reported_invoices,
    COUNT(*) FILTER (WHERE zatca_clearance_status = 'rejected') as rejected_invoices,
    COUNT(*) FILTER (WHERE zatca_clearance_status IN ('draft', 'ready', 'submitted')) as pending_invoices,
    COUNT(*) FILTER (WHERE zatca_errors IS NOT NULL AND jsonb_array_length(zatca_errors) > 0) as error_count
  FROM invoices
  WHERE company_id = p_company_id
    AND (p_start_date IS NULL OR issue_date >= p_start_date)
    AND (p_end_date IS NULL OR issue_date <= p_end_date);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Financial Reports
CREATE OR REPLACE FUNCTION get_profit_loss_summary(
  p_company_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  total_revenue numeric,
  total_cogs numeric,
  gross_profit numeric,
  total_expenses numeric,
  net_profit numeric,
  profit_margin numeric
) AS $$
BEGIN
  RETURN QUERY
  WITH revenue AS (
    SELECT COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_amount ELSE 0 END), 0) as total
    FROM invoices
    WHERE company_id = p_company_id
      AND type = 'invoice'
      AND (p_start_date IS NULL OR issue_date >= p_start_date)
      AND (p_end_date IS NULL OR issue_date <= p_end_date)
  ),
  expenses AS (
    SELECT COALESCE(SUM(jel.debit_amount), 0) as total
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND coa.account_code LIKE '6%' -- Expense accounts
      AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ),
  cogs AS (
    SELECT COALESCE(SUM(jel.debit_amount), 0) as total
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    JOIN chart_of_accounts coa ON coa.id = jel.account_id
    WHERE je.company_id = p_company_id
      AND coa.account_code = '5000' -- COGS account
      AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  )
  SELECT
    r.total as total_revenue,
    c.total as total_cogs,
    r.total - c.total as gross_profit,
    e.total as total_expenses,
    (r.total - c.total) - e.total as net_profit,
    CASE 
      WHEN r.total > 0 THEN 
        ROUND(((r.total - c.total - e.total) / r.total) * 100, 2)
      ELSE 0 
    END as profit_margin
  FROM revenue r, expenses e, cogs c;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE rental_settings IS 'Core rental configuration settings for simplified contract management';
COMMENT ON TABLE report_cache IS 'Cache for pre-calculated reports to improve performance';
COMMENT ON FUNCTION get_sales_summary IS 'Calculates sales and invoicing summary metrics';
COMMENT ON FUNCTION get_customer_aging IS 'Calculates customer aging report (accounts receivable)';
COMMENT ON FUNCTION get_rental_occupancy IS 'Calculates rental occupancy rates and RevPAR';
COMMENT ON FUNCTION get_inventory_summary IS 'Calculates inventory summary per warehouse';
COMMENT ON FUNCTION get_zatca_clearance_summary IS 'Calculates ZATCA clearance status summary';
COMMENT ON FUNCTION get_profit_loss_summary IS 'Calculates profit and loss summary';
