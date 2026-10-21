import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
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
  Users, Plus, Search, Pencil, Trash2, Mail, Phone,
  Upload, Download, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  FileSpreadsheet, ArrowUpDown, X,
} from 'lucide-react';
import type { Customer, CustomerStatus } from '../lib/types';

type SortKey = 'name' | 'created_at' | 'spent';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

const emptyForm = {
  name: '', name_ar: '', email: '', phone: '', address: '', city: '',
  country: '', tax_number: '', notes: '', status: 'active' as CustomerStatus,
};

export function CustomersPage() {
  const { t, lang } = useLanguage();
  const { company } = useCompany();
  const { toast } = useToast();
  const { canAdd, usage, limitOf, refresh: refreshSub } = useSubscription();
  const fmt = useCurrency();
  const fmtDate = useFormatDate();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [spending, setSpending] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [statusFilter, setStatusFilter] = useState<'all' | CustomerStatus>('all');
  const [page, setPage] = useState(1);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!company) return;
    setLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false });
    setCustomers((data as Customer[]) ?? []);

    if (data && data.length > 0) {
      const { data: invs } = await supabase
        .from('invoices')
        .select('customer_id, total, status')
        .eq('company_id', company.id)
        .in('status', ['paid', 'sent', 'overdue']);
      const spend: Record<string, number> = {};
      (invs ?? []).forEach((i: { customer_id: string; total: number }) => {
        spend[i.customer_id] = (spend[i.customer_id] ?? 0) + Number(i.total);
      });
      setSpending(spend);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [company]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = customers.filter((c) => {
      const matchesSearch = !q ||
        c.name.toLowerCase().includes(q) ||
        (c.name_ar ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.tax_number ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'name') {
        cmp = (lang === 'ar' ? (a.name_ar || a.name) : a.name).localeCompare(lang === 'ar' ? (b.name_ar || b.name) : b.name);
      } else if (sortKey === 'created_at') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortKey === 'spent') {
        cmp = (spending[a.id] ?? 0) - (spending[b.id] ?? 0);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [customers, search, statusFilter, sortKey, sortDir, spending, lang]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const openAdd = () => {
    if (!canAdd('customers')) {
      toast(t('plans.limitReachedDesc'), 'error');
      return;
    }
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setModalOpen(true);
  };

  const handleModalClose = useCallback(() => setModalOpen(false), []);
  const handleSaved = useCallback(() => {
    setModalOpen(false);
    load();
    refreshSub();
  }, []);

  const doDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id);
    if (!error) { toast(t('customers.deleted')); load(); }
    else toast(error.message, 'error');
    setDeleteTarget(null);
  };

  // --- Excel Export ---
  const exportExcel = () => {
    const rows = filtered.map((c) => ({
      Name: c.name,
      'Name (Arabic)': c.name_ar ?? '',
      Phone: c.phone ?? '',
      Email: c.email ?? '',
      'Tax Number': c.tax_number ?? '',
      Address: c.address ?? '',
      City: c.city ?? '',
      Country: c.country ?? '',
      Notes: c.notes ?? '',
      Status: c.status,
      'Total Spent': spending[c.id] ?? 0,
      'Created At': fmtDate(c.created_at),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers');
    XLSX.writeFile(wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast(t('customers.exportSuccess').replace('{count}', String(filtered.length)));
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
        toast(t('customers.importError').replace('{error}', 'Empty file'), 'error');
        setImporting(false);
        return;
      }

      const toInsert = rows.map((r) => ({
        company_id: company.id,
        name: String(r['Name'] ?? r['name'] ?? '').trim(),
        name_ar: String(r['Name (Arabic)'] ?? r['name_ar'] ?? '').trim() || null,
        phone: String(r['Phone'] ?? r['phone'] ?? '').trim() || null,
        email: String(r['Email'] ?? r['email'] ?? '').trim() || null,
        tax_number: String(r['Tax Number'] ?? r['tax_number'] ?? '').trim() || null,
        address: String(r['Address'] ?? r['address'] ?? '').trim() || null,
        city: String(r['City'] ?? r['city'] ?? '').trim() || null,
        country: String(r['Country'] ?? r['country'] ?? '').trim() || null,
        notes: String(r['Notes'] ?? r['notes'] ?? '').trim() || null,
        status: (String(r['Status'] ?? r['status'] ?? 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active') as CustomerStatus,
      })).filter((r) => r.name);

      if (toInsert.length === 0) {
        toast(t('customers.importError').replace('{error}', 'No valid rows'), 'error');
        setImporting(false);
        return;
      }

      const { error } = await supabase.from('customers').insert(toInsert);
      if (error) {
        toast(t('customers.importError').replace('{error}', error.message), 'error');
      } else {
        toast(t('customers.importSuccess').replace('{count}', String(toInsert.length)));
        load();
        setImportOpen(false);
      }
    } catch (err) {
      toast(t('customers.importError').replace('{error}', String(err)), 'error');
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const tmpl = [{
      'Account Number': '(auto-generated)', Name: 'John Doe', 'Name (Arabic)': '', Phone: '+971 50 123 4567',
      Email: 'john@example.com', 'Tax Number': '', Address: '123 Main St',
      City: 'Dubai', Country: 'United Arab Emirates', Notes: '', Status: 'active',
    }];
    const ws = XLSX.utils.json_to_sheet(tmpl);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'customers-template.xlsx');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100 tracking-tight">{t('customers.title')}</h1>
          <p className="mt-1 text-sm text-secondary-500 dark:text-secondary-400">
            {t('customers.results').replace('{count}', String(filtered.length))}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload size={16} /> {t('customers.import')}
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={filtered.length === 0}>
            <Download size={16} /> {t('customers.export')}
          </Button>
          <Button onClick={openAdd} disabled={!canAdd('customers')}>
            <Plus size={16} />
            {t('customers.add')}
            {limitOf('customers') !== null && (
              <span className="ms-1 text-xs opacity-70">({usage.customers}/{limitOf('customers')})</span>
            )}
          </Button>
        </div>
      </div>

      {/* Toolbar: search, sort, filter */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute top-1/2 -translate-y-1/2 start-3.5 text-secondary-400 pointer-events-none" />
            <input
              className="input ps-10 pe-10"
              placeholder={t('customers.search')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('customers.search')}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute top-1/2 -translate-y-1/2 end-3 flex h-6 w-6 items-center justify-center rounded-full text-secondary-400 hover:bg-secondary-100 hover:text-secondary-600 dark:hover:bg-secondary-800 dark:hover:text-secondary-200 transition-colors"
                aria-label={t('customers.clearSearch')}
              >
                <X size={14} />
              </button>
            )}
          </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | CustomerStatus)} className="sm:w-40">
          <option value="all">{t('customers.allStatuses')}</option>
          <option value="active">{t('customers.active')}</option>
          <option value="inactive">{t('customers.inactive')}</option>
        </Select>
        <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className="sm:w-40">
          <option value="created_at">{t('customers.sortDate')}</option>
          <option value="name">{t('customers.sortName')}</option>
          <option value="spent">{t('customers.sortSpent')}</option>
        </Select>
        <Button variant="outline" size="md" onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')} className="shrink-0">
          {sortDir === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </div>
      {search && (
        <p className="text-xs text-secondary-400 dark:text-secondary-500 flex items-center gap-1.5">
          <Search size={11} />
          {t('customers.searchHint')}
        </p>
      )}
      </div>

      {/* Table */}
      {loading ? (
        <CustomerTableSkeleton />
      ) : paginated.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users size={28} />}
            title={search || statusFilter !== 'all' ? t('customers.noResults') : t('customers.empty')}
            description={search || statusFilter !== 'all' ? '' : t('customers.emptyDesc')}
            action={!search && statusFilter === 'all' ? <Button onClick={openAdd}><Plus size={16} /> {t('customers.add')}</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHead>
              <tr>
                <Th className="hidden md:table-cell">{t('customers.accountNumberShort')}</Th>
                <Th>
                  <button onClick={() => toggleSort('name')} className="flex items-center gap-1.5 hover:text-secondary-700 dark:hover:text-secondary-200 transition-colors">
                    {t('customers.name')} <SortIcon col="name" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </Th>
                <Th className="hidden md:table-cell">{t('customers.phone')}</Th>
                <Th className="hidden lg:table-cell">{t('customers.city')}</Th>
                <Th className="hidden xl:table-cell">{t('customers.taxNumber')}</Th>
                <Th>
                  <button onClick={() => toggleSort('spent')} className="flex items-center gap-1.5 hover:text-secondary-700 dark:hover:text-secondary-200 transition-colors">
                    {t('customers.totalSpent')} <SortIcon col="spent" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </Th>
                <Th>{t('customers.status')}</Th>
                <Th>
                  <button onClick={() => toggleSort('created_at')} className="flex items-center gap-1.5 hover:text-secondary-700 dark:hover:text-secondary-200 transition-colors">
                    {t('customers.sortDate')} <SortIcon col="created_at" sortKey={sortKey} sortDir={sortDir} />
                  </button>
                </Th>
                <Th className="text-end">{t('common.actions')}</Th>
              </tr>
            </TableHead>
            <TableBody>
              {paginated.map((c) => (
                <TableRow key={c.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 text-white font-bold text-sm shrink-0">
                        {(lang === 'ar' ? (c.name_ar || c.name) : c.name).charAt(0).toUpperCase()
                        }
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-secondary-800 dark:text-secondary-100 truncate">
                          {lang === 'ar' ? (c.name_ar || c.name) : c.name}
                        </p>
                        {c.email && <p className="text-xs text-secondary-400 truncate flex items-center gap-1"><Mail size={10} /> {c.email}</p>}
                      </div>
                    </div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    {c.phone ? <span className="flex items-center gap-1.5 text-secondary-500"><Phone size={12} /> {c.phone}</span> : '—'}
                  </Td>
                  <Td className="hidden lg:table-cell text-secondary-500">{c.city || '—'}</Td>
                  <Td className="hidden xl:table-cell text-secondary-500">{c.tax_number || '—'}</Td>
                  <Td className="font-semibold text-secondary-800 dark:text-secondary-100">{fmt(spending[c.id] ?? 0, company?.currency)}</Td>
                  <Td>
                    <StatusPill status={c.status} t={t} />
                  </Td>
                  <Td className="text-secondary-400 text-xs">{fmtDate(c.created_at)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(c)} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-secondary-100 hover:text-secondary-700 dark:hover:bg-secondary-800 dark:hover:text-secondary-200 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteTarget(c)} className="flex h-8 w-8 items-center justify-center rounded-lg text-secondary-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-900/30 dark:hover:text-danger-400 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </Td>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-4 border-t border-secondary-200 dark:border-secondary-800">
              <p className="text-sm text-secondary-500 dark:text-secondary-400">
                {t('customers.page').replace('{page}', String(currentPage)).replace('{total}', String(totalPages))}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                  <ChevronLeft size={15} className="rtl:rotate-180" />
                </Button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`h-8 min-w-8 px-2 rounded-lg text-sm font-semibold transition-colors ${
                        p === currentPage
                          ? 'bg-primary-600 text-white'
                          : 'text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800'
                      }`}
                    >
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
      <CustomerFormModal
        open={modalOpen}
        onClose={handleModalClose}
        onSaved={handleSaved}
        editing={editing}
        companyId={company?.id}
        t={t}
        toast={toast}
      />

      {/* Import Modal */}
      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={t('customers.importTitle')}
        description={t('customers.importSubtitle')}
        size="md"
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-4 py-6 border-2 border-dashed border-secondary-200 dark:border-secondary-700 rounded-2xl">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
              <FileSpreadsheet size={28} />
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} loading={importing}>
              <Upload size={16} /> {t('customers.import')}
            </Button>
            <button onClick={downloadTemplate} className="text-sm font-semibold text-primary-600 hover:text-primary-700 dark:text-primary-400 transition-colors">
              {t('customers.downloadTemplate')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        title={t('customers.delete')}
        message={t('customers.deleteConfirmName').replace('{name}', lang === 'ar' ? (deleteTarget?.name_ar || deleteTarget?.name || '') : (deleteTarget?.name || ''))}
        confirmLabel={t('customers.delete')}
      />
    </div>
  );
}

function CustomerFormModal({
  open, onClose, onSaved, editing, companyId, t, toast,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Customer | null;
  companyId: string | undefined;
  t: (k: string) => string;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          name: editing.name, name_ar: editing.name_ar ?? '', email: editing.email ?? '', phone: editing.phone ?? '',
          address: editing.address ?? '', city: editing.city ?? '', country: editing.country ?? '',
          tax_number: editing.tax_number ?? '', notes: editing.notes ?? '', status: editing.status,
        });
      } else {
        setForm(emptyForm);
      }
    }
  }, [open, editing]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      name_ar: form.name_ar.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      tax_number: form.tax_number.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    };

    if (editing) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editing.id);
      if (!error) toast(t('customers.updated'));
      else toast(error.message, 'error');
    } else {
      const { error } = await supabase.from('customers').insert({ ...payload, company_id: companyId });
      if (!error) toast(t('customers.created'));
      else toast(error.message, 'error');
    }

    setSaving(false);
    onSaved();
  };

  const handleClose = useCallback(() => onClose(), [onClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={editing ? t('customers.edit') : t('customers.add')}
      size="lg"
    >
      <form onSubmit={save} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label={`${t('customers.name')} *`} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input label={t('customers.nameAr')} value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" hint={t('common.optional')} />
          <Input label={t('customers.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} hint={t('common.optional')} />
          <Input label={t('customers.phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} hint={t('common.optional')} />
          <Input label={t('customers.taxNumber')} value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} hint={t('common.optional')} />
          <Select label={t('customers.status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as CustomerStatus })}>
            <option value="active">{t('customers.active')}</option>
            <option value="inactive">{t('customers.inactive')}</option>
          </Select>
          <Input label={t('customers.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} hint={t('common.optional')} />
          <Input label={t('customers.city')} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} hint={t('common.optional')} />
          <Input label={t('customers.country')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} hint={t('common.optional')} />
        </div>
        <Textarea label={t('customers.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} hint={t('common.optional')} />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>{t('customers.cancel')}</Button>
          <Button type="submit" loading={saving}>{t('customers.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

function SortIcon({ col, sortKey, sortDir }: { col: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== col) return <ArrowUpDown size={13} className="text-secondary-300" />;
  return sortDir === 'asc' ? <ChevronUp size={14} className="text-primary-500" /> : <ChevronDown size={14} className="text-primary-500" />;
}

function StatusPill({ status, t }: { status: CustomerStatus; t: (k: string) => string }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
      active
        ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-400'
        : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400'
    }`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-success-500' : 'bg-secondary-400'}`} />
      {active ? t('customers.active') : t('customers.inactive')}
    </span>
  );
}

function CustomerTableSkeleton() {
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
