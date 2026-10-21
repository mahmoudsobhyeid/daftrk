export type CompanyRole = 'owner' | 'member';

export type TeamRole = 'owner' | 'accountant' | 'employee' | 'custom' | 'admin' | 'agent';
export type PropertyType = 'building' | 'apartment' | 'commercial';
export type UnitStatus = 'vacant' | 'rented';
export type PaymentFrequency = 'monthly' | 'quarterly' | 'yearly';
export type MaintenanceResponsibility = 'landlord' | 'tenant' | 'shared';
export type LeaseStatus = 'draft' | 'active' | 'expired' | 'terminated';
export type InstallmentStatus = 'pending' | 'paid' | 'overdue';
export type REInvoiceStatus = 'paid' | 'unpaid' | 'overdue';

export type LemonSubscriptionStatus = 'active' | 'past_due' | 'cancelled';

export interface LemonSubscription {
  id: string;
  tenant_id: string;
  lemon_subscription_id: string;
  status: LemonSubscriptionStatus;
  variant_id: string | null;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: TeamRole;
  created_at: string;
  email?: string | null;
  full_name?: string | null;
  permissions?: PermissionSet;
}

export type PermissionModule =
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'customers'
  | 'suppliers'
  | 'invoices'
  | 'expenses'
  | 'reports'
  | 'user_management';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type PermissionSet = Partial<Record<PermissionModule, Partial<Record<PermissionAction, boolean>>>>;

export interface RolePermissions {
  role: TeamRole;
  permissions: PermissionSet;
}

export interface Property {
  id: string;
  tenant_id: string;
  name: string;
  type: PropertyType;
  address: string | null;
  created_at: string;
}

export interface Unit {
  id: string;
  tenant_id: string;
  property_id: string;
  unit_number: string;
  rent_amount: number;
  status: UnitStatus;
  created_at: string;
  property?: Pick<Property, 'id' | 'name' | 'type'> | null;
}

export interface Lease {
  id: string;
  tenant_id: string;
  unit_id: string;
  tenant_name: string;
  tenant_phone: string | null;
  start_date: string;
  end_date: string;
  rent_amount: number;
  payment_frequency: PaymentFrequency;
  contract_number: string | null;
  lessor_name: string | null;
  lessor_phone: string | null;
  lessor_id_number: string | null;
  tenant_id_number: string | null;
  tenant_email: string | null;
  maintenance_responsibility: MaintenanceResponsibility;
  security_deposit: number;
  status: LeaseStatus;
  notes: string | null;
  created_at: string;
  unit?: Pick<Unit, 'id' | 'unit_number'> | null;
}

export interface LeaseInstallment {
  id: string;
  lease_id: string;
  installment_number: number;
  due_date: string;
  amount: number;
  status: InstallmentStatus;
  paid_date: string | null;
  created_at: string;
}

export interface REInvoice {
  id: string;
  tenant_id: string;
  lease_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  status: REInvoiceStatus;
  qr_code_data: string | null;
  created_at: string;
  lease?: Pick<Lease, 'id' | 'tenant_name' | 'tenant_phone'> | null;
}

export type UserRole = 'super_admin' | 'tenant_owner' | 'employee';

export interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  avatar_path: string | null;
  account_id: string | null;
  role: UserRole;
  is_platform_admin: boolean;
  notify_invoice_paid: boolean;
  notify_invoice_overdue: boolean;
  notify_new_customer: boolean;
  notify_low_stock: boolean;
  notify_marketing: boolean;
  updated_at: string;
}
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceReturnStatus = 'partially_returned' | 'fully_returned' | null;
export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'cancelled' | 'past_due';
export type PlanId = 'free_trial' | 'starter' | 'pro' | 'business' | 'enterprise';

export type ZatcaClearanceStatus = 'draft' | 'ready' | 'submitted' | 'cleared' | 'reported' | 'rejected' | 'cancelled' | 'expired';
export type ZatcaSubmissionStatus = 'not_submitted' | 'pending' | 'accepted' | 'rejected' | 'failed';

