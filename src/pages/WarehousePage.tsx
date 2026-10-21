import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useCompany } from '../contexts/CompanyContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  Warehouse as WarehouseIcon,
  Package,
  ArrowRightLeft,
  BarChart3,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  Building2,
  MapPin,
  User,
  Phone,
  Mail,
  CheckCircle2,
  Clock,
  Send,
  Boxes,
  DollarSign,
  Layers,
  SlidersHorizontal,
  RefreshCw,
  AlertTriangle,
  Flame,
  Snowflake,
  Database,
  Copy,
  Check,
} from 'lucide-react';
import {
  WarehouseDataService,
  checkWarehousesTableExists,
  WAREHOUSE_MIGRATION_SQL,
} from '../lib/warehouse-resilient-store';
import type {
  Warehouse,
  WarehouseInventory,
  StockTransfer,
  StockMovement,
  Product,
} from '../lib/types';

type ActiveTab = 'warehouses' | 'inventory' | 'transfers' | 'reports';

interface WarehouseFormState {
  name: string;
  code: string;
  is_active: boolean;
  warehouse_type: 'main' | 'branch' | 'transit' | 'store' | 'virtual';
  location: string;
  address: string;
  city: string;
  district: string;
  manager_name: string;
  manager_phone: string;
  manager_email: string;
  capacity_units: string;
  notes: string;
  is_default: boolean;
}

const emptyWarehouseForm: WarehouseFormState = {
  name: '',
  code: '',
  is_active: true,
  warehouse_type: 'branch',
  location: '',
  address: '',
  city: '',
  district: '',
  manager_name: '',
  manager_phone: '',
  manager_email: '',
  capacity_units: '',
  notes: '',
  is_default: false,
};

interface TransferFormState {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  product_id: string;
  quantity: string;
  transfer_date: string;
  reason: string;
  notes: string;
}

const emptyTransferForm: TransferFormState = {
  source_warehouse_id: '',
  destination_warehouse_id: '',
  product_id: '',
  quantity: '1',
  transfer_date: new Date().toISOString().slice(0, 10),
  reason: 'Branch rebalancing',
  notes: '',
};

interface AdjustStockFormState {
  inventory_id: string;
  warehouse_id: string;
  product_id: string;
  product_name: string;
  current_quantity: number;
  change_type: 'add' | 'remove';
  change_amount: string;
  reason: string;
  notes: string;
}

interface ProductSalesStats {
  product_id: string;
  product_name: string;
  sku: string;
  total_units_sold: number;
  total_revenue: number;
  current_stock: number;
  stock_value: number;
}

