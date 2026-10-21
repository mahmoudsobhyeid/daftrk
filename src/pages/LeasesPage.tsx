import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus, FileText, Trash2, Pencil, Calendar, Phone, User, Download,
  Printer, Home, UserCheck, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useToast } from '../contexts/ToastContext';
import type { Lease, Unit, MaintenanceResponsibility, LeaseStatus, PaymentFrequency, LeaseInstallment } from '../lib/types';
import { generatePaymentSchedule } from '../lib/re-zatca';
import { exportElementToPdf, pdfPageBreak, PDF_HOST_STYLE, usePdfExport } from '../lib/pdf-export';
import { LeaseContractDocument } from '../components/LeaseContractDocument';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableHead, TableBody, TableRow, Th, Td } from '../components/ui/Table';
import { EmptyState, Spinner } from '../components/ui/Feedback';

interface LeaseForm {
  unit_id: string;
  contract_number: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  tenant_id_number: string;
  lessor_name: string;
  lessor_phone: string;
  lessor_id_number: string;
  start_date: string;
  end_date: string;
  rent_amount: string;
  payment_frequency: PaymentFrequency;
  maintenance_responsibility: MaintenanceResponsibility;
  security_deposit: string;
  status: LeaseStatus;
  notes: string;
}

const emptyForm: LeaseForm = {
  unit_id: '',
  contract_number: '',
  tenant_name: '',
  tenant_phone: '',
  tenant_email: '',
  tenant_id_number: '',
  lessor_name: '',
  lessor_phone: '',
  lessor_id_number: '',
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
  rent_amount: '',
  payment_frequency: 'monthly',
  maintenance_responsibility: 'landlord',
  security_deposit: '',
  status: 'draft',
  notes: '',
};

const STATUS_VARIANT: Record<LeaseStatus, 'success' | 'warning' | 'danger' | 'neutral'> = {
  draft: 'neutral',
  active: 'success',
  expired: 'warning',
  terminated: 'danger',
};