export interface Plan {
  id: PlanId;
  name: string;
  name_ar: string | null;
  price_monthly: number;
  price_yearly: number;
  max_customers: number | null;
  max_products: number | null;
  max_invoices: number | null;
  features: string[];
  highlight: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: string;
  company_id: string;
  plan_id: PlanId;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string | null;
  amount_paid: number;
  payment_reference: string | null;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  account_id: string | null;
  name: string;
  name_ar: string | null;
  business_type: string | null;
  country: string | null;
  language: string | null;
  timezone: string | null;
  tax_number: string | null;
  commercial_registration: string | null;
  address: string | null;
  street_name: string | null;
  short_address: string | null;
  city: string | null;
  city_ar: string | null;
  postal_code: string | null;
  building_number: string | null;
  additional_number: string | null;
  district: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  logo_url: string | null;
  logo_path: string | null;
  currency: string;
  invoice_prefix: string;
  invoice_footer: string | null;
  invoice_theme: string;
  primary_color: string;
  invoice_customization?: any;
  owner_id: string;
  created_at: string;
  is_suspended: boolean;
  suspension_reason: string | null;
}

export interface CompanyMember {
  id: string;
  company_id: string;
  user_id: string;
  role: CompanyRole;
  created_at: string;
}

export type CustomerStatus = 'active' | 'inactive';

export interface Customer {
  id: string;
  company_id: string;
  name: string;
  name_ar: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  postal_code: string | null;
  building_number: string | null;
  district: string | null;
  cr_number: string | null;
  tax_number: string | null;
  notes: string | null;
  status: CustomerStatus;
  created_at: string;
}

export type ProductStatus = 'active' | 'inactive';

export interface Product {
  id: string;
  company_id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  price: number;
  cost: number;
  tax_rate: number;
  unit: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  stock_quantity: number;
  min_stock: number;
  image_path: string | null;
  default_warehouse_id: string | null;
  status: ProductStatus;
  created_at: string;
}

export interface Invoice {
  id: string;
  company_id: string;
  customer_id: string;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  template: string;
  share_token: string;
  created_at: string;
  // ZATCA Phase 2 fields
  uuid?: string | null;
  icv?: number | null;
  invoice_type?: string | null;
  invoice_type_code?: string | null;
  invoice_subtype?: string | null;
  issue_time?: string | null;
  delivery_date?: string | null;
  reference_number?: string | null;
  purchase_order?: string | null;
  salesperson?: string | null;
  currency_code?: string | null;
  exchange_rate?: number | null;
  payment_means_code?: string | null;
  payment_account_id?: string | null;
  zatca_hash?: string | null;
  zatca_prev_hash?: string | null;
  zatca_qr_data?: string | null;
  zatca_xml?: string | null;
  zatca_signature?: string | null;
  zatca_clearance_status?: ZatcaClearanceStatus | null;
  zatca_submission_status?: ZatcaSubmissionStatus | null;
  zatca_submission_time?: string | null;
  zatca_clearance_uuid?: string | null;
  zatca_response_code?: number | null;
  zatca_warnings?: unknown[] | null;
  zatca_errors?: unknown[] | null;
  is_locked?: boolean | null;
  return_status?: InvoiceReturnStatus;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number;
  // ZATCA Phase 2 fields
  sku?: string | null;
  unit?: string | null;
  tax_category?: string | null;
  tax_exemption_reason_code?: string | null;
  tax_exemption_reason?: string | null;
  vat_amount?: number | null;
  net_amount?: number | null;
  gross_amount?: number | null;
}

export interface InvoiceWithCustomer extends Invoice {
  customer: Pick<Customer, 'id' | 'name' | 'name_ar' | 'email'> | null;
}

export interface InvoiceWithDetails extends Invoice {
  customer: Pick<Customer, 'id' | 'name' | 'name_ar' | 'email' | 'phone' | 'address' | 'tax_number'> | null;
  items: InvoiceItem[];
}

export interface InvoiceReturn {
  id: string;
  company_id: string;
  invoice_id: string;
  return_number: string;
  return_type: 'full' | 'partial';
  subtotal: number;
  tax_total: number;
  total: number;
  created_by: string;
  created_at: string;
}

export interface InvoiceReturnItem {
  id: string;
  return_id: string;
  invoice_item_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  line_total: number;
}

export interface InvoiceReturnWithItems extends InvoiceReturn {
  items: InvoiceReturnItem[];
  created_by_email?: string | null;
}

