import { useCallback, useEffect, useState } from 'react';
import { Plus, FileText, Trash2, Printer, Share2, Download, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../contexts/CompanyContext';
import { useToast } from '../contexts/ToastContext';
import type { REInvoice, Lease } from '../lib/types';
import { generateZatcaQr, calcVat, calcTotal } from '../lib/re-zatca';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Modal } from '../components/ui/Modal';
import { Card, CardBody, CardHeader, CardTitle } from '../components/ui/Card';
import { Table, TableHead, TableBody, TableRow, Th, Td } from '../components/ui/Table';
import { EmptyState } from '../components/ui/Feedback';
import { InvoicePrintArea, type TemplateId } from '../components/InvoicePrintTemplates';
import { exportElementToPdf, pdfPageBreak, PDF_HOST_STYLE, usePdfExport } from '../lib/pdf-export';

interface InvoiceForm { lease_id: string; amount: string; issue_date: string; due_date: string; }
const emptyForm: InvoiceForm = { lease_id: '', amount: '', issue_date: new Date().toISOString().slice(0, 10), due_date: new Date().toISOString().slice(0, 10) };

function InvoiceFormModal({ open, onClose, onSaved, companyId, leases }: {
  open: boolean; onClose: () => void; onSaved: () => void; companyId: string; leases: Lease[];
}) {
  const [form, setForm] = useState<InvoiceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { if (open) setForm(emptyForm); }, [open]);

  const update = useCallback(<K extends keyof InvoiceForm>(key: K, val: InvoiceForm[K]) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const save = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.lease_id || !form.amount) return;
    setSaving(true);
    const subtotal = parseFloat(form.amount) || 0;
    const vat = calcVat(subtotal);
    const total = calcTotal(subtotal);
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const { data: companyData } = await supabase.from('companies').select('name, tax_number').eq('id', companyId).maybeSingle();
    const qrData = generateZatcaQr({
      sellerName: companyData?.name ?? 'Unknown',
      vatNumber: companyData?.tax_number ?? '000000000000003',
      issueDate: form.issue_date,
      invoiceTotal: total,
      vatTotal: vat,
    });
    const { error } = await supabase.from('re_invoices').insert({
      tenant_id: companyId, lease_id: form.lease_id, invoice_number: invoiceNumber,
      issue_date: form.issue_date, due_date: form.due_date,
      subtotal, vat_amount: vat, total_amount: total,
      status: 'unpaid', qr_code_data: qrData,
    });
    if (error) toast(error.message, 'error');
    else { toast('Invoice created'); onSaved(); }
    setSaving(false);
  }, [form, companyId, toast, onSaved]);

  return (
    <Modal open={open} onClose={onClose} title="Generate Invoice" size="md">
      <form onSubmit={save} className="space-y-4">
        <Select label="Lease *" value={form.lease_id} onChange={e => update('lease_id', e.target.value)} required>
          <option value="">Select a lease...</option>
          {leases.map((l) => (
            <option key={l.id} value={l.id}>{l.tenant_name} — Unit {l.unit?.unit_number ?? '?'}</option>
          ))}
        </Select>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input label="Amount (excl. VAT)" type="number" step="0.01" value={form.amount} onChange={e => update('amount', e.target.value)} required />
          <Input label="Issue Date" type="date" value={form.issue_date} onChange={e => update('issue_date', e.target.value)} />
          <Input label="Due Date" type="date" value={form.due_date} onChange={e => update('due_date', e.target.value)} />
        </div>
        {form.amount && (
          <div className="rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800/40 p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-secondary-600 dark:text-secondary-300"><span>Subtotal</span><span>${(parseFloat(form.amount) || 0).toFixed(2)}</span></div>
            <div className="flex justify-between text-secondary-600 dark:text-secondary-300"><span>VAT (15%)</span><span>${calcVat(parseFloat(form.amount) || 0).toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-primary-700 dark:text-primary-300 pt-1.5 border-t border-primary-200 dark:border-primary-800/40"><span>Total</span><span>${calcTotal(parseFloat(form.amount) || 0).toFixed(2)}</span></div>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Generate</Button>
        </div>
      </form>
    </Modal>
  );
}

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: 'standard', label: 'Corporate A4' },
  { id: 'minimal', label: 'Minimal A4' },
  { id: 'thermal', label: 'Thermal 80mm' },
];

