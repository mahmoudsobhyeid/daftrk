import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useCurrency, useFormatDate } from '../lib/format';
import { Card } from '../components/ui/Card';
import { Input, Textarea, Select } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Skeleton, EmptyState } from '../components/ui/Feedback';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { Table, TableHead, TableBody, TableRow, Th, Td } from '../components/ui/Table';
import {
  Package, Plus, Search, Pencil, Trash2, Upload, Download,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  FileSpreadsheet, ArrowUpDown, AlertTriangle, Boxes, TrendingDown, X,
  Image as ImageIcon,
} from 'lucide-react';
import type { Product, ProductStatus } from '../lib/types';

type SortKey = 'name' | 'price' | 'stock' | 'created_at';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;
const units = ['piece', 'hour', 'day', 'kg', 'meter', 'service', 'box', 'liter'];

const emptyForm = {
  name: '', name_ar: '', description: '', price: '', cost: '', tax_rate: '',
  unit: 'piece', sku: '', barcode: '', category: '',
  stock_quantity: '0', min_stock: '0', default_warehouse_id: '', status: 'active' as ProductStatus,
};

export function ProductsPage() {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const { toast } = useToast();
  const { canAdd, usage, limitOf, refresh: refreshSub } = useSubscription();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();

  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | ProductStatus>('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!company) return;
    setLoading(true);
    const [productsData, warehousesData] = await Promise.all([
      supabase
        .from('products')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('warehouses')
        .select('*')
        .eq('company_id', company.id)
        .eq('is_active', true),
    ]);
    setProducts((productsData.data as Product[]) ?? []);
    setWarehouses(warehousesData.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [company]);

  // Categories derived from products
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = products.filter((p) => {
      const matchesSearch = !q ||
        p.name.toLowerCase().includes(q) ||
        (p.name_ar ?? '').toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || (p.category ?? '') === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = (lang === 'ar' ? (a.name_ar || a.name) : a.name).localeCompare(lang === 'ar' ? (b.name_ar || b.name) : b.name);
      } else if (sortKey === 'price') {
        cmp = Number(a.price) - Number(b.price);
      } else if (sortKey === 'stock') {
        cmp = Number(a.stock_quantity) - Number(b.stock_quantity);
      } else {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [products, search, statusFilter, categoryFilter, sortKey, sortDir, lang]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter, categoryFilter, sortKey, sortDir]);

  // Inventory stats
  const inventory = useMemo(() => {
    const total = products.length;
    const stockValue = products.reduce((s, p) => s + Number(p.cost) * Number(p.stock_quantity), 0);
    const lowStock = products.filter((p) => Number(p.stock_quantity) > 0 && Number(p.stock_quantity) <= Number(p.min_stock)).length;
    const outOfStock = products.filter((p) => Number(p.stock_quantity) === 0).length;
    return { total, stockValue, lowStock, outOfStock };
  }, [products]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const closeModal = useCallback(() => setModalOpen(false), []);
  const closeImport = useCallback(() => setImportOpen(false), []);

  const openAdd = () => {
    if (!canAdd('products')) {
      toast(t('plans.limitReachedDesc'), 'error');
      return;
    }
    setEditing(null);
    setForm(emptyForm);
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, name_ar: p.name_ar ?? '', description: p.description ?? '',
      price: String(p.price), cost: String(p.cost), tax_rate: String(p.tax_rate),
      unit: p.unit, sku: p.sku ?? '', barcode: p.barcode ?? '', category: p.category ?? '',
      stock_quantity: String(p.stock_quantity), min_stock: String(p.min_stock),
      status: p.status,
    });
    setImageFile(null);
    if (p.image_path) {
      const { data } = supabase.storage.from('product-images').getPublicUrl(p.image_path);
      setImagePreview(data.publicUrl);
    } else {
      setImagePreview(null);
    }
    setModalOpen(true);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast(t('products.imageHint'), 'error'); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    if (imagePreview && imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company || !form.name.trim() || !form.price) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim() || null,
      description: form.description.trim() || null,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      tax_rate: parseFloat(form.tax_rate) || 0,
      unit: form.unit,
      sku: form.sku.trim() || null,
      barcode: form.barcode.trim() || null,
      category: form.category.trim() || null,
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      min_stock: parseFloat(form.min_stock) || 0,
      status: form.status,
    };

    let productId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('products').update(payload).eq('id', editing.id);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      toast(t('products.updated'));
    } else {
      const { data, error } = await supabase.from('products').insert({ ...payload, company_id: company.id }).select().single();
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
      productId = data.id;
      toast(t('products.created'));
    }

    // Upload image if selected
    if (imageFile && productId) {
      const ext = imageFile.name.split('.').pop();
      const path = `${productId}/image.${ext}`;
      const { error: upErr } = await supabase.storage.from('product-images').upload(path, imageFile, { upsert: true });
      if (!upErr) {
        await supabase.from('products').update({ image_path: path }).eq('id', productId);
      } else {
        toast(upErr.message, 'error');
      }
    }

    setSaving(false);
    setModalOpen(false);
    load();
    if (!editing) refreshSub();
  };

  const doDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.image_path) {
      await supabase.storage.from('product-images').remove([deleteTarget.image_path]);
    }
    const { error } = await supabase.from('products').delete().eq('id', deleteTarget.id);
    if (!error) { toast(t('products.deleted')); load(); }
    else toast(error.message, 'error');
    setDeleteTarget(null);
  };

  // --- Excel Export ---
  const exportExcel = () => {
    const rows = filtered.map((p) => ({
      Name: p.name, 'Name (Arabic)': p.name_ar ?? '', SKU: p.sku ?? '', Barcode: p.barcode ?? '',
      Category: p.category ?? '', Unit: p.unit, Cost: p.cost, Price: p.price,
      Stock: p.stock_quantity, 'Min Stock': p.min_stock, Description: p.description ?? '',
      Status: p.status, 'Tax Rate': p.tax_rate, 'Created At': fmtDate(p.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Products');
    XLSX.writeFile(wb, `products-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(t('products.exportSuccess').replace('{count}', String(filtered.length)));
  };

  // --- Excel Import ---
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;
    setImporting(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      if (rows.length === 0) {
        toast(t('products.importError').replace('{error}', 'Empty file'), 'error');
        setImporting(false); return;
      }

      const toInsert = rows.map((r) => ({
        company_id: company.id,
        name: String(r['Name'] ?? r['name'] ?? '').trim(),
        name_ar: String(r['Name (Arabic)'] ?? r['name_ar'] ?? '').trim() || null,
        sku: String(r['SKU'] ?? r['sku'] ?? '').trim() || null,
        barcode: String(r['Barcode'] ?? r['barcode'] ?? '').trim() || null,
        category: String(r['Category'] ?? r['category'] ?? '').trim() || null,
        unit: String(r['Unit'] ?? r['unit'] ?? 'piece').trim() || 'piece',
        cost: parseFloat(String(r['Cost'] ?? r['cost'] ?? 0)) || 0,
        price: parseFloat(String(r['Price'] ?? r['price'] ?? 0)) || 0,
        stock_quantity: parseFloat(String(r['Stock'] ?? r['stock_quantity'] ?? 0)) || 0,
        min_stock: parseFloat(String(r['Min Stock'] ?? r['min_stock'] ?? 0)) || 0,
        description: String(r['Description'] ?? r['description'] ?? '').trim() || null,
        tax_rate: parseFloat(String(r['Tax Rate'] ?? r['tax_rate'] ?? 0)) || 0,
        default_warehouse_id: String(r['Default Warehouse'] ?? r['default_warehouse_id'] ?? '').trim() || null,
        status: (String(r['Status'] ?? r['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active') as ProductStatus,
      })).filter((r) => r.name);

      if (toInsert.length === 0) {
        toast(t('products.importError').replace('{error}', 'No valid rows'), 'error');
        setImporting(false); return;
      }

      const { error } = await supabase.from('products').insert(toInsert);
      if (error) {
        toast(t('products.importError').replace('{error}', error.message), 'error');
      } else {
        toast(t('products.importSuccess').replace('{count}', String(toInsert.length)));
        load(); setImportOpen(false);
      }
    } catch (err) {
      toast(t('products.importError').replace('{error}', String(err)), 'error');
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const tmpl = [{
      Name: 'Sample Product', 'Name (Arabic)': '', SKU: 'SKU-001', Barcode: '',
      Category: 'General', Unit: 'piece', Cost: 10, Price: 25, Stock: 100,
      'Min Stock': 10, Description: 'Sample description', Status: 'active', 'Tax Rate': 0,
    }];
    const ws = XLSX.utils.json_to_sheet(tmpl);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'products-template.xlsx');
  };

  const stockStatus = (p: Product): 'in' | 'low' | 'out' => {
    const qty = Number(p.stock_quantity);
    if (qty === 0) return 'out';
    if (qty <= Number(p.min_stock)) return 'low';
    return 'in';
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">{t('products.title')}</h1>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            {t('products.results').replace('{count}', String(filtered.length))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> {t('products.import')}
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download size={16} /> {t('products.export')}
          </Button>
          <Button onClick={openAdd} disabled={!canAdd('products')}>
            <Plus size={16} />
            {t('products.add')}
            {limitOf('products') !== null && (
              <span className="ms-1 text-xs opacity-70">({usage.products}/{limitOf('products')})</span>
            )}
          </Button>
        </div>
      </div>

      {/* Inventory counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card variant="hover" className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400 shrink-0">
              <Boxes size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">{t('products.totalProducts')}</p>
              <p className="text-xl font-bold text-secondary-800 dark:text-secondary-100">{inventory.total}</p>
            </div>
          </div>
        </Card>
        <Card variant="hover" className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-900/20 dark:text-success-400 shrink-0">
              <Package size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">{t('products.totalStockValue')}</p>
              <p className="text-xl font-bold text-secondary-800 dark:text-secondary-100 truncate">{fmt(inventory.stockValue, company?.currency)}</p>
            </div>
          </div>
        </Card>
        <Card variant="hover" className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-900/20 dark:text-warning-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">{t('products.lowStockItems')}</p>
              <p className="text-xl font-bold text-secondary-800 dark:text-secondary-100">{inventory.lowStock}</p>
            </div>
          </div>
        </Card>
        <Card variant="hover" className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-danger-50 text-danger-600 dark:bg-danger-900/20 dark:text-danger-400 shrink-0">
              <TrendingDown size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-secondary-500 uppercase tracking-wider">{t('products.outOfStockItems')}</p>
              <p className="text-xl font-bold text-secondary-800 dark:text-secondary-100">{inventory.outOfStock}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Stock alert banner */}
      {inventory.lowStock + inventory.outOfStock > 0 && (
        <Card className="p-4 border-warning-200 dark:border-warning-800/50 bg-warning-50/50 dark:bg-warning-900/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-100 text-warning-600 dark:bg-warning-900/30 dark:text-warning-400 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100">{t('products.stockAlerts')}</p>
              <p className="text-xs text-secondary-500">
                {inventory.lowStock} {t('products.lowStock').toLowerCase()} · {inventory.outOfStock} {t('products.outOfStock').toLowerCase()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-secondary-400 pointer-events-none" />
          <input className="input ps-10" placeholder={t('products.search')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="sm:w-40">
          <option value="all">{t('products.allCategories')}</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | ProductStatus)} className="sm:w-36">
          <option value="all">{t('products.allStatuses')}</option>
          <option value="active">{t('products.active')}</option>
          <option value="inactive">{t('products.inactive')}</option>
        </Select>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="sm:w-36">
          <option value="created_at">{t('products.sortDate')}</option>
          <option value="name">{t('products.sortName')}</option>
          <option value="price">{t('products.sortPrice')}</option>
          <option value="stock">{t('products.sortStock')}</option>
        </Select>
        <Button variant="outline" size="md" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className="shrink-0">
          {sortDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <ProductTableSkeleton />
      ) : paginated.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package size={28} />}
            title={search || statusFilter !== 'all' || categoryFilter !== 'all' ? t('products.noResults') : t('products.empty')}
            description={search || statusFilter !== 'all' || categoryFilter !== 'all' ? '' : t('products.emptyDesc')}
            action={!search && statusFilter === 'all' && categoryFilter === 'all' ? <Button onClick={openAdd}><Plus size={16} /> {t('products.add')}</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHead>
              <tr>
                <Th>
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1.5 hover:text-secondary-700 dark:hover:text-secondary-200 transition-colors">
                    {t('products.name')} <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </Th>
                <Th className="hidden md:table-cell">{t('products.sku')}</Th>
                <Th className="hidden lg:table-cell">{t('products.category')}</Th>
                <Th>
                  <button onClick={() => toggleSort('price')} className="flex items-center gap-1.5 hover:text-secondary-700 dark:hover:text-secondary-200 transition-colors">
                    {t('products.sellingPrice')} <SortIcon col="price" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </Th>
                <Th>
                  <button onClick={() => toggleSort('stock')} className="flex items-center gap-1.5 hover:text-secondary-700 dark:hover:text-secondary-200 transition-colors">
                    {t('products.stockQty')} <SortIcon col="stock" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </Th>
                <Th className="hidden sm:table-cell">{t('products.status')}</Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </TableHead>
            <TableBody>
              {paginated.map((p) => {
                const ss = stockStatus(p);
                return (
                  <TableRow key={p.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg overflow-hidden bg-secondary-100 dark:bg-secondary-800 shrink-0 flex items-center justify-center">
                          {p.image_path ? (
                            <img src={supabase.storage.from('product-images').getPublicUrl(p.image_path).data.publicUrl} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package size={16} className="text-secondary-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-secondary-800 dark:text-secondary-100 truncate">{lang === 'ar' ? (p.name_ar || p.name) : p.name}</p>
                          {p.barcode && <p className="text-xs text-secondary-400 font-mono truncate">{p.barcode}</p>}
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden md:table-cell font-mono text-xs text-secondary-500">{p.sku ?? '—'}</Td>
                    <Td className="hidden lg:table-cell text-secondary-500">{p.category ?? '—'}</Td>
                    <Td className="font-bold text-secondary-800 dark:text-secondary-100">{fmt(Number(p.price), company?.currency)}</Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-secondary-800 dark:text-secondary-100">{Number(p.stock_quantity)}</span>
                        <StockBadge status={ss} t={t} />
                      </div>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <StatusPill status={p.status} t={t} />
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(p)} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700 dark:hover:bg-secondary-800 dark:hover:text-secondary-200 transition-colors">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => setDeleteTarget(p)} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30 dark:hover:text-danger-400 transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </Td>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-secondary-200 dark:border-secondary-800">
              <p className="text-sm text-secondary-500 dark:text-secondary-400">
                {t('products.page').replace('{page}', String(currentPage)).replace('{total}', String(totalPages))}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  <ChevronLeft size={15} className="rtl:rotate-180" />
                </Button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p} onClick={() => setPage(p)} className={`h-8 min-w-8 px-2 rounded-lg text-sm font-semibold transition-colors ${p === currentPage ? 'bg-primary-600 text-white' : 'text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800'}`}>
                      {p}
                    </button>
                  );
                })}
                <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setPage(currentPage + 1)}>
                  <ChevronRight size={15} className="rtl:rotate-180" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editing ? t('products.edit') : t('products.add')} size="lg">
        <form onSubmit={save} className="space-y-4">
          {/* Image upload */}
          <div className="flex flex-col items-center gap-3 pb-2">
            <div className="relative">
              <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-secondary-300 dark:border-secondary-700 flex items-center justify-center overflow-hidden bg-secondary-50 dark:bg-secondary-900">
                {imagePreview ? (
                  <img src={imagePreview} alt="product" className="h-full w-full object-cover" />
                ) : (
                  <ImageIcon size={28} className="text-secondary-400" />
                )}
              </div>
              {imagePreview && (
                <button type="button" onClick={removeImage} className="absolute -top-2 -end-2 h-7 w-7 rounded-full bg-danger-500 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                  <X size={14} />
                </button>
              )}
            </div>
            <input ref={imageInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleImageChange} />
            <button type="button" onClick={() => imageInputRef.current?.click()} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-50 text-primary-700 text-sm font-semibold hover:bg-primary-100 dark:bg-primary-900/30 dark:text-primary-300 transition-colors">
              <Upload size={14} />
              {imagePreview ? t('products.changeImage') : t('products.uploadImage')}
            </button>
            <p className="text-xs text-secondary-400">{t('products.imageHint')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={`${t('products.name')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <Input label={t('products.nameAr')} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" hint={t('common.optional')} />
            <Input label={t('products.sku')} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} hint={t('common.optional')} />
            <Input label={t('products.barcode')} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} hint={t('common.optional')} />
            <Input label={t('products.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} hint={t('common.optional')} />
            <Select label={t('products.defaultWarehouse')} value={form.default_warehouse_id} onChange={(e) => setForm({ ...form, default_warehouse_id: e.target.value })} hint={t('common.optional')}>
              <option value="">{t('common.selectWarehouse') || 'Select Warehouse'}</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name} {w.code ? `(${w.code})` : ''}</option>
              ))}
            </Select>
            <Select label={t('products.unit')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
            <Input label={`${t('products.cost')} *`} type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} />
            <Input label={`${t('products.sellingPrice')} *`} type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
            <Input label={t('products.stockQty')} type="number" step="1" min="0" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} />
            <Input label={t('products.minStock')} type="number" step="1" min="0" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} />
            <Input label={t('products.taxRate')} type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: e.target.value })} hint={t('common.optional')} />
            <Select label={t('products.status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductStatus })}>
              <option value="active">{t('products.active')}</option>
              <option value="inactive">{t('products.inactive')}</option>
            </Select>
          </div>
          <Textarea label={t('products.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} hint={t('common.optional')} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('products.cancel')}</Button>
            <Button type="submit" loading={saving}>{t('products.save')}</Button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal open={importOpen} onClose={closeImport} title={t('products.importTitle')} description={t('products.importSubtitle')} size="md">
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed border-secondary-200 dark:border-secondary-700 rounded-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
              <FileSpreadsheet size={28} />
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={importing}>
              <Upload size={16} /> {t('products.import')}
            </Button>
            <button onClick={downloadTemplate} className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
              {t('products.downloadTemplate')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title={t('products.delete')}
        message={t('products.deleteConfirmName').replace('{name}', lang === 'ar' ? (deleteTarget?.name_ar || deleteTarget?.name || '') : (deleteTarget?.name || ''))}
        confirmLabel={t('products.delete')}
      />
    </div>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown size={13} className="text-secondary-300" />;
  return sortDir === 'asc' ? <ChevronUp size={14} className="text-primary-500" /> : <ChevronDown size={14} className="text-primary-500" />;
}

function StockBadge({ status, t }: { status: 'in' | 'low' | 'out'; t: (k: string) => string }) {
  const styles = {
    in: 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400',
    low: 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400',
    out: 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  };
  const labels = { in: t('products.inStock'), low: t('products.lowStock'), out: t('products.outOfStock') };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}

function StatusPill({ status, t }: { status: ProductStatus; t: (k: string) => string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${active ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400' : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success-500' : 'bg-secondary-400'}`} />
      {active ? t('products.active') : t('products.inactive')}
    </span>
  );
}

function ProductTableSkeleton() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 py-4 border-b border-secondary-200 dark:border-secondary-800">
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="divide-y divide-secondary-100 dark:divide-secondary-800">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        ))}
      </div>
    </Card>
  );
}