function LeaseFormModal({ open, onClose, onSaved, editing, companyId, units, companyDefaults }: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing: Lease | null;
  companyId: string;
  units: Unit[];
  companyDefaults: { name: string; phone: string; tax_number: string };
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [form, setForm] = useState<LeaseForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  useEffect(() => {
    if (open) {
      if (editing) {
        setForm({
          unit_id: editing.unit_id,
          contract_number: editing.contract_number ?? '',
          tenant_name: editing.tenant_name,
          tenant_phone: editing.tenant_phone ?? '',
          tenant_email: editing.tenant_email ?? '',
          tenant_id_number: editing.tenant_id_number ?? '',
          lessor_name: editing.lessor_name ?? companyDefaults.name,
          lessor_phone: editing.lessor_phone ?? companyDefaults.phone,
          lessor_id_number: editing.lessor_id_number ?? companyDefaults.tax_number,
          start_date: editing.start_date,
          end_date: editing.end_date,
          rent_amount: String(editing.rent_amount),
          payment_frequency: editing.payment_frequency,
          maintenance_responsibility: editing.maintenance_responsibility,
          security_deposit: String(editing.security_deposit),
          status: editing.status,
          notes: editing.notes ?? '',
        });
      } else {
        setForm({
          ...emptyForm,
          lessor_name: companyDefaults.name,
          lessor_phone: companyDefaults.phone,
          lessor_id_number: companyDefaults.tax_number,
        });
      }
      setShowSchedule(false);
    }
  }, [open, editing, companyDefaults]);

  const update = useCallback(<K extends keyof LeaseForm>(key: K, val: LeaseForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const schedule = useMemo(() => form.rent_amount ? generatePaymentSchedule({
    startDate: form.start_date, endDate: form.end_date,
    rentAmount: parseFloat(form.rent_amount) || 0, frequency: form.payment_frequency,
  }) : [], [form.start_date, form.end_date, form.rent_amount, form.payment_frequency]);

  const save = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tenant_name.trim() || !form.unit_id) return;
    setSaving(true);
    const payload = {
      unit_id: form.unit_id,
      contract_number: form.contract_number.trim() || null,
      tenant_name: form.tenant_name.trim(),
      tenant_phone: form.tenant_phone.trim() || null,
      tenant_email: form.tenant_email.trim() || null,
      tenant_id_number: form.tenant_id_number.trim() || null,
      lessor_name: form.lessor_name.trim() || null,
      lessor_phone: form.lessor_phone.trim() || null,
      lessor_id_number: form.lessor_id_number.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      rent_amount: parseFloat(form.rent_amount) || 0,
      payment_frequency: form.payment_frequency,
      maintenance_responsibility: form.maintenance_responsibility,
      security_deposit: parseFloat(form.security_deposit) || 0,
      status: form.status,
      notes: form.notes.trim() || null,
    };

    let leaseId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('leases').update(payload).eq('id', editing.id);
      if (error) { toast(error.message, 'error'); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('leases').insert({ ...payload, tenant_id: companyId }).select('id').single();
      if (error || !data) { toast(error?.message ?? 'Error', 'error'); setSaving(false); return; }
      leaseId = data.id;
      await supabase.from('units').update({ status: 'rented' }).eq('id', form.unit_id);
    }

    if (leaseId && schedule.length > 0) {
      await supabase.from('lease_installments').delete().eq('lease_id', leaseId);
      await supabase.from('lease_installments').insert(
        schedule.map((s: { date: string; amount: number }, i: number) => ({
          lease_id: leaseId,
          installment_number: i + 1,
          due_date: s.date,
          amount: s.amount,
          status: 'pending',
        }))
      );
    }

    toast(t('rental.contractSaved'));
    onSaved();
    setSaving(false);
  }, [form, editing, companyId, schedule, toast, onSaved, t]);

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('rental.editContract') : t('rental.newLeaseContract')} size="lg">
      <form onSubmit={save} className="space-y-5">
        <Select label={`${t('rental.unitLabel')} *`} value={form.unit_id} onChange={e => update('unit_id', e.target.value)} required>
          <option value="">{t('rental.selectUnit')}</option>
          {units.filter((u) => u.status === 'vacant' || (editing && u.id === editing.unit_id)).map((u) => (
            <option key={u.id} value={u.id}>Unit {u.unit_number} — {u.rent_amount.toFixed(2)}/mo</option>
          ))}
        </Select>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label={t('rental.contractNumberEjar')}
            value={form.contract_number}
            onChange={e => update('contract_number', e.target.value)}
            placeholder="e.g. EJ-2026-0001"
          />
          <Select label={t('rental.contractStatus')} value={form.status} onChange={e => update('status', e.target.value as LeaseStatus)}>
            <option value="draft">{t('leaseStatus.draft')}</option>
            <option value="active">{t('leaseStatus.active')}</option>
            <option value="expired">{t('leaseStatus.expired')}</option>
            <option value="terminated">{t('leaseStatus.terminated')}</option>
          </Select>
        </div>

        <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-secondary-700 dark:text-secondary-200">
            <Home size={15} className="text-primary-500" />
            {t('rental.lessorSection')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label={t('rental.lessorName')} value={form.lessor_name} onChange={e => update('lessor_name', e.target.value)} />
            <Input label={t('rental.lessorPhone')} value={form.lessor_phone} onChange={e => update('lessor_phone', e.target.value)} icon={<Phone size={16} />} />
            <Input label={t('rental.lessorId')} value={form.lessor_id_number} onChange={e => update('lessor_id_number', e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-secondary-700 dark:text-secondary-200">
            <UserCheck size={15} className="text-primary-500" />
            {t('rental.tenantSection')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label={`${t('rental.tenantName')} *`} value={form.tenant_name} onChange={e => update('tenant_name', e.target.value)} required icon={<User size={16} />} />
            <Input label={t('rental.tenantId')} value={form.tenant_id_number} onChange={e => update('tenant_id_number', e.target.value)} />
            <Input label={t('rental.tenantPhone')} value={form.tenant_phone} onChange={e => update('tenant_phone', e.target.value)} icon={<Phone size={16} />} />
            <Input label={t('rental.tenantEmail')} value={form.tenant_email} onChange={e => update('tenant_email', e.target.value)} />
          </div>
        </div>

        <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-secondary-700 dark:text-secondary-200">
            <Calendar size={15} className="text-primary-500" />
            {t('rental.contractTerms')}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label={t('rental.startDate')} type="date" value={form.start_date} onChange={e => update('start_date', e.target.value)} />
            <Input label={t('rental.endDate')} type="date" value={form.end_date} onChange={e => update('end_date', e.target.value)} />
            <Input label={t('rental.rentAmount')} type="number" step="0.01" value={form.rent_amount} onChange={e => update('rent_amount', e.target.value)} />
            <Input label={t('rental.securityDeposit')} type="number" step="0.01" value={form.security_deposit} onChange={e => update('security_deposit', e.target.value)} />
            <Select label={t('rental.paymentFrequency')} value={form.payment_frequency} onChange={e => update('payment_frequency', e.target.value as PaymentFrequency)}>
              <option value="monthly">{t('paymentFreq.monthly')}</option>
              <option value="quarterly">{t('paymentFreq.quarterly')}</option>
              <option value="yearly">{t('paymentFreq.yearly')}</option>
            </Select>
            <Select label={t('rental.maintenanceResp')} value={form.maintenance_responsibility} onChange={e => update('maintenance_responsibility', e.target.value as MaintenanceResponsibility)}>
              <option value="landlord">{t('maintenance.landlord')}</option>
              <option value="tenant">{t('maintenance.tenant')}</option>
              <option value="shared">{t('maintenance.shared')}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.notes')}</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-secondary-200 dark:border-secondary-700 bg-white dark:bg-secondary-900 px-3 py-2 text-sm text-secondary-800 dark:text-secondary-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition-all"
            />
          </div>
        </div>

        {showSchedule && schedule.length > 0 && (
          <div className="rounded-xl border border-secondary-200 dark:border-secondary-800 overflow-hidden">
            <div className="px-4 py-2.5 bg-secondary-50 dark:bg-secondary-800/50 border-b border-secondary-200 dark:border-secondary-800 flex items-center gap-2">
              <Calendar size={14} className="text-secondary-400" />
              <span className="text-xs font-semibold text-secondary-600 dark:text-secondary-300">
                {t('rental.paymentSchedule')} ({schedule.length} {t('rental.payments')})
              </span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              <Table>
                <TableHead><TableRow><Th>#</Th><Th>{t('rental.dueDate')}</Th><Th className="text-end">{t('rental.amount')}</Th></TableRow></TableHead>
                <TableBody>
                  {schedule.map((s: { date: string; amount: number }, i: number) => (
                    <TableRow key={`${s.date}-${i}`}><Td className="text-xs">{i + 1}</Td><Td className="text-xs">{s.date}</Td><Td className="text-end text-xs font-medium">{s.amount.toFixed(2)}</Td></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setShowSchedule(!showSchedule)}>
            <Calendar size={14} /> {showSchedule ? t('rental.hideSchedule') : t('rental.previewSchedule')}
          </Button>
          <div className="flex gap-3">
            <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{t('rental.saveContract')}</Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function ContractAgreementModal({ open, onClose, lease, company, lang }: {
  open: boolean;
  onClose: () => void;
  lease: Lease | null;
  company: { name: string; address: string | null; phone: string | null; tax_number: string | null } | null;
  lang: 'en' | 'ar';
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const handleDownload = useCallback(async () => {
    const el = document.getElementById('contract-print-area');
    if (!el || !lease) return;
    setDownloadingPdf(true);
    try {
      const fileName = `lease-contract-${lease.contract_number || lease.id}.pdf`;
      await exportElementToPdf(el, {
        filename: fileName,
        marginMm: [10, 10, 10, 10],
      });
      toast(lang === 'ar' ? 'تم تحميل عقد الإيجار بصيغة PDF بنجاح' : 'Lease contract PDF downloaded successfully', 'success');
    } catch (err: any) {
      console.error('PDF export error:', err);
      toast(lang === 'ar' ? 'حدث خطأ أثناء إنشاء PDF، جاري التحويل للطباعة المباشرة' : 'Error generating PDF, switching to print dialog', 'error');
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  }, [lease, lang, toast]);

  if (!lease) return null;

  return (
    <Modal open={open} onClose={onClose} title={t('rental.contractAgreement')} size="lg">
      <div className="flex justify-end gap-2 pb-3 no-print print:hidden">
        <Button variant="outline" size="sm" onClick={handleDownload} loading={downloadingPdf}>
          <Download size={14} /> {lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
        </Button>
        <Button variant="outline" size="sm" onClick={handlePrint}><Printer size={14} /> {t('rental.print')}</Button>
      </div>

      <div id="contract-print-area">
        <LeaseContractDocument lease={lease} company={company} />
      </div>
    </Modal>
  );
}

export function LeasesPage() {
  const { company } = useCompany();
  const { lang, t } = useLanguage();
  const { toast } = useToast();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [installments, setInstallments] = useState<Record<string, LeaseInstallment[]>>({});
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lease | null>(null);
  const [contractModal, setContractModal] = useState<Lease | null>(null);
  const [pdfLeases, setPdfLeases] = useState<Lease[]>([]);
  const { startExport, exporting: pdfExporting } = usePdfExport();

  const closeModal = useCallback(() => setModalOpen(false), []);
  const closeContract = useCallback(() => setContractModal(null), []);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const [leaseRes, unitRes] = await Promise.all([
      supabase.from('leases').select('*, unit:units(id, unit_number)').eq('tenant_id', company.id).order('created_at', { ascending: false }),
      supabase.from('units').select('*').eq('tenant_id', company.id),
    ]);
    const leaseData = leaseRes.data as Lease[] ?? [];
    setLeases(leaseData);
    setUnits(unitRes.data as Unit[] ?? []);

    if (leaseData.length > 0) {
      const { data: instData } = await supabase.from('lease_installments')
        .select('*').in('lease_id', leaseData.map(l => l.id)).order('installment_number', { ascending: true });
      const map: Record<string, LeaseInstallment[]> = {};
      (instData as LeaseInstallment[] ?? []).forEach((inst) => {
        if (!map[inst.lease_id]) map[inst.lease_id] = [];
        map[inst.lease_id].push(inst);
      });
      setInstallments(map);
    }
    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const deleteLease = useCallback(async (l: Lease) => {
    const { error } = await supabase.from('leases').delete().eq('id', l.id);
    if (error) toast(error.message, 'error');
    else {
      await supabase.from('units').update({ status: 'vacant' }).eq('id', l.unit_id);
      toast(t('rental.contractDeleted'));
      load();
    }
  }, [toast, load, t]);

  const openAdd = useCallback(() => { setEditing(null); setModalOpen(true); }, []);
  const openEdit = useCallback((l: Lease) => { setEditing(l); setModalOpen(true); }, []);

  const companyDefaults = useMemo(() => ({
    name: company?.name ?? '',
    phone: company?.phone ?? '',
    tax_number: company?.tax_number ?? '',
  }), [company]);

  const contractCompany = useMemo(() => (company ? {
    name: company.name,
    address: company.address,
    phone: company.phone,
    tax_number: company.tax_number,
  } : null), [company]);

  const exportLeases = useCallback((list: Lease[]) => {
    if (list.length === 0 || pdfExporting) return;
    setPdfLeases(list);
    startExport({
      hostId: 'leases-pdf-host',
      filename: list.length === 1
        ? `lease-contract-${list[0].contract_number || list[0].id}.pdf`
        : `lease-contracts-${list.length}.pdf`,
      marginMm: [10, 10, 10, 10],
      onError: () => toast(lang === 'ar' ? 'حدث خطأ أثناء إنشاء PDF' : 'Error generating PDF', 'error'),
    });
  }, [pdfExporting, startExport, toast, lang]);

  if (loading) return <div className="flex justify-center py-20"><Spinner size={28} /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">
            {t('rental.leaseContracts')}
          </h1>
          <p className="text-sm text-secondary-500 mt-1">
            {t('rental.leaseContractsDesc')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportLeases(leases)}
            loading={pdfExporting}
            disabled={leases.length === 0}
          >
            <Download size={16} /> {lang === 'ar' ? 'تحميل الكل PDF' : 'Download all PDF'}
          </Button>
          <Button onClick={openAdd}><Plus size={16} /> {t('rental.newContract')}</Button>
        </div>
      </div>

      {leases.length === 0 ? (
        <Card><CardBody><EmptyState icon={<FileText size={28} />} title={t('rental.noContracts')} description={t('rental.noContractsDesc')} action={<Button onClick={openAdd}><Plus size={16} /> {t('rental.newContract')}</Button>} /></CardBody></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>{t('rental.contractsCount')} ({leases.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <Table>
              <TableHead>
                <TableRow>
                  <Th>{t('rental.tenant')}</Th>
                  <Th>{t('rental.unit')}</Th>
                  <Th>{t('rental.contractNo')}</Th>
                  <Th>{t('rental.period')}</Th>
                  <Th>{t('rental.rent')}</Th>
                  <Th>{t('invoices.status')}</Th>
                  <Th>{t('rental.installments')}</Th>
                  <Th className="text-end">{t('rental.actions')}</Th>
                </TableRow>
              </TableHead>
              <TableBody>
                {leases.map((l) => {
                  const insts = installments[l.id] ?? [];
                  const paidCount = insts.filter(i => i.status === 'paid').length;
                  const variant = STATUS_VARIANT[l.status];
                  return (
                    <TableRow key={l.id}>
                      <Td>
                        <div className="font-medium text-secondary-800 dark:text-secondary-100">{l.tenant_name}</div>
                        {l.tenant_phone && <div className="text-xs text-secondary-400">{l.tenant_phone}</div>}
                      </Td>
                      <Td>{l.unit?.unit_number ?? '—'}</Td>
                      <Td className="text-xs font-medium">{l.contract_number ?? '—'}</Td>
                      <Td className="text-xs text-secondary-500">{l.start_date} → {l.end_date}</Td>
                      <Td className="font-medium">{l.rent_amount.toFixed(2)}</Td>
                      <Td>
                        <span className={`badge ${
                          variant === 'success' ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300' :
                          variant === 'warning' ? 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300' :
                          variant === 'danger' ? 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300' :
                          'bg-secondary-100 text-secondary-600 dark:bg-secondary-800 dark:text-secondary-300'
                        }`}>
                          <span className={`badge-dot ${
                            variant === 'success' ? 'bg-success-500' :
                            variant === 'warning' ? 'bg-warning-500' :
                            variant === 'danger' ? 'bg-danger-500' : 'bg-secondary-400'
                          }`} />
                          {t(`leaseStatus.${l.status}`)}
                        </span>
                      </Td>
                      <Td className="text-xs">
                        {insts.length > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-success-500" />
                            {paidCount}/{insts.length}
                          </span>
                        ) : '—'}
                      </Td>
                      <Td className="text-end">
                        <button
                          onClick={() => exportLeases([l])}
                          title={lang === 'ar' ? 'تحميل PDF' : 'Download PDF'}
                          className="p-2 rounded-lg text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800"
                        >
                          <Download size={15} />
                        </button>
                        <button onClick={() => setContractModal(l)} title={t('rental.contractAgreement')} className="p-2 rounded-lg text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                          <FileText size={15} />
                        </button>
                        <button onClick={() => openEdit(l)} title={t('common.edit')} className="p-2 rounded-lg text-secondary-400 hover:bg-secondary-100 dark:hover:bg-secondary-800">
                          <Pencil size={15} />
                        </button>
                        <button onClick={() => deleteLease(l)} title={t('common.delete')} className="p-2 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20">
                          <Trash2 size={15} />
                        </button>
                      </Td>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <LeaseFormModal
        open={modalOpen}
        onClose={closeModal}
        onSaved={() => { setModalOpen(false); load(); }}
        editing={editing}
        companyId={company?.id ?? ''}
        units={units}
        companyDefaults={companyDefaults}
      />

      <ContractAgreementModal
        open={!!contractModal}
        onClose={closeContract}
        lease={contractModal}
        company={contractCompany}
        lang={lang}
      />

      {/* Off-screen render area used for PDF downloads */}
      {pdfLeases.length > 0 && (
        <div aria-hidden="true" style={PDF_HOST_STYLE}>
          <div id="leases-pdf-host" className="bg-white" style={{ width: 794 }}>
            {pdfLeases.map((l, i) => (
              <div key={l.id} style={pdfPageBreak(i)}>
                <LeaseContractDocument lease={l} company={contractCompany} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