function InvoiceViewModal({ invoice, onClose, company }: {
  invoice: REInvoice | null; onClose: () => void;
  company: { name: string; address: string | null; phone: string | null; email: string | null; tax_number: string | null } | null;
}) {
  const [template, setTemplate] = useState<TemplateId>('standard');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const { toast } = useToast();

  if (!invoice) return null;

  const waText = encodeURIComponent(`Invoice ${invoice.invoice_number} from ${company?.name ?? ''}. Total: ${invoice.total_amount.toFixed(2)} SAR. Due: ${invoice.due_date}`);
  const waLink = invoice.lease?.tenant_phone ? `https://wa.me/${invoice.lease.tenant_phone.replace(/[^0-9]/g, '')}?text=${waText}` : `https://wa.me/?text=${waText}`;

  const companyInfo = company ?? { name: '', address: null, phone: null, email: null, tax_number: null };

  const handleDownloadPdf = async () => {
    const el = document.getElementById('re-invoice-print-area');
    if (!el) return;
    setDownloadingPdf(true);
    try {
      await exportElementToPdf(el, {
        filename: `${invoice.invoice_number}.pdf`,
        marginMm: [8, 8, 8, 8],
      });
      toast('Invoice PDF downloaded successfully', 'success');
    } catch (err) {
      console.error(err);
      toast('Error generating PDF, switching to print dialog', 'error');
      window.print();
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <Modal open={!!invoice} onClose={onClose} title={`Invoice ${invoice.invoice_number}`} size="lg"
      footer={
        <>
          <Select value={template} onChange={e => setTemplate(e.target.value as TemplateId)} className="w-auto text-xs py-1.5 me-auto">
            {TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => window.print()}><Printer size={16} /> Print</Button>
          <Button variant="primary" onClick={handleDownloadPdf} loading={downloadingPdf}>
            <Download size={16} /> Download PDF
          </Button>
          <a href={waLink} target="_blank" rel="noopener noreferrer">
            <Button variant="success"><Share2 size={16} /> WhatsApp</Button>
          </a>
        </>
      }>
      <div id="re-invoice-print-area" className="bg-white p-6 rounded-xl border border-secondary-200">
        <InvoicePrintArea invoice={invoice} company={companyInfo} template={template} />
      </div>
    </Modal>
  );
}

export function REInvoicesPage() {
  const { company } = useCompany();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<REInvoice[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [viewing, setViewing] = useState<REInvoice | null>(null);
  const [pdfInvoices, setPdfInvoices] = useState<REInvoice[]>([]);
  const { startExport, exporting: pdfExporting } = usePdfExport();

  const companyInfo = company ? {
    name: company.name,
    address: company.address,
    phone: company.phone,
    email: company.email,
    tax_number: company.tax_number,
  } : null;

  const exportReInvoices = useCallback((list: REInvoice[]) => {
    if (list.length === 0 || pdfExporting) return;
    setPdfInvoices(list);
    startExport({
      hostId: 're-invoices-pdf-host',
      filename: list.length === 1
        ? `${list[0].invoice_number}.pdf`
        : `rent-invoices-${list.length}.pdf`,
      onError: () => toast('Error generating PDF', 'error'),
    });
  }, [pdfExporting, startExport, toast]);

  const load = useCallback(async () => {
    if (!company) return;
    setLoading(true);
    const [invRes, leaseRes] = await Promise.all([
      supabase.from('re_invoices').select('*, lease:leases(id, tenant_name, tenant_phone)').eq('tenant_id', company.id).order('created_at', { ascending: false }),
      supabase.from('leases').select('*, unit:units(id, unit_number)').eq('tenant_id', company.id),
    ]);
    setInvoices(invRes.data as REInvoice[] ?? []);
    setLeases(leaseRes.data as Lease[] ?? []);
    setLoading(false);
  }, [company]);

  useEffect(() => { load(); }, [load]);

  const markPaid = useCallback(async (inv: REInvoice) => {
    const { error } = await supabase.from('re_invoices').update({ status: 'paid' }).eq('id', inv.id);
    if (error) toast(error.message, 'error'); else { toast('Invoice marked as paid'); load(); }
  }, [toast, load]);

  const deleteInvoice = useCallback(async (inv: REInvoice) => {
    const { error } = await supabase.from('re_invoices').delete().eq('id', inv.id);
    if (error) toast(error.message, 'error'); else { toast('Invoice deleted'); load(); }
  }, [toast, load]);

  if (loading) return <div className="flex justify-center py-20"><div className="spinner" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary-800 dark:text-secondary-100">Invoices</h1>
          <p className="text-sm text-secondary-500 mt-1">ZATCA-compliant rent invoices with QR codes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => exportReInvoices(invoices)}
            loading={pdfExporting}
            disabled={invoices.length === 0}
          >
            <Download size={16} /> Download all PDF
          </Button>
          <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Generate Invoice</Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <Card><CardBody><EmptyState icon={<FileText size={28} />} title="No invoices yet" description="Generate your first rent invoice." action={<Button onClick={() => setModalOpen(true)}><Plus size={16} /> Generate Invoice</Button>} /></CardBody></Card>
      ) : (
        <Card>
          <CardHeader><CardTitle>Invoices ({invoices.length})</CardTitle></CardHeader>
          <CardBody className="p-0">
            <Table>
              <TableHead>
                <TableRow><Th>Invoice #</Th><Th>Tenant</Th><Th>Issue Date</Th><Th>Due Date</Th><Th>Total</Th><Th>Status</Th><Th className="text-end">Actions</Th></TableRow>
              </TableHead>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id} onClick={() => setViewing(inv)}>
                    <Td className="font-medium">{inv.invoice_number}</Td>
                    <Td>{inv.lease?.tenant_name ?? '—'}</Td>
                    <Td className="text-xs text-secondary-500">{inv.issue_date}</Td>
                    <Td className="text-xs text-secondary-500">{inv.due_date}</Td>
                    <Td className="font-medium">${inv.total_amount.toFixed(2)}</Td>
                    <Td><span className={`badge ${inv.status === 'paid' ? 'bg-success-50 text-success-700 dark:bg-success-900/30 dark:text-success-300' : inv.status === 'overdue' ? 'bg-danger-50 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300' : 'bg-warning-50 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300'}`}><span className={`badge-dot ${inv.status === 'paid' ? 'bg-success-500' : inv.status === 'overdue' ? 'bg-danger-500' : 'bg-warning-500'}`} />{inv.status}</span></Td>
                    <Td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => exportReInvoices([inv])} className="p-2 rounded-lg text-secondary-500 hover:bg-secondary-100 dark:hover:bg-secondary-800" title="Download PDF"><Download size={15} /></button>
                      {inv.status !== 'paid' && <button onClick={() => markPaid(inv)} className="p-2 rounded-lg text-success-600 hover:bg-success-50 dark:hover:bg-success-900/20" title="Mark paid"><FileText size={15} /></button>}
                      <button onClick={() => deleteInvoice(inv)} className="p-2 rounded-lg text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20"><Trash2 size={15} /></button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <InvoiceFormModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} companyId={company?.id ?? ''} leases={leases} />
      <InvoiceViewModal invoice={viewing} onClose={() => setViewing(null)} company={companyInfo} />

      {/* Off-screen render area used for PDF downloads */}
      {pdfInvoices.length > 0 && companyInfo && (
        <div aria-hidden="true" style={PDF_HOST_STYLE}>
          <div id="re-invoices-pdf-host" className="bg-white" style={{ width: 794 }}>
            {pdfInvoices.map((inv, i) => (
              <div key={inv.id} style={pdfPageBreak(i)}>
                <InvoicePrintArea invoice={inv} company={companyInfo} template="standard" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
