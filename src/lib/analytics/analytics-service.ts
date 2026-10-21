/**
 * Analytics & Reporting Service
 *
 * Centralized reporting module for all business domains:
 * - Sales & Invoicing Reports
 * - Customer & Tenant Reports
 * - Rental Operations Reports
 * - Inventory & Warehouse Reports
 * - ZATCA & Tax Reports
 * - Financial & Journal Reports
 */

import { supabase } from '../supabase';

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export interface SalesSummary {
  total_sales: number;
  total_invoices: number;
  paid_invoices: number;
  pending_invoices: number;
  overdue_invoices: number;
  credit_notes_count: number;
  tax_total: number;
}

export interface CustomerAging {
  customer_id: string;
  customer_name: string;
  current_amount: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
  total_outstanding: number;
}

export interface RentalOccupancy {
  property_id: string;
  property_name: string;
  total_units: number;
  occupied_units: number;
  vacant_units: number;
  maintenance_units: number;
  occupancy_rate: number;
  revpar: number;
}

export interface InventorySummary {
  warehouse_id: string;
  warehouse_name: string;
  total_products: number;
  total_quantity: number;
  total_value: number;
  low_stock_products: number;
  out_of_stock_products: number;
}

export interface ZatcaClearanceSummary {
  total_invoices: number;
  cleared_invoices: number;
  reported_invoices: number;
  rejected_invoices: number;
  pending_invoices: number;
  error_count: number;
}

export interface ProfitLossSummary {
  total_revenue: number;
  total_cogs: number;
  gross_profit: number;
  total_expenses: number;
  net_profit: number;
  profit_margin: number;
}

/**
 * Get Sales & Invoicing Summary
 */
export async function getSalesSummary(
  companyId: string,
  dateRange?: DateRange
): Promise<SalesSummary | null> {
  try {
    const { data, error } = await supabase.rpc('get_sales_summary', {
      p_company_id: companyId,
      p_start_date: dateRange?.startDate || null,
      p_end_date: dateRange?.endDate || null,
    });

    if (error) throw error;

    return data?.[0] || null;
  } catch (error) {
    console.error('Failed to get sales summary:', error);
    return null;
  }
}

/**
 * Get Customer Aging Report
 */
export async function getCustomerAging(companyId: string): Promise<CustomerAging[]> {
  try {
    const { data, error } = await supabase.rpc('get_customer_aging', {
      p_company_id: companyId,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get customer aging:', error);
    return [];
  }
}

/**
 * Get Rental Occupancy Report
 */
export async function getRentalOccupancy(
  companyId: string,
  propertyId?: string
): Promise<RentalOccupancy[]> {
  try {
    const { data, error } = await supabase.rpc('get_rental_occupancy', {
      p_company_id: companyId,
      p_property_id: propertyId || null,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get rental occupancy:', error);
    return [];
  }
}

/**
 * Get Inventory Summary
 */
export async function getInventorySummary(
  companyId: string,
  warehouseId?: string
): Promise<InventorySummary[]> {
  try {
    const { data, error } = await supabase.rpc('get_inventory_summary', {
      p_company_id: companyId,
      p_warehouse_id: warehouseId || null,
    });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get inventory summary:', error);
    return [];
  }
}

/**
 * Get ZATCA Clearance Summary
 */
export async function getZatcaClearanceSummary(
  companyId: string,
  dateRange?: DateRange
): Promise<ZatcaClearanceSummary | null> {
  try {
    const { data, error } = await supabase.rpc('get_zatca_clearance_summary', {
      p_company_id: companyId,
      p_start_date: dateRange?.startDate || null,
      p_end_date: dateRange?.endDate || null,
    });

    if (error) throw error;

    return data?.[0] || null;
  } catch (error) {
    console.error('Failed to get ZATCA clearance summary:', error);
    return null;
  }
}

/**
 * Get Profit & Loss Summary
 */
export async function getProfitLossSummary(
  companyId: string,
  dateRange?: DateRange
): Promise<ProfitLossSummary | null> {
  try {
    const { data, error } = await supabase.rpc('get_profit_loss_summary', {
      p_company_id: companyId,
      p_start_date: dateRange?.startDate || null,
      p_end_date: dateRange?.endDate || null,
    });

    if (error) throw error;

    return data?.[0] || null;
  } catch (error) {
    console.error('Failed to get profit loss summary:', error);
    return null;
  }
}

/**
 * Get detailed invoice data for reports
 */
export async function getInvoiceReportData(
  companyId: string,
  dateRange?: DateRange,
  status?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('invoices')
      .select(`
        *,
        customer:customers(id, name, email),
        invoice_items:invoice_items(*)
      `)
      .eq('company_id', companyId)
      .order('issue_date', { ascending: false });

    if (dateRange?.startDate) {
      query = query.gte('issue_date', dateRange.startDate);
    }
    if (dateRange?.endDate) {
      query = query.lte('issue_date', dateRange.endDate);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get invoice report data:', error);
    return [];
  }
}

/**
 * Get detailed lease data for reports
 */
export async function getLeaseReportData(
  companyId: string,
  status?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('leases')
      .select(`
        *,
        unit:units(id, unit_number, property_id),
        property:properties(id, name)
      `)
      .eq('tenant_id', companyId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('Failed to get lease report data:', error);
    return [];
  }
}

/**
 * Clean expired report cache
 */
export async function cleanReportCache(): Promise<void> {
  try {
    await supabase.rpc('clean_expired_report_cache');
  } catch (error) {
    console.error('Failed to clean report cache:', error);
  }
}

/**
 * Get cached report data if available
 */
export async function getCachedReport(
  companyId: string,
  reportType: string,
  reportKey: string
): Promise<any | null> {
  try {
    const { data, error } = await supabase
      .from('report_cache')
      .select('report_data, expires_at')
      .eq('company_id', companyId)
      .eq('report_type', reportType)
      .eq('report_key', reportKey)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;

    return data.report_data;
  } catch (error) {
    return null;
  }
}

/**
 * Cache report data
 */
export async function cacheReport(
  companyId: string,
  reportType: string,
  reportKey: string,
  reportData: any,
  expiresInSeconds: number = 300
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    await supabase
      .from('report_cache')
      .upsert({
        company_id: companyId,
        report_type: reportType,
        report_key: reportKey,
        report_data: reportData,
        expires_at: expiresAt,
      });
  } catch (error) {
    console.error('Failed to cache report:', error);
  }
}