export interface InvoiceReturnAuditEntry {
  id: string;
  company_id: string;
  return_id: string | null;
  invoice_id: string;
  action: string;
  details: Record<string, unknown> | null;
  performed_by: string;
  performed_by_email?: string | null;
  created_at: string;
}

/** Unified shape for InvoiceTemplate (covers both authenticated and public views) */
export interface InvoiceRenderData {
  id: string;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string | null;
  terms: string | null;
  template: string;
  customization?: any;
  share_token: string;
  // ZATCA fields
  uuid?: string | null;
  icv?: number | null;
  invoice_type?: string | null;
  zatca_qr_data?: string | null;
  zatca_hash?: string | null;
  zatca_clearance_status?: ZatcaClearanceStatus | null;
  zatca_submission_status?: ZatcaSubmissionStatus | null;
  is_locked?: boolean | null;
  company: {
    id: string;
    name: string;
    name_ar: string | null;
    address: string | null;
    city?: string | null;
    city_ar?: string | null;
    postal_code?: string | null;
    building_number?: string | null;
    additional_number?: string | null;
    district?: string | null;
    phone: string | null;
    email: string | null;
    tax_number: string | null;
    commercial_registration?: string | null;
    logo_path: string | null;
    currency: string;
    primary_color: string;
    invoice_footer: string | null;
    invoice_customization?: any;
  };
  customer: {
    id: string;
    name: string;
    name_ar: string | null;
    address: string | null;
    city?: string | null;
    phone: string | null;
    email: string | null;
    tax_number: string | null;
    cr_number?: string | null;
  } | null;
  items: {
    id: string;
    description: string;
    quantity: number;
    unit_price: number;
    discount: number;
    tax_rate: number;
    line_total: number;
    unit?: string | null;
    tax_category?: string | null;
    vat_amount?: number | null;
    net_amount?: number | null;
  }[];
}

// ─── Multi-Warehouse Management Types ───────────────────────
export type WarehouseStatus = 'active' | 'inactive';
export type WarehouseType = 'main' | 'branch' | 'transit' | 'store' | 'virtual';

export interface Warehouse {
  id: string;
  company_id: string;
  name: string;
  code: string | null;
  location: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  postal_code: string | null;
  country: string | null;
  warehouse_type: WarehouseType;
  is_active: boolean;
  is_default: boolean;
  capacity_units: number | null;
  capacity_volume: number | null;
  notes: string | null;
  manager_name: string | null;
  manager_phone: string | null;
  manager_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarehouseInventory {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  quantity_in_stock: number;
  quantity_reserved: number;
  quantity_available: number;
  low_stock_threshold: number | null;
  reorder_quantity: number | null;
  reorder_point: number | null;
  average_cost?: number;
  batch_number?: string | null;
  lot_number?: string | null;
  expiry_date?: string | null;
  updated_at: string;
  warehouse?: Warehouse;
  product?: Product;
}

export type StockTransferStatus = 'draft' | 'pending' | 'dispatched' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransfer {
  id: string;
  company_id: string;
  transfer_number: string;
  source_warehouse_id: string;
  destination_warehouse_id: string;
  status: StockTransferStatus;
  transfer_date: string;
  expected_delivery_date?: string | null;
  actual_delivery_date?: string | null;
  notes: string | null;
  reason: string | null;
  created_by?: string | null;
  dispatched_at?: string | null;
  received_at?: string | null;
  created_at: string;
  updated_at: string;
  source_warehouse?: Warehouse;
  destination_warehouse?: Warehouse;
  lines?: StockTransferLine[];
}

export interface StockTransferLine {
  id: string;
  stock_transfer_id: string;
  product_id: string;
  quantity_requested: number;
  quantity_dispatched: number;
  quantity_received: number;
  unit_cost: number;
  notes?: string | null;
  product?: Product;
}

export interface StockMovement {
  id: string;
  company_id: string;
  warehouse_id: string;
  product_id: string;
  movement_type: string;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  unit_cost: number;
  reference_type: string | null;
  reference_id?: string | null;
  reference_number: string | null;
  notes: string | null;
  performed_by?: string | null;
  movement_date: string;
  created_at?: string;
  warehouse?: Warehouse;
  product?: Product;
}