export function WarehousePage() {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const { user } = useAuth();
  const { toast } = useToast();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();

  // Active Tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('warehouses');

  // Core Data
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [inventory, setInventory] = useState<WarehouseInventory[]>([]);
  const [transfers, setTransfers] = useState<StockTransfer[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [salesStats, setSalesStats] = useState<ProductSalesStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [warehouseSearch, setWarehouseSearch] = useState('');
  const [warehouseStatusFilter, setWarehouseStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryStockFilter, setInventoryStockFilter] = useState<'all' | 'low' | 'out'>('all');

  const [transfersSubTab, setTransfersSubTab] = useState<'transfers' | 'movements'>('transfers');
  const [transferSearch, setTransferSearch] = useState('');
  const [movementSearch, setMovementSearch] = useState('');

  // Modals
  const [warehouseModalOpen, setWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [warehouseForm, setWarehouseForm] = useState<WarehouseFormState>(emptyWarehouseForm);
  const [warehouseSaving, setWarehouseSaving] = useState(false);

  const [deleteWarehouseTarget, setDeleteWarehouseTarget] = useState<Warehouse | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Add Product to Warehouse Modal
  const [addInventoryModalOpen, setAddInventoryModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<WarehouseInventory | null>(null);
  const [inventoryForm, setInventoryForm] = useState({
    warehouse_id: '',
    product_id: '',
    quantity_in_stock: '0',
    low_stock_threshold: '5',
    reorder_point: '10',
    reorder_quantity: '20',
  });
  const [inventorySaving, setInventorySaving] = useState(false);

  // Quick Stock Adjustment Modal
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState<AdjustStockFormState | null>(null);
  const [adjustSaving, setAdjustSaving] = useState(false);

  // Stock Transfer Modal
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferFormState>(emptyTransferForm);
  const [transferSaving, setTransferSaving] = useState(false);
  // Fallback storage mode state & SQL modal
  const [isFallbackMode, setIsFallbackMode] = useState(false);
  const [showSqlModal, setShowSqlModal] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);
  const [checkingDb, setCheckingDb] = useState(false);

  const handleCopySql = () => {
    navigator.clipboard.writeText(WAREHOUSE_MIGRATION_SQL);
    setSqlCopied(true);
    setTimeout(() => setSqlCopied(false), 3000);
    toast(lang === 'ar' ? 'تم نسخ كود SQL إلى الحافظة' : 'SQL copied to clipboard', 'success');
  };

  const handleRecheckDatabase = async () => {
    if (!company?.id) return;
    setCheckingDb(true);
    try {
      const exists = await checkWarehousesTableExists(company.id);
      if (exists) {
        const service = new WarehouseDataService(company.id);
        const syncRes = await service.syncLocalDataToSupabase();
        setIsFallbackMode(false);
        setShowSqlModal(false);
        toast(
          lang === 'ar'
            ? `تم الاتصال بنجاح بـ Supabase! ${syncRes.syncedWarehouses > 0 ? `تمت مزامنة ${syncRes.syncedWarehouses} مستودع.` : 'جداول المستودعات جاهزة.'}`
            : `Connected to Supabase! ${syncRes.syncedWarehouses > 0 ? `Synced ${syncRes.syncedWarehouses} warehouses.` : 'Warehouse tables ready.'}`,
          'success'
        );
        await loadAllData();
      } else {
        toast(
          lang === 'ar'
            ? 'لم يتم العثور على جداول المستودعات في Supabase بعد. يرجى تشغيل كود SQL في SQL Editor ثم إعادة الفحص.'
            : 'Warehouse tables still not found in Supabase. Please run the SQL migration in SQL Editor.',
          'warning'
        );
      }
    } catch (err: any) {
      toast(err.message || 'Error checking database', 'error');
    } finally {
      setCheckingDb(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    if (!company?.id) return;
    setLoading(true);

    try {
      const service = new WarehouseDataService(company.id);

      // 1. Fetch Warehouses (auto-falls back if table missing from schema cache)
      const { data: loadedWarehouses, isFallback: whFallback } = await service.getWarehouses();
      setIsFallbackMode(whFallback);
      setWarehouses(loadedWarehouses);

      // 2. Fetch Products
      const { data: prodData } = await supabase
        .from('products')
        .select('*')
        .eq('company_id', company.id)
        .eq('status', 'active')
        .order('name');
      const loadedProducts = (prodData as Product[]) || [];
      setProducts(loadedProducts);

      // 3. Fetch Inventory
      const { data: loadedInventory } = await service.getInventory(loadedWarehouses, loadedProducts);
      setInventory(loadedInventory);

      // 4. Fetch Stock Transfers
      const { data: loadedTransfers } = await service.getTransfers(loadedWarehouses, loadedProducts);
      setTransfers(loadedTransfers);

      // 5. Fetch Stock Movements (Audit Trail / Cardex)
      const { data: loadedMovements } = await service.getMovements(loadedWarehouses, loadedProducts);
      setMovements(loadedMovements);

      // 6. Fetch Sales Data for Product Performance Reports (Best-Selling vs. Least-Selling)
      const { data: invoiceItems } = await supabase
        .from('invoice_items')
        .select(`
          product_id,
          quantity,
          line_total,
          invoice:invoices!inner(company_id, status)
        `)
        .eq('invoice.company_id', company.id)
        .neq('invoice.status', 'cancelled');

      // Aggregate sales
      const salesMap: Record<string, { qty: number; rev: number }> = {};
      (invoiceItems || []).forEach((item: any) => {
        if (!item.product_id) return;
        if (!salesMap[item.product_id]) {
          salesMap[item.product_id] = { qty: 0, rev: 0 };
        }
        salesMap[item.product_id].qty += Number(item.quantity) || 0;
        salesMap[item.product_id].rev += Number(item.line_total) || 0;
      });

      // Calculate total stock per product across warehouses
      const productStockMap: Record<string, number> = {};
      loadedInventory.forEach((inv) => {
        productStockMap[inv.product_id] = (productStockMap[inv.product_id] || 0) + Number(inv.quantity_in_stock || 0);
      });

      const stats: ProductSalesStats[] = loadedProducts.map((p) => {
        const sales = salesMap[p.id] || { qty: 0, rev: 0 };
        const stock = productStockMap[p.id] ?? Number(p.stock_quantity || 0);
        return {
          product_id: p.id,
          product_name: p.name,
          sku: p.sku || '—',
          total_units_sold: sales.qty,
          total_revenue: sales.rev,
          current_stock: stock,
          stock_value: stock * Number(p.price || 0),
        };
      });
      setSalesStats(stats);
    } catch (err) {
      console.error('Error loading warehouse data:', err);
      toast(t('common.error'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [company?.id, lang, t, toast]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
  };

  // ─────────────────────────────────────────────────────────
  // Warehouse CRUD Actions
  // ─────────────────────────────────────────────────────────
  const openAddWarehouseModal = () => {
    setEditingWarehouse(null);
    setWarehouseForm({
      ...emptyWarehouseForm,
      code: `WH-0${warehouses.length + 1}`,
    });
    setWarehouseModalOpen(true);
  };

  const openEditWarehouseModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setWarehouseForm({
      name: wh.name,
      code: wh.code || '',
      is_active: wh.is_active,
      warehouse_type: wh.warehouse_type || 'branch',
      location: wh.location || '',
      address: wh.address || '',
      city: wh.city || '',
      district: wh.district || '',
      manager_name: wh.manager_name || '',
      manager_phone: wh.manager_phone || '',
      manager_email: wh.manager_email || '',
      capacity_units: wh.capacity_units ? wh.capacity_units.toString() : '',
      notes: wh.notes || '',
      is_default: wh.is_default,
    });
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;
    if (!warehouseForm.name.trim()) {
      toast(lang === 'ar' ? 'اسم المستودع مطلوب' : 'Warehouse name is required', 'error');
      return;
    }

    setWarehouseSaving(true);
    try {
      const payload = {
        company_id: company.id,
        name: warehouseForm.name.trim(),
        code: warehouseForm.code.trim() || null,
        is_active: warehouseForm.is_active,
        warehouse_type: warehouseForm.warehouse_type,
        location: warehouseForm.location.trim() || null,
        address: warehouseForm.address.trim() || null,
        city: warehouseForm.city.trim() || null,
        district: warehouseForm.district.trim() || null,
        manager_name: warehouseForm.manager_name.trim() || null,
        manager_phone: warehouseForm.manager_phone.trim() || null,
        manager_email: warehouseForm.manager_email.trim() || null,
        capacity_units: warehouseForm.capacity_units ? parseInt(warehouseForm.capacity_units, 10) : null,
        notes: warehouseForm.notes.trim() || null,
        is_default: warehouseForm.is_default,
        updated_at: new Date().toISOString(),
      };

      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);

      const { isFallback } = await service.saveWarehouse(payload, editingWarehouse?.id);
      if (isFallback) {
        setIsFallbackMode(true);
      }

      toast(
        editingWarehouse
          ? (lang === 'ar' ? 'تم تحديث بيانات المستودع بنجاح' : 'Warehouse updated successfully')
          : isFallback
            ? (lang === 'ar' ? 'تم حفظ المستودع بنجاح (في وضع التخزين الذكي)' : 'Warehouse created successfully (resilient mode)')
            : (lang === 'ar' ? 'تم إنشاء المستودع الجديد بنجاح في Supabase' : 'Warehouse created successfully in Supabase'),
        'success'
      );

      setWarehouseModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      console.error('Failed to save warehouse:', err);
      toast(err.message || t('common.error'), 'error');
    } finally {
      setWarehouseSaving(false);
    }
  };

  const handleToggleWarehouseStatus = async (wh: Warehouse) => {
    if (!company?.id) return;
    try {
      const nextStatus = !wh.is_active;
      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);
      await service.toggleWarehouseStatus(wh.id, nextStatus);

      setWarehouses((prev) =>
        prev.map((item) => (item.id === wh.id ? { ...item, is_active: nextStatus } : item))
      );
      toast(
        nextStatus
          ? (lang === 'ar' ? 'تم تفعيل المستودع' : 'Warehouse activated')
          : (lang === 'ar' ? 'تم تعطيل المستودع' : 'Warehouse deactivated'),
        'success'
      );
    } catch (err: any) {
      toast(err.message || t('common.error'), 'error');
    }
  };

  const requestDeleteWarehouse = (wh: Warehouse) => {
    if (wh.is_default) {
      toast(
        lang === 'ar'
          ? 'لا يمكن حذف المستودع الافتراضي للمنشأة'
          : 'Cannot delete the default warehouse',
        'error'
      );
      return;
    }

    // Check if warehouse has stock
    const stockInWh = inventory.filter(
      (inv) => inv.warehouse_id === wh.id && Number(inv.quantity_in_stock || inv.quantity_on_hand) > 0
    );

    if (stockInWh.length > 0) {
      setDeleteWarning(
        lang === 'ar'
          ? `المستودع يحتوي على ${stockInWh.length} صنف بمجموع كميات ${stockInWh.reduce((a, b) => a + Number(b.quantity_in_stock || b.quantity_on_hand || 0), 0)} وحدة. لا يمكن حذفه حتى يتم نقل المخزون.`
          : `Warehouse contains ${stockInWh.length} products in stock. You must transfer or clear stock before deleting.`
      );
    } else {
      setDeleteWarning(null);
    }
    setDeleteWarehouseTarget(wh);
  };

  const confirmDeleteWarehouse = async () => {
    if (!deleteWarehouseTarget || !company?.id) return;
    try {
      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);
      await service.deleteWarehouse(deleteWarehouseTarget.id);

      toast(lang === 'ar' ? 'تم حذف المستودع بنجاح' : 'Warehouse deleted successfully', 'success');
      setDeleteWarehouseTarget(null);
      await loadAllData();
    } catch (err: any) {
      toast(err.message || t('common.error'), 'error');
    }
  };

  // ─────────────────────────────────────────────────────────
  // Inventory by Warehouse Actions
  // ─────────────────────────────────────────────────────────
  const openAddInventoryModal = (defaultWhId?: string) => {
    setEditingInventory(null);
    setInventoryForm({
      warehouse_id: defaultWhId || warehouses[0]?.id || '',
      product_id: products[0]?.id || '',
      quantity_in_stock: '0',
      low_stock_threshold: '5',
      reorder_point: '10',
      reorder_quantity: '20',
    });
    setAddInventoryModalOpen(true);
  };

  const openEditInventoryModal = (item: WarehouseInventory) => {
    setEditingInventory(item);
    setInventoryForm({
      warehouse_id: item.warehouse_id,
      product_id: item.product_id,
      quantity_in_stock: item.quantity_in_stock.toString(),
      low_stock_threshold: item.low_stock_threshold ? item.low_stock_threshold.toString() : '',
      reorder_point: item.reorder_point ? item.reorder_point.toString() : '',
      reorder_quantity: item.reorder_quantity ? item.reorder_quantity.toString() : '',
    });
    setAddInventoryModalOpen(true);
  };

  const handleSaveInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !inventoryForm.warehouse_id || !inventoryForm.product_id) return;

    setInventorySaving(true);
    try {
      const qty = parseFloat(inventoryForm.quantity_in_stock) || 0;
      const threshold = inventoryForm.low_stock_threshold ? parseFloat(inventoryForm.low_stock_threshold) : null;
      const reorderPt = inventoryForm.reorder_point ? parseFloat(inventoryForm.reorder_point) : null;
      const reorderQty = inventoryForm.reorder_quantity ? parseFloat(inventoryForm.reorder_quantity) : null;

      const payload = {
        company_id: company.id,
        warehouse_id: inventoryForm.warehouse_id,
        product_id: inventoryForm.product_id,
        quantity_in_stock: qty,
        quantity_available: qty,
        low_stock_threshold: threshold,
        reorder_point: reorderPt,
        reorder_quantity: reorderQty,
        updated_at: new Date().toISOString(),
      };

      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);

      await service.saveInventory(payload, editingInventory?.id);
      toast(
        editingInventory
          ? (lang === 'ar' ? 'تم تحديث المخزون بنجاح' : 'Inventory updated successfully')
          : (lang === 'ar' ? 'تم ربط المنتج بالمستودع وإضافة المخزون' : 'Product linked to warehouse'),
        'success'
      );

      setAddInventoryModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      toast(err.message || t('common.error'), 'error');
    } finally {
      setInventorySaving(false);
    }
  };

  const openAdjustStockModal = (item: WarehouseInventory) => {
    setAdjustForm({
      inventory_id: item.id,
      warehouse_id: item.warehouse_id,
      product_id: item.product_id,
      product_name: item.product?.name || 'Product',
      current_quantity: Number(item.quantity_in_stock || 0),
      change_type: 'add',
      change_amount: '1',
      reason: 'Physical Count Adjustment',
      notes: '',
    });
    setAdjustModalOpen(true);
  };

  const handleSaveStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id || !adjustForm) return;

    const amount = parseFloat(adjustForm.change_amount) || 0;
    if (amount <= 0) {
      toast(lang === 'ar' ? 'أدخل كمية صحيحة أكبر من الصفر' : 'Enter a quantity greater than zero', 'error');
      return;
    }

    const netChange = adjustForm.change_type === 'add' ? amount : -amount;
    const newQuantity = adjustForm.current_quantity + netChange;
    if (newQuantity < 0) {
      toast(lang === 'ar' ? 'لا يمكن تقليل المخزون إلى ما دون الصفر' : 'Stock cannot drop below zero', 'error');
      return;
    }

    setAdjustSaving(true);
    try {
      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);

      await service.adjustStock({
        inventory_id: adjustForm.inventory_id,
        warehouse_id: adjustForm.warehouse_id,
        product_id: adjustForm.product_id,
        current_quantity: adjustForm.current_quantity,
        netChange,
        newQuantity,
        reason: adjustForm.reason,
        notes: adjustForm.notes,
        change_type: adjustForm.change_type,
        userId: user?.id,
      });

      toast(lang === 'ar' ? 'تم تعديل المخزون وتسجيل الحركة بنجاح' : 'Stock adjusted and logged', 'success');
      setAdjustModalOpen(false);
      setAdjustForm(null);
      await loadAllData();
    } catch (err: any) {
      toast(err.message || t('common.error'), 'error');
    } finally {
      setAdjustSaving(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Stock Transfer Actions
  // ─────────────────────────────────────────────────────────
  const openNewTransferModal = (prefillSourceWhId?: string, prefillProdId?: string) => {
    const defaultSource = prefillSourceWhId || warehouses[0]?.id || '';
    const defaultDest = warehouses.find((w) => w.id !== defaultSource)?.id || '';

    setTransferForm({
      source_warehouse_id: defaultSource,
      destination_warehouse_id: defaultDest,
      product_id: prefillProdId || products[0]?.id || '',
      quantity: '1',
      transfer_date: new Date().toISOString().slice(0, 10),
      reason: 'Branch rebalancing',
      notes: '',
    });
    setTransferModalOpen(true);
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company?.id) return;

    if (transferForm.source_warehouse_id === transferForm.destination_warehouse_id) {
      toast(
        lang === 'ar'
          ? 'يجب أن يكون مستودع المصدر مختلفاً عن مستودع الوجهة'
          : 'Source and destination warehouses must be different',
        'error'
      );
      return;
    }

    const qty = parseFloat(transferForm.quantity) || 0;
    if (qty <= 0) {
      toast(lang === 'ar' ? 'أدخل كمية تحويل صالحة' : 'Enter a valid transfer quantity', 'error');
      return;
    }

    // Check available quantity in source warehouse
    const sourceInv = inventory.find(
      (inv) =>
        inv.warehouse_id === transferForm.source_warehouse_id &&
        inv.product_id === transferForm.product_id
    );
    const available = Number(sourceInv?.quantity_available || 0);

    if (qty > available) {
      toast(
        lang === 'ar'
          ? `الكمية المتوفرة في مستودع المصدر (${available}) أقل من الكمية المطلوبة للتحويل (${qty})`
          : `Available quantity (${available}) is less than transfer quantity (${qty})`,
        'error'
      );
      return;
    }

    setTransferSaving(true);
    try {
      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);

      await service.createTransfer(
        {
          source_warehouse_id: transferForm.source_warehouse_id,
          destination_warehouse_id: transferForm.destination_warehouse_id,
          product_id: transferForm.product_id,
          quantity: qty,
          transfer_date: transferForm.transfer_date,
          reason: transferForm.reason,
        },
        warehouses,
        products
      );

      toast(
        lang === 'ar'
          ? 'تم إنشاء التحويل المخزني وجاري نقله بنجاح'
          : 'Stock transfer dispatched successfully',
        'success'
      );
      setTransferModalOpen(false);
      await loadAllData();
    } catch (err: any) {
      toast(err.message || t('common.error'), 'error');
    } finally {
      setTransferSaving(false);
    }
  };

  const handleReceiveTransfer = async (transfer: StockTransfer) => {
    if (!company?.id) return;
    try {
      const line = transfer.lines?.[0];
      if (!line) {
        toast('No transfer items found', 'error');
        return;
      }

      const service = new WarehouseDataService(company.id);
      service.setFallbackMode(isFallbackMode);
      await service.receiveTransfer(transfer, user?.id, inventory);

      toast(
        lang === 'ar'
          ? 'تم استلام الشحنة وإضافتها لمخزون المستودع بنجاح'
          : 'Transfer marked as received and stock updated',
        'success'
      );
      await loadAllData();
    } catch (err: any) {
      toast(err.message || t('common.error'), 'error');
    }
  };

  // ─────────────────────────────────────────────────────────
  // Filtered Lists & Analytics Computations
  // ─────────────────────────────────────────────────────────
  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((wh) => {
      const matchSearch =
        wh.name.toLowerCase().includes(warehouseSearch.toLowerCase()) ||
        (wh.code && wh.code.toLowerCase().includes(warehouseSearch.toLowerCase())) ||
        (wh.city && wh.city.toLowerCase().includes(warehouseSearch.toLowerCase())) ||
        (wh.manager_name && wh.manager_name.toLowerCase().includes(warehouseSearch.toLowerCase()));

      const matchStatus =
        warehouseStatusFilter === 'all'
          ? true
          : warehouseStatusFilter === 'active'
          ? wh.is_active
          : !wh.is_active;

      return matchSearch && matchStatus;
    });
  }, [warehouses, warehouseSearch, warehouseStatusFilter]);

  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchWarehouse =
        selectedWarehouseFilter === 'all' || item.warehouse_id === selectedWarehouseFilter;

      const pName = item.product?.name || '';
      const pSku = item.product?.sku || '';
      const matchSearch =
        pName.toLowerCase().includes(inventorySearch.toLowerCase()) ||
        pSku.toLowerCase().includes(inventorySearch.toLowerCase());

      const isLowStock =
        item.low_stock_threshold !== null && item.quantity_available <= (item.low_stock_threshold || 0);
      const isOutOfStock = Number(item.quantity_in_stock) <= 0;

      const matchStock =
        inventoryStockFilter === 'all'
          ? true
          : inventoryStockFilter === 'low'
          ? isLowStock && !isOutOfStock
          : isOutOfStock;

      return matchWarehouse && matchSearch && matchStock;
    });
  }, [inventory, selectedWarehouseFilter, inventorySearch, inventoryStockFilter]);

  const filteredTransfers = useMemo(() => {
    return transfers.filter((t) => {
      const num = t.transfer_number.toLowerCase();
      const src = t.source_warehouse?.name.toLowerCase() || '';
      const dest = t.destination_warehouse?.name.toLowerCase() || '';
      const term = transferSearch.toLowerCase();
      return num.includes(term) || src.includes(term) || dest.includes(term);
    });
  }, [transfers, transferSearch]);

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const p = m.product?.name.toLowerCase() || '';
      const wh = m.warehouse?.name.toLowerCase() || '';
      const ref = (m.reference_number || '').toLowerCase();
      const term = movementSearch.toLowerCase();
      return p.includes(term) || wh.includes(term) || ref.includes(term);
    });
  }, [movements, movementSearch]);

  // Warehouse capacity and stock stats
  const warehouseStatsMap = useMemo(() => {
    const stats: Record<string, { totalItems: number; totalUnits: number; totalValue: number }> = {};
    inventory.forEach((inv) => {
      const whId = inv.warehouse_id;
      if (!stats[whId]) stats[whId] = { totalItems: 0, totalUnits: 0, totalValue: 0 };
      stats[whId].totalItems += 1;
      const units = Number(inv.quantity_in_stock) || 0;
      stats[whId].totalUnits += units;
      const price = Number(inv.product?.price) || 0;
      stats[whId].totalValue += units * price;
    });
    return stats;
  }, [inventory]);

  // Low Stock Items across all warehouses
  const lowStockItems = useMemo(() => {
    return inventory.filter(
      (inv) =>
        inv.low_stock_threshold !== null &&
        Number(inv.quantity_available) <= (inv.low_stock_threshold || 0)
    );
  }, [inventory]);

  // Best-Selling (Top-Performing) Products
  const bestSellingProducts = useMemo(() => {
    return [...salesStats]
      .filter((p) => p.total_units_sold > 0)
      .sort((a, b) => b.total_units_sold - a.total_units_sold)
      .slice(0, 8);
  }, [salesStats]);

  // Least-Selling (Low-Performing / Slow-Moving) Products
  const leastSellingProducts = useMemo(() => {
    return [...salesStats]
      .sort((a, b) => a.total_units_sold - b.total_units_sold)
      .slice(0, 8);
  }, [salesStats]);

  // Overall Global Totals
  const totalStockUnits = useMemo(() => {
    return inventory.reduce((sum, item) => sum + (Number(item.quantity_in_stock) || 0), 0);
  }, [inventory]);

  const totalInventoryValuation = useMemo(() => {
    return inventory.reduce(
      (sum, item) => sum + (Number(item.quantity_in_stock) || 0) * (Number(item.product?.price) || 0),
      0
    );
  }, [inventory]);

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
        <p className="text-sm font-medium text-secondary-500">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* ── Top Header ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white shadow-primary">
              <WarehouseIcon size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-secondary-900 dark:text-secondary-100 tracking-tight">
                {t('warehouse.title')}
              </h1>
              <p className="text-sm text-secondary-500 dark:text-secondary-400 mt-0.5">
                {t('warehouse.subtitle')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={handleRefresh} loading={refreshing}>
            <RefreshCw size={15} />
            {lang === 'ar' ? 'تحديث' : 'Refresh'}
          </Button>

          {activeTab === 'warehouses' && (
            <Button size="sm" onClick={openAddWarehouseModal}>
              <Plus size={16} />
              {t('warehouse.addWarehouse')}
            </Button>
          )}

          {activeTab === 'inventory' && (
            <Button size="sm" onClick={() => openAddInventoryModal()}>
              <Plus size={16} />
              {lang === 'ar' ? 'إضافة صنف لمستودع' : 'Link Product to Warehouse'}
            </Button>
          )}

          {activeTab === 'transfers' && (
            <Button size="sm" onClick={() => openNewTransferModal()}>
              <ArrowRightLeft size={16} />
              {t('warehouse.newTransfer')}
            </Button>
          )}
        </div>
      </div>

      {/* ── Fallback Mode / Schema Notice Banner ────────────────── */}
      {isFallbackMode && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-4 sm:p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                <Database size={22} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {lang === 'ar'
                    ? 'النظام يعمل حالياً في وضع التخزين التلقائي الذكي'
                    : 'System is running in resilient local storage mode'}
                </h4>
                <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1 leading-relaxed max-w-2xl">
                  {lang === 'ar'
                    ? 'جداول المستودعات (public.warehouses) غير منشأة بعد في قاعدة بيانات Supabase. يمكنك إضافة وإدارة المستودعات ونقل المخزون وتعديل الكميات الآن بكل حرية وسلاسة. لتفعيل الحفظ المركزي في Supabase، اضغط على زر نسخ كود SQL وشغله في Supabase SQL Editor.'
                    : 'Warehouse tables are not yet created in your Supabase project. You can continue managing warehouses and stock transfers right now. To enable centralized Supabase persistence, copy the SQL migration script and run it in your Supabase SQL Editor.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRecheckDatabase}
                loading={checkingDb}
                className="text-xs border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700"
              >
                <RefreshCw size={13} />
                {lang === 'ar' ? 'فحص الاتصال بقاعدة البيانات' : 'Recheck DB'}
              </Button>
              <Button
                size="sm"
                onClick={() => setShowSqlModal(true)}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
              >
                <Copy size={13} />
                {lang === 'ar' ? 'عرض ونسخ كود SQL' : 'View / Copy SQL'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Key Metrics Overview ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <Building2 size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                {t('warehouse.totalWarehouses')}
              </p>
              <p className="text-xl font-black text-secondary-900 dark:text-secondary-100 mt-0.5">
                {warehouses.length}{' '}
                <span className="text-xs font-medium text-success-600">
                  ({warehouses.filter((w) => w.is_active).length} {t('warehouse.active')})
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
              <Boxes size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                {t('warehouse.totalStock')}
              </p>
              <p className="text-xl font-black text-secondary-900 dark:text-secondary-100 mt-0.5">
                {totalStockUnits.toLocaleString()}{' '}
                <span className="text-xs font-normal text-secondary-400">
                  {lang === 'ar' ? 'قطعة' : 'units'}
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400">
              <DollarSign size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                {t('warehouse.totalValue')}
              </p>
              <p className="text-xl font-black text-secondary-900 dark:text-secondary-100 mt-0.5">
                {fmt(totalInventoryValuation, company?.currency)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertTriangle size={20} />
            </div>
            <div>
              <p className="text-xs font-semibold text-secondary-500 dark:text-secondary-400 uppercase tracking-wider">
                {t('warehouse.lowStockAlerts')}
              </p>
              <p className="text-xl font-black text-secondary-900 dark:text-secondary-100 mt-0.5">
                {lowStockItems.length}{' '}
                <span className="text-xs font-normal text-secondary-400">
                  {lang === 'ar' ? 'تنبيه' : 'alerts'}
                </span>
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* ── Navigation Tabs ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 border-b border-secondary-200 dark:border-secondary-800 pb-3">
        <button
          onClick={() => setActiveTab('warehouses')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'warehouses'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
          }`}
        >
          <Building2 size={16} />
          {t('warehouse.tabWarehouses')}
          <span
            className={`px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === 'warehouses' ? 'bg-primary-700 text-white' : 'bg-secondary-200 dark:bg-secondary-700'
            }`}
          >
            {warehouses.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'inventory'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
          }`}
        >
          <Package size={16} />
          {t('warehouse.tabInventory')}
          <span
            className={`px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === 'inventory' ? 'bg-primary-700 text-white' : 'bg-secondary-200 dark:bg-secondary-700'
            }`}
          >
            {inventory.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('transfers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'transfers'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
          }`}
        >
          <ArrowRightLeft size={16} />
          {t('warehouse.tabTransfers')}
          <span
            className={`px-1.5 py-0.5 text-xs rounded-full ${
              activeTab === 'transfers' ? 'bg-primary-700 text-white' : 'bg-secondary-200 dark:bg-secondary-700'
            }`}
          >
            {transfers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'reports'
              ? 'bg-primary-600 text-white shadow-sm'
              : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
          }`}
        >
          <BarChart3 size={16} />
          {t('warehouse.tabReports')}
          {lowStockItems.length > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          TAB 1: WAREHOUSES MANAGEMENT (CRUD)
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="relative w-full sm:w-80">
              <Search
                size={16}
                className="absolute top-1/2 -translate-y-1/2 start-3 text-secondary-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder={lang === 'ar' ? 'بحث بالاسم، الرمز، المدينة، المدير...' : 'Search warehouse name, code, city...'}
                value={warehouseSearch}
                onChange={(e) => setWarehouseSearch(e.target.value)}
                className="input ps-9 py-2 text-sm w-full"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-semibold text-secondary-500">{t('warehouse.status')}:</span>
              <div className="inline-flex rounded-xl bg-secondary-100 dark:bg-secondary-800 p-1 text-xs font-bold">
                <button
                  onClick={() => setWarehouseStatusFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    warehouseStatusFilter === 'all'
                      ? 'bg-white dark:bg-secondary-700 text-primary-600 dark:text-primary-400 shadow-xs'
                      : 'text-secondary-600 dark:text-secondary-400'
                  }`}
                >
                  {lang === 'ar' ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setWarehouseStatusFilter('active')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    warehouseStatusFilter === 'active'
                      ? 'bg-white dark:bg-secondary-700 text-success-600 dark:text-success-400 shadow-xs'
                      : 'text-secondary-600 dark:text-secondary-400'
                  }`}
                >
                  {t('warehouse.active')}
                </button>
                <button
                  onClick={() => setWarehouseStatusFilter('inactive')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    warehouseStatusFilter === 'inactive'
                      ? 'bg-white dark:bg-secondary-700 text-danger-600 dark:text-danger-400 shadow-xs'
                      : 'text-secondary-600 dark:text-secondary-400'
                  }`}
                >
                  {t('warehouse.inactive')}
                </button>
              </div>
            </div>
          </div>

          {/* Warehouses Cards Grid */}
          {filteredWarehouses.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 size={40} className="mx-auto text-secondary-400 mb-3" />
              <h3 className="text-base font-bold text-secondary-800 dark:text-secondary-200">
                {lang === 'ar' ? 'لم يتم العثور على مستودعات' : 'No warehouses found'}
              </h3>
              <p className="text-sm text-secondary-500 mt-1">
                {lang === 'ar' ? 'ابدأ بإضافة مستودع جديد لمنشأتك' : 'Get started by creating your first warehouse'}
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={openAddWarehouseModal}>
                  <Plus size={15} />
                  {t('warehouse.addWarehouse')}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredWarehouses.map((wh) => {
                const whStats = warehouseStatsMap[wh.id] || { totalItems: 0, totalUnits: 0, totalValue: 0 };
                const capacity = wh.capacity_units || 0;
                const utilPercent = capacity > 0 ? Math.min(100, Math.round((whStats.totalUnits / capacity) * 100)) : 0;

                return (
                  <Card
                    key={wh.id}
                    className="p-5 flex flex-col justify-between bg-white dark:bg-secondary-900 border border-secondary-200 dark:border-secondary-800 hover:shadow-md transition-shadow relative overflow-hidden"
                  >
                    {wh.is_default && (
                      <div className="absolute top-0 end-0 bg-primary-600 text-white text-[10px] font-bold px-3 py-0.5 rounded-es-xl tracking-wider">
                        {lang === 'ar' ? 'افتراضي' : 'DEFAULT'}
                      </div>
                    )}

                    <div>
                      {/* Title & Badge */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-secondary-900 dark:text-secondary-100 text-base">
                              {wh.name}
                            </h3>
                            {wh.code && (
                              <span className="font-mono text-xs px-2 py-0.5 rounded bg-secondary-100 dark:bg-secondary-800 text-secondary-600 dark:text-secondary-300">
                                {wh.code}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-secondary-500 flex items-center gap-1 mt-1">
                            <MapPin size={13} className="shrink-0" />
                            {wh.location || wh.city || wh.address || (lang === 'ar' ? 'الموقع غير محدد' : 'No address set')}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleWarehouseStatus(wh)}
                          className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-bold transition-all ${
                            wh.is_active
                              ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300 hover:bg-success-100'
                              : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400 hover:bg-secondary-200'
                          }`}
                          title={lang === 'ar' ? 'انقر لتغيير الحالة' : 'Click to toggle status'}
                        >
                          {wh.is_active ? t('warehouse.active') : t('warehouse.inactive')}
                        </button>
                      </div>

                      {/* Manager Details */}
                      {(wh.manager_name || wh.manager_phone || wh.manager_email) && (
                        <div className="rounded-xl bg-secondary-50 dark:bg-secondary-800/50 p-2.5 space-y-1 mb-3 text-xs text-secondary-600 dark:text-secondary-300">
                          {wh.manager_name && (
                            <div className="flex items-center gap-1.5 font-semibold text-secondary-800 dark:text-secondary-200">
                              <User size={13} className="text-secondary-400" />
                              <span>{wh.manager_name}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-secondary-500">
                            {wh.manager_phone && (
                              <span className="flex items-center gap-1">
                                <Phone size={11} /> {wh.manager_phone}
                              </span>
                            )}
                            {wh.manager_email && (
                              <span className="flex items-center gap-1">
                                <Mail size={11} /> {wh.manager_email}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Stock Summary Metrics */}
                      <div className="grid grid-cols-3 gap-2 py-2 border-y border-secondary-100 dark:border-secondary-800 text-center mb-3">
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-secondary-400">
                            {lang === 'ar' ? 'الأصناف' : 'SKUs'}
                          </p>
                          <p className="text-sm font-bold text-secondary-800 dark:text-secondary-200 mt-0.5">
                            {whStats.totalItems}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-secondary-400">
                            {lang === 'ar' ? 'الكمية' : 'Units'}
                          </p>
                          <p className="text-sm font-bold text-secondary-800 dark:text-secondary-200 mt-0.5">
                            {whStats.totalUnits.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-secondary-400">
                            {lang === 'ar' ? 'القيمة' : 'Value'}
                          </p>
                          <p className="text-sm font-bold text-secondary-800 dark:text-secondary-200 mt-0.5 truncate">
                            {fmt(whStats.totalValue, company?.currency)}
                          </p>
                        </div>
                      </div>

                      {/* Capacity Bar */}
                      {capacity > 0 && (
                        <div className="space-y-1 mb-3">
                          <div className="flex justify-between text-xs text-secondary-500">
                            <span>{lang === 'ar' ? 'السعة الاستيعابية' : 'Capacity Usage'}</span>
                            <span className="font-semibold text-secondary-700 dark:text-secondary-300">
                              {whStats.totalUnits} / {capacity} ({utilPercent}%)
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-secondary-100 dark:bg-secondary-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-500 ${
                                utilPercent > 90
                                  ? 'bg-danger-500'
                                  : utilPercent > 70
                                  ? 'bg-warning-500'
                                  : 'bg-primary-500'
                              }`}
                              style={{ width: `${utilPercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {wh.notes && (
                        <p className="text-xs text-secondary-500 italic line-clamp-2 mb-3">
                          "{wh.notes}"
                        </p>
                      )}
                    </div>

                    {/* Bottom Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-secondary-100 dark:border-secondary-800">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSelectedWarehouseFilter(wh.id);
                          setActiveTab('inventory');
                        }}
                      >
                        <Package size={14} />
                        {lang === 'ar' ? 'عرض المخزون' : 'View Stock'}
                      </Button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEditWarehouseModal(wh)}
                          className="p-1.5 rounded-lg text-secondary-500 hover:text-primary-600 hover:bg-secondary-100 dark:hover:bg-secondary-800"
                          title={t('common.edit')}
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => requestDeleteWarehouse(wh)}
                          className="p-1.5 rounded-lg text-secondary-500 hover:text-danger-600 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                          title={t('common.delete')}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 2: WAREHOUSE INVENTORY
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col lg:flex-row gap-3 justify-between items-center bg-white dark:bg-secondary-900 p-4 rounded-2xl border border-secondary-200 dark:border-secondary-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Warehouse Filter */}
              <div className="w-full sm:w-60">
                <Select
                  value={selectedWarehouseFilter}
                  onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                  className="py-1.5 text-sm"
                >
                  <option value="all">
                    {lang === 'ar' ? 'جميع المستودعات' : 'All Warehouses'} ({warehouses.length})
                  </option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} {wh.code ? `(${wh.code})` : ''}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Product search */}
              <div className="relative flex-1 sm:w-64">
                <Search
                  size={15}
                  className="absolute top-1/2 -translate-y-1/2 start-3 text-secondary-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'بحث بالمنتج أو رمز SKU...' : 'Search product or SKU...'}
                  value={inventorySearch}
                  onChange={(e) => setInventorySearch(e.target.value)}
                  className="input ps-9 py-1.5 text-sm w-full"
                />
              </div>
            </div>

            {/* Stock Level Filter */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
              <span className="text-xs font-semibold text-secondary-500">
                {lang === 'ar' ? 'حالة التوفر:' : 'Stock:'}
              </span>
              <div className="inline-flex rounded-xl bg-secondary-100 dark:bg-secondary-800 p-1 text-xs font-bold">
                <button
                  onClick={() => setInventoryStockFilter('all')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    inventoryStockFilter === 'all'
                      ? 'bg-white dark:bg-secondary-700 text-primary-600 shadow-xs'
                      : 'text-secondary-600 dark:text-secondary-400'
                  }`}
                >
                  {lang === 'ar' ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setInventoryStockFilter('low')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    inventoryStockFilter === 'low'
                      ? 'bg-white dark:bg-secondary-700 text-amber-600 shadow-xs'
                      : 'text-secondary-600 dark:text-secondary-400'
                  }`}
                >
                  {lang === 'ar' ? 'نقص المخزون' : 'Low Stock'}
                </button>
                <button
                  onClick={() => setInventoryStockFilter('out')}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    inventoryStockFilter === 'out'
                      ? 'bg-white dark:bg-secondary-700 text-danger-600 shadow-xs'
                      : 'text-secondary-600 dark:text-secondary-400'
                  }`}
                >
                  {lang === 'ar' ? 'نافد' : 'Out'}
                </button>
              </div>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead className="bg-secondary-50 dark:bg-secondary-800/60 border-b border-secondary-200 dark:border-secondary-800 text-xs font-semibold text-secondary-500">
                  <tr>
                    <th className="px-5 py-3 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                    <th className="px-4 py-3 text-start">{t('warehouse.name')}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'المتوفر' : 'In Stock'}</th>
                    <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الحد الأدنى' : 'Min Alert'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'ar' ? 'سعر الوحدة' : 'Unit Price'}</th>
                    <th className="px-4 py-3 text-end">{lang === 'ar' ? 'إجمالي القيمة' : 'Stock Value'}</th>
                    <th className="px-4 py-3 text-center">{t('warehouse.status')}</th>
                    <th className="px-5 py-3 text-end">{lang === 'ar' ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-secondary-500">
                        <Package size={32} className="mx-auto text-secondary-400 mb-2" />
                        <p className="font-semibold">
                          {lang === 'ar' ? 'لا توجد أصناف مطابقة للبحث' : 'No inventory items match criteria'}
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map((item) => {
                      const qty = Number(item.quantity_in_stock || 0);
                      const threshold = item.low_stock_threshold ? Number(item.low_stock_threshold) : null;
                      const isOutOfStock = qty <= 0;
                      const isLowStock = threshold !== null && qty <= threshold && !isOutOfStock;
                      const price = Number(item.product?.price || 0);
                      const totalVal = qty * price;

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-secondary-50/60 dark:hover:bg-secondary-800/40 transition-colors"
                        >
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-bold text-secondary-900 dark:text-secondary-100">
                                {item.product?.name || '—'}
                              </p>
                              {item.product?.sku && (
                                <p className="font-mono text-xs text-secondary-400">
                                  SKU: {item.product.sku}
                                </p>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3.5 text-secondary-700 dark:text-secondary-300">
                            <span className="inline-flex items-center gap-1.5">
                              <Building2 size={13} className="text-secondary-400 shrink-0" />
                              <span className="font-medium">{item.warehouse?.name || '—'}</span>
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                isOutOfStock
                                  ? 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                                  : isLowStock
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                  : 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                              }`}
                            >
                              {qty}
                            </span>
                          </td>

                          <td className="px-4 py-3.5 text-center text-xs text-secondary-500 font-mono">
                            {threshold ?? '—'}
                          </td>

                          <td className="px-4 py-3.5 text-end font-medium text-secondary-700 dark:text-secondary-300">
                            {fmt(price, company?.currency)}
                          </td>

                          <td className="px-4 py-3.5 text-end font-bold text-secondary-900 dark:text-secondary-100">
                            {fmt(totalVal, company?.currency)}
                          </td>

                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-bold ${
                                isOutOfStock
                                  ? 'text-danger-600 dark:text-danger-400'
                                  : isLowStock
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : 'text-success-600 dark:text-success-400'
                              }`}
                            >
                              {isOutOfStock
                                ? (lang === 'ar' ? 'نافد' : 'Out of Stock')
                                : isLowStock
                                ? (lang === 'ar' ? 'مخزون منخفض' : 'Low Stock')
                                : (lang === 'ar' ? 'متوفر' : 'In Stock')}
                            </span>
                          </td>

                          <td className="px-5 py-3.5 text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => openAdjustStockModal(item)}
                                className="text-xs py-1 px-2.5"
                              >
                                <SlidersHorizontal size={13} />
                                {t('warehouse.quickAdjust')}
                              </Button>

                              <button
                                onClick={() => openEditInventoryModal(item)}
                                className="p-1.5 rounded-lg text-secondary-500 hover:text-primary-600 hover:bg-secondary-100 dark:hover:bg-secondary-800"
                                title={t('common.edit')}
                              >
                                <Edit2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 3: STOCK TRANSFERS & MOVEMENT AUDIT TRAIL
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'transfers' && (
        <div className="space-y-4">
          {/* Sub Navigation */}
          <div className="flex items-center justify-between border-b border-secondary-200 dark:border-secondary-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTransfersSubTab('transfers')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  transfersSubTab === 'transfers'
                    ? 'bg-primary-600 text-white'
                    : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                }`}
              >
                {lang === 'ar' ? 'التحويلات بين المستودعات' : 'Stock Transfers'} ({transfers.length})
              </button>
              <button
                onClick={() => setTransfersSubTab('movements')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  transfersSubTab === 'movements'
                    ? 'bg-primary-600 text-white'
                    : 'text-secondary-600 dark:text-secondary-300 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                }`}
              >
                {t('warehouse.transferHistory')} ({movements.length})
              </button>
            </div>

            <Button size="sm" onClick={() => openNewTransferModal()}>
              <ArrowRightLeft size={15} />
              {t('warehouse.newTransfer')}
            </Button>
          </div>

          {/* SubTab A: Stock Transfers Table */}
          {transfersSubTab === 'transfers' && (
            <div className="space-y-4">
              <div className="relative w-full sm:w-80">
                <Search
                  size={15}
                  className="absolute top-1/2 -translate-y-1/2 start-3 text-secondary-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'بحث برقم التحويل أو اسم المستودع...' : 'Search transfer # or warehouse...'}
                  value={transferSearch}
                  onChange={(e) => setTransferSearch(e.target.value)}
                  className="input ps-9 py-1.5 text-sm w-full"
                />
              </div>

              <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-start">
                    <thead className="bg-secondary-50 dark:bg-secondary-800/60 border-b border-secondary-200 dark:border-secondary-800 text-xs font-semibold text-secondary-500">
                      <tr>
                        <th className="px-5 py-3 text-start">{lang === 'ar' ? 'رقم التحويل' : 'Transfer #'}</th>
                        <th className="px-4 py-3 text-start">{t('warehouse.sourceWarehouse')}</th>
                        <th className="px-4 py-3 text-start">{t('warehouse.destinationWarehouse')}</th>
                        <th className="px-4 py-3 text-start">{lang === 'ar' ? 'المنتجات المنقولة' : 'Items'}</th>
                        <th className="px-4 py-3 text-center">{t('warehouse.transferDate')}</th>
                        <th className="px-4 py-3 text-center">{t('warehouse.status')}</th>
                        <th className="px-5 py-3 text-end">{lang === 'ar' ? 'الإجراء' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-secondary-500">
                            <ArrowRightLeft size={32} className="mx-auto text-secondary-400 mb-2" />
                            <p className="font-semibold">
                              {lang === 'ar' ? 'لا توجد تحويلات مسجلة' : 'No transfers recorded yet'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredTransfers.map((trf) => {
                          const isDispatched = trf.status === 'dispatched' || trf.status === 'in_transit';
                          const isReceived = trf.status === 'received';

                          return (
                            <tr key={trf.id} className="hover:bg-secondary-50/60 transition-colors">
                              <td className="px-5 py-3.5 font-mono text-xs font-bold text-secondary-900 dark:text-secondary-100">
                                {trf.transfer_number}
                              </td>
                              <td className="px-4 py-3.5 text-secondary-800 dark:text-secondary-200 font-medium">
                                {trf.source_warehouse?.name || '—'}
                              </td>
                              <td className="px-4 py-3.5 text-secondary-800 dark:text-secondary-200 font-medium">
                                {trf.destination_warehouse?.name || '—'}
                              </td>
                              <td className="px-4 py-3.5 text-secondary-600 dark:text-secondary-400">
                                {trf.lines && trf.lines.length > 0 ? (
                                  <span>
                                    {trf.lines[0].product?.name || 'Item'} ({trf.lines[0].quantity_dispatched || trf.lines[0].quantity_requested} units)
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="px-4 py-3.5 text-center text-xs text-secondary-500">
                                {fmtDate(trf.transfer_date)}
                              </td>
                              <td className="px-4 py-3.5 text-center">
                                <span
                                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                                    isReceived
                                      ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                                      : isDispatched
                                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                                      : 'bg-secondary-100 text-secondary-600'
                                  }`}
                                >
                                  {isReceived ? (
                                    <>
                                      <CheckCircle2 size={12} />
                                      {lang === 'ar' ? 'تم الاستلام' : 'Received'}
                                    </>
                                  ) : isDispatched ? (
                                    <>
                                      <Clock size={12} />
                                      {lang === 'ar' ? 'قيد النقل' : 'In Transit'}
                                    </>
                                  ) : (
                                    trf.status
                                  )}
                                </span>
                              </td>
                              <td className="px-5 py-3.5 text-end">
                                {isDispatched ? (
                                  <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => handleReceiveTransfer(trf)}
                                    className="text-xs py-1"
                                  >
                                    <CheckCircle2 size={13} />
                                    {lang === 'ar' ? 'تأكيد الاستلام' : 'Confirm Receipt'}
                                  </Button>
                                ) : (
                                  <span className="text-xs text-secondary-400 font-medium">
                                    {lang === 'ar' ? 'مكتمل' : 'Completed'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* SubTab B: Movement History (Cardex / Audit Log) */}
          {transfersSubTab === 'movements' && (
            <div className="space-y-4">
              <div className="relative w-full sm:w-80">
                <Search
                  size={15}
                  className="absolute top-1/2 -translate-y-1/2 start-3 text-secondary-400 pointer-events-none"
                />
                <input
                  type="text"
                  placeholder={lang === 'ar' ? 'بحث باسم المنتج أو المستودع...' : 'Search product or warehouse...'}
                  value={movementSearch}
                  onChange={(e) => setMovementSearch(e.target.value)}
                  className="input ps-9 py-1.5 text-sm w-full"
                />
              </div>

              <div className="bg-white dark:bg-secondary-900 rounded-2xl border border-secondary-200 dark:border-secondary-800 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-start">
                    <thead className="bg-secondary-50 dark:bg-secondary-800/60 border-b border-secondary-200 dark:border-secondary-800 text-xs font-semibold text-secondary-500">
                      <tr>
                        <th className="px-5 py-3 text-start">{lang === 'ar' ? 'التاريخ والوقت' : 'Date & Time'}</th>
                        <th className="px-4 py-3 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th className="px-4 py-3 text-start">{t('warehouse.name')}</th>
                        <th className="px-4 py-3 text-center">{lang === 'ar' ? 'نوع الحركة' : 'Movement Type'}</th>
                        <th className="px-4 py-3 text-center">{lang === 'ar' ? 'التغيير' : 'Change'}</th>
                        <th className="px-4 py-3 text-center">{lang === 'ar' ? 'الرصيد بعد' : 'Balance After'}</th>
                        <th className="px-5 py-3 text-start">{lang === 'ar' ? 'المرجع والملاحظات' : 'Reference & Notes'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                      {filteredMovements.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-12 text-center text-secondary-500">
                            <Clock size={32} className="mx-auto text-secondary-400 mb-2" />
                            <p className="font-semibold">
                              {lang === 'ar' ? 'لا توجد حركات مخزنية مسجلة' : 'No movements logged'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        filteredMovements.map((m) => {
                          const isPositive = Number(m.quantity_change) > 0;
                          return (
                            <tr key={m.id} className="hover:bg-secondary-50/60 transition-colors text-xs">
                              <td className="px-5 py-3 text-secondary-500 font-mono">
                                {new Date(m.movement_date).toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')}
                              </td>
                              <td className="px-4 py-3 font-semibold text-secondary-800 dark:text-secondary-200">
                                {m.product?.name || '—'}
                              </td>
                              <td className="px-4 py-3 text-secondary-600 dark:text-secondary-300">
                                {m.warehouse?.name || '—'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-secondary-100 dark:bg-secondary-800 text-secondary-700 dark:text-secondary-300">
                                  {m.movement_type}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-bold">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${
                                    isPositive
                                      ? 'text-success-600 dark:text-success-400 bg-success-50 dark:bg-success-900/30'
                                      : 'text-danger-600 dark:text-danger-400 bg-danger-50 dark:bg-danger-900/30'
                                  }`}
                                >
                                  {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center font-mono font-bold text-secondary-800 dark:text-secondary-200">
                                {m.quantity_after}
                              </td>
                              <td className="px-5 py-3 text-secondary-500 max-w-xs truncate">
                                {m.reference_number ? `[${m.reference_number}] ` : ''}
                                {m.notes || '—'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          TAB 4: REPORTS & ANALYTICS DASHBOARD
         ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          {/* Warehouse Stock Summary Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black text-secondary-900 dark:text-secondary-100 flex items-center gap-2">
                <Layers size={18} className="text-primary-600" />
                {t('warehouse.stockSummary')}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {warehouses.map((wh) => {
                const whStats = warehouseStatsMap[wh.id] || { totalItems: 0, totalUnits: 0, totalValue: 0 };
                const capacity = wh.capacity_units || 0;
                const util = capacity > 0 ? Math.min(100, Math.round((whStats.totalUnits / capacity) * 100)) : 0;

                return (
                  <Card key={wh.id} className="p-4 border border-secondary-200 dark:border-secondary-800">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-secondary-900 dark:text-secondary-100 text-sm">
                          {wh.name}
                        </h4>
                        <p className="text-xs text-secondary-400">{wh.city || wh.location || 'Saudi Arabia'}</p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary-100 dark:bg-secondary-800 text-secondary-600">
                        {wh.warehouse_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 py-3 border-t border-secondary-100 dark:border-secondary-800 text-xs">
                      <div>
                        <span className="text-secondary-400 block">{lang === 'ar' ? 'الوحدات المخزنة' : 'Stock Units'}:</span>
                        <span className="font-bold text-base text-secondary-900 dark:text-secondary-100">
                          {whStats.totalUnits.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary-400 block">{lang === 'ar' ? 'قيمة المخزون' : 'Stock Value'}:</span>
                        <span className="font-bold text-base text-primary-600 dark:text-primary-400">
                          {fmt(whStats.totalValue, company?.currency)}
                        </span>
                      </div>
                    </div>

                    {capacity > 0 && (
                      <div className="pt-2 border-t border-secondary-100 dark:border-secondary-800 space-y-1">
                        <div className="flex justify-between text-[11px] text-secondary-500">
                          <span>{lang === 'ar' ? 'نسبة الإشغال' : 'Utilization'}</span>
                          <span className="font-bold">{util}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-secondary-100 dark:bg-secondary-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              util > 90 ? 'bg-danger-500' : util > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${util}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Product Sales Performance: Best-Selling vs. Least-Selling */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best-Selling (Top-Performing) Products */}
            <Card className="border border-secondary-200 dark:border-secondary-800 overflow-hidden">
              <CardHeader className="border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50/50 dark:bg-secondary-800/40 p-4">
                <CardTitle
                  icon={<Flame size={18} className="text-amber-500" />}
                  className="text-base font-bold text-secondary-900 dark:text-secondary-100"
                >
                  {t('warehouse.bestSelling')}
                </CardTitle>
                <p className="text-xs text-secondary-500 mt-0.5">
                  {lang === 'ar' ? 'المنتجات الأعلى مبيعاً بناءً على فواتير المبيعات الفعلية' : 'Top revenue & volume generators from invoice sales'}
                </p>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-secondary-50 dark:bg-secondary-800/60 text-secondary-500 font-semibold border-b border-secondary-100 dark:border-secondary-800">
                      <tr>
                        <th className="px-4 py-2.5 text-center">#</th>
                        <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'المبيعات' : 'Units Sold'}</th>
                        <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'الإيرادات' : 'Revenue'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'المخزون الحالي' : 'Stock Left'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                      {bestSellingProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-secondary-400">
                            {lang === 'ar' ? 'لا توجد بيانات مبيعات كافية بعد' : 'No sales data logged yet'}
                          </td>
                        </tr>
                      ) : (
                        bestSellingProducts.map((p, idx) => (
                          <tr key={p.product_id} className="hover:bg-secondary-50/50 transition-colors">
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                                  idx === 0
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'
                                    : idx === 1
                                    ? 'bg-secondary-200 text-secondary-800 dark:bg-secondary-700 dark:text-secondary-200'
                                    : idx === 2
                                    ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200'
                                    : 'text-secondary-500'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-semibold text-secondary-900 dark:text-secondary-100">
                              {p.product_name}
                              <span className="block text-[10px] text-secondary-400 font-mono font-normal">
                                {p.sku}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-secondary-800 dark:text-secondary-200">
                              {p.total_units_sold}
                            </td>
                            <td className="px-4 py-3 text-end font-bold text-emerald-600 dark:text-emerald-400">
                              {fmt(p.total_revenue, company?.currency)}
                            </td>
                            <td className="px-4 py-3 text-center font-bold">
                              <span
                                className={`px-2 py-0.5 rounded text-[11px] ${
                                  p.current_stock <= 5
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-secondary-100 text-secondary-700'
                                }`}
                              >
                                {p.current_stock}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>

            {/* Least-Selling (Low-Performing / Slow-Moving) Products */}
            <Card className="border border-secondary-200 dark:border-secondary-800 overflow-hidden">
              <CardHeader className="border-b border-secondary-100 dark:border-secondary-800 bg-secondary-50/50 dark:bg-secondary-800/40 p-4">
                <CardTitle
                  icon={<Snowflake size={18} className="text-blue-500" />}
                  className="text-base font-bold text-secondary-900 dark:text-secondary-100"
                >
                  {t('warehouse.leastSelling')}
                </CardTitle>
                <p className="text-xs text-secondary-500 mt-0.5">
                  {lang === 'ar' ? 'المنتجات البطيئة أو الراكدة بالمستودعات مع رأس المال المجمد' : 'Slow-moving products with tied-up capital'}
                </p>
              </CardHeader>
              <CardBody className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start">
                    <thead className="bg-secondary-50 dark:bg-secondary-800/60 text-secondary-500 font-semibold border-b border-secondary-100 dark:border-secondary-800">
                      <tr>
                        <th className="px-4 py-2.5 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'المبيعات' : 'Sales'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'المخزون المجمد' : 'Units In Stock'}</th>
                        <th className="px-4 py-2.5 text-end">{lang === 'ar' ? 'رأس المال المجمد' : 'Tied-up Capital'}</th>
                        <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'التوصية' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                      {leastSellingProducts.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-secondary-400">
                            {lang === 'ar' ? 'لا توجد منتجات راكدة' : 'No slow-moving products'}
                          </td>
                        </tr>
                      ) : (
                        leastSellingProducts.map((p) => (
                          <tr key={p.product_id} className="hover:bg-secondary-50/50 transition-colors">
                            <td className="px-4 py-3 font-semibold text-secondary-900 dark:text-secondary-100">
                              {p.product_name}
                              <span className="block text-[10px] text-secondary-400 font-mono font-normal">
                                {p.sku}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-secondary-500">
                              {p.total_units_sold === 0 ? (
                                <span className="text-danger-600 font-bold">0</span>
                              ) : (
                                p.total_units_sold
                              )}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-secondary-800 dark:text-secondary-200">
                              {p.current_stock}
                            </td>
                            <td className="px-4 py-3 text-end font-bold text-secondary-700 dark:text-secondary-300">
                              {fmt(p.stock_value, company?.currency)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                                {lang === 'ar' ? 'تحفيز مبيعات / نقل' : 'Discount / Transfer'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Low Stock Alerts Table Per Warehouse */}
          <Card className="border border-secondary-200 dark:border-secondary-800 overflow-hidden">
            <CardHeader className="border-b border-secondary-100 dark:border-secondary-800 bg-amber-50/40 dark:bg-amber-900/10 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle
                    icon={<AlertCircle size={18} className="text-amber-500" />}
                    className="text-base font-bold text-secondary-900 dark:text-secondary-100"
                  >
                    {t('warehouse.lowStockAlerts')} ({lowStockItems.length})
                  </CardTitle>
                  <p className="text-xs text-secondary-500 mt-0.5">
                    {lang === 'ar' ? 'المنتجات التي وصلت إلى الحد الأدنى لإعادة الطلب في كل مستودع' : 'Items at or below reorder threshold per warehouse'}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-start">
                  <thead className="bg-secondary-50 dark:bg-secondary-800/60 text-secondary-500 font-semibold border-b border-secondary-100 dark:border-secondary-800">
                    <tr>
                      <th className="px-5 py-2.5 text-start">{lang === 'ar' ? 'المنتج' : 'Product'}</th>
                      <th className="px-4 py-2.5 text-start">{t('warehouse.name')}</th>
                      <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'الكمية الحالية' : 'Current Stock'}</th>
                      <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'حد الإنذار' : 'Alert Threshold'}</th>
                      <th className="px-4 py-2.5 text-center">{lang === 'ar' ? 'العجز' : 'Deficit'}</th>
                      <th className="px-5 py-2.5 text-end">{lang === 'ar' ? 'إجراء سريع' : 'Quick Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-secondary-100 dark:divide-secondary-800">
                    {lowStockItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-success-600 font-medium">
                          <CheckCircle2 size={24} className="mx-auto mb-1 text-success-500" />
                          {lang === 'ar' ? 'جميع المستودعات بحالة مخزون ممتازة' : 'All warehouse stock levels are healthy'}
                        </td>
                      </tr>
                    ) : (
                      lowStockItems.map((inv) => {
                        const cur = Number(inv.quantity_available || 0);
                        const th = Number(inv.low_stock_threshold || 0);
                        const deficit = Math.max(0, th - cur);

                        return (
                          <tr key={inv.id} className="hover:bg-amber-50/20 transition-colors">
                            <td className="px-5 py-3 font-semibold text-secondary-900 dark:text-secondary-100">
                              {inv.product?.name}
                              <span className="block text-[10px] text-secondary-400 font-mono font-normal">
                                {inv.product?.sku}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-secondary-700 dark:text-secondary-300">
                              {inv.warehouse?.name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex px-2 py-0.5 rounded font-bold bg-danger-50 text-danger-700">
                                {cur}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center text-secondary-500 font-mono">
                              {th}
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-amber-600">
                              -{deficit}
                            </td>
                            <td className="px-5 py-3 text-end">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openNewTransferModal(undefined, inv.product_id)}
                                  className="text-xs py-1"
                                >
                                  <ArrowRightLeft size={12} />
                                  {lang === 'ar' ? 'طلب تحويل' : 'Transfer'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openAdjustStockModal(inv)}
                                  className="text-xs py-1"
                                >
                                  <SlidersHorizontal size={12} />
                                  {lang === 'ar' ? 'تعديل' : 'Adjust'}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: ADD / EDIT WAREHOUSE
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={warehouseModalOpen}
        onClose={() => setWarehouseModalOpen(false)}
        title={editingWarehouse ? t('warehouse.editWarehouse') : t('warehouse.addWarehouse')}
        size="lg"
      >
        <form onSubmit={handleSaveWarehouse} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label={`${t('warehouse.name')} *`}
              value={warehouseForm.name}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })}
              placeholder={lang === 'ar' ? 'مثال: مستودع الرياض الرئيسي' : 'e.g. Riyadh Central Warehouse'}
              required
            />

            <Input
              label={t('warehouse.code')}
              value={warehouseForm.code}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })}
              placeholder="e.g. WH-01, JED-HUB"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label={t('warehouse.type')}
              value={warehouseForm.warehouse_type}
              onChange={(e) =>
                setWarehouseForm({
                  ...warehouseForm,
                  warehouse_type: e.target.value as WarehouseFormState['warehouse_type'],
                })
              }
            >
              <option value="main">{lang === 'ar' ? 'رئيسي (Main)' : 'Main'}</option>
              <option value="branch">{lang === 'ar' ? 'فرع (Branch)' : 'Branch'}</option>
              <option value="store">{lang === 'ar' ? 'متجر / صالة عرض (Store)' : 'Store'}</option>
              <option value="transit">{lang === 'ar' ? 'ترانزيت / نقطة توزيع (Transit)' : 'Transit'}</option>
              <option value="virtual">{lang === 'ar' ? 'افتراضي (Virtual)' : 'Virtual'}</option>
            </Select>

            <Input
              label={t('warehouse.capacity')}
              type="number"
              value={warehouseForm.capacity_units}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, capacity_units: e.target.value })}
              placeholder="e.g. 5000"
              min="0"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label={lang === 'ar' ? 'المدينة' : 'City'}
              value={warehouseForm.city}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, city: e.target.value })}
              placeholder="e.g. Riyadh, Jeddah"
            />
            <Input
              label={lang === 'ar' ? 'الحي' : 'District'}
              value={warehouseForm.district}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, district: e.target.value })}
              placeholder="e.g. Al-Sulay, Al-Kharj"
            />
            <Input
              label={t('warehouse.location')}
              value={warehouseForm.location}
              onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })}
              placeholder={lang === 'ar' ? 'المنطقة الصناعية' : 'Industrial Area'}
            />
          </div>

          <Input
            label={t('warehouse.address')}
            value={warehouseForm.address}
            onChange={(e) => setWarehouseForm({ ...warehouseForm, address: e.target.value })}
            placeholder={lang === 'ar' ? 'العنوان التفصيلي، رقم الشارع...' : 'Street address line'}
          />

          {/* Manager Info */}
          <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-3.5 space-y-3 bg-secondary-50/40 dark:bg-secondary-800/20">
            <h4 className="text-xs font-bold text-secondary-700 dark:text-secondary-300 uppercase tracking-wider flex items-center gap-1.5">
              <User size={14} />
              {lang === 'ar' ? 'بيانات مدير المستودع والتواصل' : 'Warehouse Manager & Contact'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label={t('warehouse.manager')}
                value={warehouseForm.manager_name}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, manager_name: e.target.value })}
                placeholder="Manager Name"
              />
              <Input
                label={t('warehouse.managerPhone')}
                value={warehouseForm.manager_phone}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, manager_phone: e.target.value })}
                placeholder="+966500000000"
              />
              <Input
                label={t('warehouse.managerEmail')}
                type="email"
                value={warehouseForm.manager_email}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, manager_email: e.target.value })}
                placeholder="manager@daftrk.com"
              />
            </div>
          </div>

          <Textarea
            label={t('warehouse.notes')}
            value={warehouseForm.notes}
            onChange={(e) => setWarehouseForm({ ...warehouseForm, notes: e.target.value })}
            rows={2}
            placeholder={lang === 'ar' ? 'ملاحظات إضافية حول التخزين أو الشروط...' : 'Special storage notes or instructions...'}
          />

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-secondary-700 dark:text-secondary-300">
              <input
                type="checkbox"
                checked={warehouseForm.is_default}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, is_default: e.target.checked })}
                className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              {t('warehouse.isDefault')}
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-secondary-700 dark:text-secondary-300">
              <input
                type="checkbox"
                checked={warehouseForm.is_active}
                onChange={(e) => setWarehouseForm({ ...warehouseForm, is_active: e.target.checked })}
                className="rounded border-secondary-300 text-primary-600 focus:ring-primary-500 h-4 w-4"
              />
              {t('warehouse.active')}
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-secondary-100 dark:border-secondary-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setWarehouseModalOpen(false)}
              disabled={warehouseSaving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={warehouseSaving}>
              {editingWarehouse ? t('common.save') : t('warehouse.addWarehouse')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: ADD / EDIT INVENTORY ITEM
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={addInventoryModalOpen}
        onClose={() => setAddInventoryModalOpen(false)}
        title={editingInventory ? (lang === 'ar' ? 'تعديل بيانات المخزون' : 'Edit Inventory') : (lang === 'ar' ? 'ربط منتج بمستودع' : 'Link Product to Warehouse')}
        size="md"
      >
        <form onSubmit={handleSaveInventory} className="space-y-4">
          <Select
            label={`${t('warehouse.name')} *`}
            value={inventoryForm.warehouse_id}
            onChange={(e) => setInventoryForm({ ...inventoryForm, warehouse_id: e.target.value })}
            disabled={!!editingInventory}
            required
          >
            <option value="">{lang === 'ar' ? 'اختر المستودع...' : 'Select Warehouse...'}</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>
                {wh.name} {wh.code ? `(${wh.code})` : ''}
              </option>
            ))}
          </Select>

          <Select
            label={`${lang === 'ar' ? 'المنتج' : 'Product'} *`}
            value={inventoryForm.product_id}
            onChange={(e) => setInventoryForm({ ...inventoryForm, product_id: e.target.value })}
            disabled={!!editingInventory}
            required
          >
            <option value="">{lang === 'ar' ? 'اختر المنتج من القائمة...' : 'Select Product...'}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.sku ? `(SKU: ${p.sku})` : ''}
              </option>
            ))}
          </Select>

          <Input
            label={`${lang === 'ar' ? 'الكمية المتوفرة بالمستودع' : 'Quantity in Stock'} *`}
            type="number"
            value={inventoryForm.quantity_in_stock}
            onChange={(e) => setInventoryForm({ ...inventoryForm, quantity_in_stock: e.target.value })}
            min="0"
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Input
              label={lang === 'ar' ? 'حد تنبيه النقص' : 'Low Stock Alert'}
              type="number"
              value={inventoryForm.low_stock_threshold}
              onChange={(e) => setInventoryForm({ ...inventoryForm, low_stock_threshold: e.target.value })}
              min="0"
            />
            <Input
              label={lang === 'ar' ? 'نقطة إعادة الطلب' : 'Reorder Point'}
              type="number"
              value={inventoryForm.reorder_point}
              onChange={(e) => setInventoryForm({ ...inventoryForm, reorder_point: e.target.value })}
              min="0"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-secondary-100 dark:border-secondary-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddInventoryModalOpen(false)}
              disabled={inventorySaving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={inventorySaving}>
              {editingInventory ? t('common.save') : (lang === 'ar' ? 'إضافة إلى المستودع' : 'Add to Warehouse')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ═══════════════════════════════════════════════════════════
          MODAL: QUICK STOCK ADJUSTMENT
         ═══════════════════════════════════════════════════════════ */}
      {adjustForm && (
        <Modal
          open={adjustModalOpen}
          onClose={() => setAdjustModalOpen(false)}
          title={t('warehouse.quickAdjust')}
          size="md"
        >
          <form onSubmit={handleSaveStockAdjustment} className="space-y-4">
            <div className="p-3 bg-secondary-50 dark:bg-secondary-800/50 rounded-xl space-y-1 text-sm">
              <p className="font-bold text-secondary-900 dark:text-secondary-100">{adjustForm.product_name}</p>
              <div className="flex justify-between text-xs text-secondary-500">
                <span>{lang === 'ar' ? 'الرصيد الحالي بالمستودع:' : 'Current In-Stock:'}</span>
                <span className="font-bold text-secondary-800 dark:text-secondary-200">
                  {adjustForm.current_quantity}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select
                label={lang === 'ar' ? 'نوع التعديل' : 'Adjustment Type'}
                value={adjustForm.change_type}
                onChange={(e) =>
                  setAdjustForm({
                    ...adjustForm,
                    change_type: e.target.value as 'add' | 'remove',
                  })
                }
              >
                <option value="add">{lang === 'ar' ? 'زيادة (+) إضافة مخزون' : 'Add (+)'}</option>
                <option value="remove">{lang === 'ar' ? 'إنقاص (-) تسوية نقص' : 'Remove (-)'}</option>
              </Select>

              <Input
                label={lang === 'ar' ? 'كمية التعديل' : 'Adjustment Qty'}
                type="number"
                min="1"
                step="1"
                value={adjustForm.change_amount}
                onChange={(e) => setAdjustForm({ ...adjustForm, change_amount: e.target.value })}
                required
              />
            </div>

            <Select
              label={t('warehouse.adjustReason')}
              value={adjustForm.reason}
              onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
            >
              <option value="Physical Count Adjustment">{lang === 'ar' ? 'جرد فعلي للمخزون (Physical Count)' : 'Physical Count'}</option>
              <option value="Stock Restock / Receipt">{lang === 'ar' ? 'استلام وتوريد بضاعة جديدة' : 'Restock / Purchase'}</option>
              <option value="Damaged Goods">{lang === 'ar' ? 'تالف / بضاعة غير صالحة' : 'Damaged Goods'}</option>
              <option value="Expired Stock">{lang === 'ar' ? 'انتهاء الصلاحية' : 'Expired Stock'}</option>
              <option value="Inventory Correction">{lang === 'ar' ? 'تصحيح خطأ مدخلات' : 'Correction'}</option>
            </Select>

            <Input
              label={t('warehouse.notes')}
              value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
              placeholder={lang === 'ar' ? 'ملاحظات تدقيق الحركة...' : 'Audit notes or remarks...'}
            />

            <div className="flex justify-end gap-2 pt-3 border-t border-secondary-100 dark:border-secondary-800">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setAdjustModalOpen(false)}
                disabled={adjustSaving}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" loading={adjustSaving}>
                {lang === 'ar' ? 'تأكيد وحفظ التعديل' : 'Confirm & Save'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ═══════════════════════════════════════════════════════════
          MODAL: NEW STOCK TRANSFER
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={transferModalOpen}
        onClose={() => setTransferModalOpen(false)}
        title={t('warehouse.newTransfer')}
        size="md"
      >
        <form onSubmit={handleCreateTransfer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label={`${t('warehouse.sourceWarehouse')} *`}
              value={transferForm.source_warehouse_id}
              onChange={(e) => setTransferForm({ ...transferForm, source_warehouse_id: e.target.value })}
              required
            >
              <option value="">{lang === 'ar' ? 'اختر المصدر...' : 'Select Source...'}</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} {wh.code ? `(${wh.code})` : ''}
                </option>
              ))}
            </Select>

            <Select
              label={`${t('warehouse.destinationWarehouse')} *`}
              value={transferForm.destination_warehouse_id}
              onChange={(e) => setTransferForm({ ...transferForm, destination_warehouse_id: e.target.value })}
              required
            >
              <option value="">{lang === 'ar' ? 'اختر الوجهة...' : 'Select Destination...'}</option>
              {warehouses
                .filter((wh) => wh.id !== transferForm.source_warehouse_id)
                .map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} {wh.code ? `(${wh.code})` : ''}
                  </option>
                ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <Select
                label={`${lang === 'ar' ? 'المنتج المنقول' : 'Product to Transfer'} *`}
                value={transferForm.product_id}
                onChange={(e) => setTransferForm({ ...transferForm, product_id: e.target.value })}
                required
              >
                <option value="">{lang === 'ar' ? 'اختر المنتج...' : 'Select Product...'}</option>
                {products.map((p) => {
                  const srcInv = inventory.find(
                    (inv) =>
                      inv.warehouse_id === transferForm.source_warehouse_id && inv.product_id === p.id
                  );
                  const avail = Number(srcInv?.quantity_available || 0);

                  return (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.sku ? `(${p.sku})` : ''} — {lang === 'ar' ? 'المتوفر بالمصدر:' : 'Avail:'} {avail}
                    </option>
                  );
                })}
              </Select>
            </div>

            <Input
              label={`${lang === 'ar' ? 'الكمية' : 'Quantity'} *`}
              type="number"
              min="1"
              step="1"
              value={transferForm.quantity}
              onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
              required
            />
          </div>

          <Input
            label={t('warehouse.transferDate')}
            type="date"
            value={transferForm.transfer_date}
            onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
            required
          />

          <Input
            label={lang === 'ar' ? 'سبب التحويل' : 'Transfer Reason'}
            value={transferForm.reason}
            onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
            placeholder={lang === 'ar' ? 'إعادة توازن فروع، تلبية طلب مبيعات...' : 'Branch rebalancing, sale fulfilment...'}
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-secondary-100 dark:border-secondary-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setTransferModalOpen(false)}
              disabled={transferSaving}
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={transferSaving}>
              <Send size={14} />
              {lang === 'ar' ? 'تأكيد وإرسال التحويل' : 'Dispatch Transfer'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteWarehouseTarget}
        onClose={() => setDeleteWarehouseTarget(null)}
        onConfirm={confirmDeleteWarehouse}
        title={t('warehouse.deleteConfirm')}
        message={
          deleteWarning ||
          (lang === 'ar'
            ? `هل أنت متأكد من حذف مستودع "${deleteWarehouseTarget?.name}"؟ هذا الإجراء لا يمكن التراجع عنه.`
            : `Are you sure you want to delete warehouse "${deleteWarehouseTarget?.name}"? This action cannot be undone.`)
        }
        confirmLabel={t('common.delete')}
        danger={true}
      />

      {/* ═══════════════════════════════════════════════════════════
          MODAL: SQL MIGRATION & SUPABASE SETUP
         ═══════════════════════════════════════════════════════════ */}
      <Modal
        open={showSqlModal}
        onClose={() => setShowSqlModal(false)}
        title={lang === 'ar' ? 'تهيئة جداول المستودعات في Supabase' : 'Setup Warehouse Tables in Supabase'}
        size="lg"
      >
        <div className="space-y-5">
          {/* Info Banner */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded-lg shrink-0 mt-0.5">
                <Database size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  {lang === 'ar'
                    ? 'سبب ظهور خطأ "Could not find the table public.warehouses in schema cache"'
                    : 'Why "Could not find the table public.warehouses in schema cache" happens'}
                </h4>
                <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-1 leading-relaxed">
                  {lang === 'ar'
                    ? 'هذا التنبيه يظهر لأن قاعدة بيانات Supabase الخارجية الخاصة بك لم يتم فيها إنشاء جدول public.warehouses والجداول المرتبطة به بعد. التطبيق يعمل الآن تلقائياً بنظام التخزين الاحتياطي الذكي لكي لا تتعطل أعمالك، ولكن لتفعيل الحفظ المركزي والمزامنة السحابية الكاملة يرجى تطبيق كود SQL التالي.'
                    : 'This happens because your remote Supabase project does not have the public.warehouses table created yet. The app currently runs in resilient local storage mode so you are never blocked, but to enable central cloud synchronization, simply run the SQL script below.'}
                </p>
              </div>
            </div>
          </div>

          {/* Step by step guide */}
          <div className="bg-secondary-50 dark:bg-secondary-800/40 border border-secondary-200 dark:border-secondary-700 rounded-xl p-4 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-secondary-700 dark:text-secondary-300">
              {lang === 'ar' ? 'طريقة التفعيل في 3 خطوات بسيطة (تستغرق 15 ثانية):' : '3-Step Setup Guide (Takes 15 seconds):'}
            </h5>
            <ol className="text-xs space-y-2.5 text-secondary-600 dark:text-secondary-300 list-decimal list-inside">
              <li>
                <span className="font-semibold text-secondary-900 dark:text-white">
                  {lang === 'ar' ? 'نسخ كود SQL:' : 'Copy SQL Script:'}
                </span>{' '}
                {lang === 'ar' ? 'اضغط على زر "نسخ كود SQL" بالأسفل.' : 'Click the "Copy SQL Code" button below.'}
              </li>
              <li>
                <span className="font-semibold text-secondary-900 dark:text-white">
                  {lang === 'ar' ? 'تشغيل الكود في Supabase:' : 'Run in Supabase:'}
                </span>{' '}
                {lang === 'ar'
                  ? 'افتح لوحة تحكم Supabase لمشروعك، اختر من القائمة الجانبية SQL Editor، الصق الكود، ثم اضغط زر RUN.'
                  : 'Open your Supabase Project Dashboard, go to SQL Editor from the sidebar, paste the code, and click RUN.'}
              </li>
              <li>
                <span className="font-semibold text-secondary-900 dark:text-white">
                  {lang === 'ar' ? 'فحص الاتصال ومزامنة البيانات:' : 'Verify & Sync:'}
                </span>{' '}
                {lang === 'ar'
                  ? 'عُد إلى هنا واضغط زر "فحص الاتصال ومزامنة البيانات" ليتم ربط المستودعات ونقل أي بيانات محلية إلى السحابة فوراً.'
                  : 'Return here and click "Verify DB & Sync" to connect and upload any local warehouses instantly.'}
              </li>
            </ol>
          </div>

          {/* SQL Code Block with Header and Copy Button */}
          <div className="relative rounded-xl border border-secondary-300 dark:border-secondary-700 bg-secondary-950 text-secondary-100 overflow-hidden text-left" dir="ltr">
            <div className="flex items-center justify-between px-4 py-2.5 bg-secondary-900/80 border-b border-secondary-800 text-xs">
              <span className="font-mono text-secondary-400">supabase_warehouse_schema.sql</span>
              <button
                type="button"
                onClick={handleCopySql}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-secondary-800 hover:bg-secondary-700 text-secondary-200 transition-colors text-xs font-semibold cursor-pointer"
              >
                {sqlCopied ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-400">{lang === 'ar' ? 'تم النسخ!' : 'Copied!'}</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>{lang === 'ar' ? 'نسخ الكود' : 'Copy SQL'}</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono overflow-x-auto max-h-64 leading-relaxed text-secondary-200 selection:bg-primary-900">
              {WAREHOUSE_MIGRATION_SQL}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-secondary-100 dark:border-secondary-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowSqlModal(false)}
            >
              {lang === 'ar' ? 'إغلاق ومتابعة العمل محلياً' : 'Close & Continue Locally'}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleCopySql}
                className="text-xs"
              >
                {sqlCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                {sqlCopied ? (lang === 'ar' ? 'تم النسخ' : 'Copied') : (lang === 'ar' ? 'نسخ كود SQL' : 'Copy SQL')}
              </Button>
              <Button
                type="button"
                onClick={handleRecheckDatabase}
                loading={checkingDb}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                <RefreshCw size={14} />
                {lang === 'ar' ? 'فحص الاتصال ومزامنة البيانات' : 'Verify DB & Sync'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

