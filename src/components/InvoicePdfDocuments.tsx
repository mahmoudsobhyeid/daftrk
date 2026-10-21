import {
  Document, Page, Text, View, StyleSheet, Font, Image,
} from '@react-pdf/renderer';
import { generateQrDataUrl } from './zatca/QrCode';
import type { REInvoice } from '../lib/types';

Font.register({
  family: 'Cairo',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/cairo@latest/arabic-700-normal.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Tajawal',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/tajawal@latest/arabic-700-normal.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Noto Sans Arabic',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-arabic@latest/arabic-700-normal.ttf', fontWeight: 700 },
  ],
});

Font.register({
  family: 'Amiri',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/arabic-400-normal.ttf', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/fontsource/fonts/amiri@latest/arabic-700-normal.ttf', fontWeight: 700 },
  ],
});

// ─── Shared Types ──────────────────────────────────────
export type TemplateId = 'standard' | 'minimal' | 'thermal';

export interface PdfInvoiceData {
  invoice: REInvoice;
  company: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    tax_number: string | null;
  };
  qrDataUrl: string;
}

const fmt = (n: number) => n.toFixed(2);

// ─── Template 1: Standard Corporate (A4) ───────────────
const standardStyles = StyleSheet.create({
  page: { fontFamily: 'Tajawal', fontSize: 11, color: '#1e293b', padding: '15mm 15mm', backgroundColor: '#ffffff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, paddingBottom: 16, borderBottom: '2px solid #2563eb' },
  title: { fontSize: 28, fontWeight: 800, color: '#2563eb' },
  subtitle: { fontSize: 10, color: '#64748b', marginTop: 4 },
  companyName: { fontSize: 18, fontWeight: 700, color: '#1e293b', textAlign: 'right' },
  companyDetail: { fontSize: 10, color: '#64748b', textAlign: 'right' },
  billToLabel: { fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' },
  billToName: { fontSize: 13, fontWeight: 600, color: '#1e293b', marginTop: 4 },
  billToPhone: { fontSize: 10, color: '#64748b' },
  metaLabel: { fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' },
  metaValue: { fontSize: 11, fontWeight: 500, marginTop: 2 },
  metaStatus: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  metaCol: { marginBottom: 8 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#2563eb', padding: '8px 12px' },
  tableHeaderCell: { color: '#ffffff', fontSize: 11, fontWeight: 600 },
  tableRow: { flexDirection: 'row', padding: '10px 12px', borderBottom: '1px solid #e2e8f0' },
  tableRowAlt: { flexDirection: 'row', padding: '10px 12px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' },
  tableCell: { fontSize: 11 },
  tableCellEnd: { fontSize: 11, textAlign: 'right' },
  totalRow: { flexDirection: 'row', padding: '12px 12px', backgroundColor: '#eff6ff', borderTop: '2px solid #2563eb' },
  totalCell: { fontSize: 13, fontWeight: 700 },
  totalCellEnd: { fontSize: 13, fontWeight: 700, textAlign: 'right' },
  qrSection: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, alignItems: 'center' },
  qrLabel: { fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6 },
  qrCol: { alignItems: 'center' },
  footer: { position: 'absolute', bottom: 20, left: 15, right: 15, textAlign: 'center', fontSize: 9, color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: 10 },
});

function StandardCorporatePdf({ invoice, company, qrDataUrl }: PdfInvoiceData) {
  const tenant = invoice.lease?.tenant_name ?? '—';
  const tenantPhone = invoice.lease?.tenant_phone ?? '—';
  const statusColor = invoice.status === 'paid' ? '#16a34a' : invoice.status === 'overdue' ? '#dc2626' : '#d97706';

  return (
    <Document>
      <Page size="A4" style={standardStyles.page}>
        <View style={standardStyles.headerRow}>
          <View>
            <Text style={standardStyles.title}>INVOICE</Text>
            <Text style={standardStyles.subtitle}>{invoice.invoice_number}</Text>
          </View>
          <View>
            <Text style={standardStyles.companyName}>{company.name}</Text>
            {company.address ? <Text style={standardStyles.companyDetail}>{company.address}</Text> : null}
            {company.phone ? <Text style={standardStyles.companyDetail}>{company.phone}</Text> : null}
            {company.tax_number ? <Text style={standardStyles.companyDetail}>VAT: {company.tax_number}</Text> : null}
          </View>
        </View>

        <View style={standardStyles.infoRow}>
          <View>
            <Text style={standardStyles.billToLabel}>Bill To</Text>
            <Text style={standardStyles.billToName}>{tenant}</Text>
            <Text style={standardStyles.billToPhone}>{tenantPhone}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <View style={standardStyles.metaCol}>
              <Text style={standardStyles.metaLabel}>Issue Date</Text>
              <Text style={standardStyles.metaValue}>{invoice.issue_date}</Text>
            </View>
            <View style={standardStyles.metaCol}>
              <Text style={standardStyles.metaLabel}>Due Date</Text>
              <Text style={standardStyles.metaValue}>{invoice.due_date}</Text>
            </View>
            <View style={standardStyles.metaCol}>
              <Text style={standardStyles.metaLabel}>Status</Text>
              <Text style={[standardStyles.metaStatus, { color: statusColor }]}>{invoice.status}</Text>
            </View>
          </View>
        </View>

        <View>
          <View style={standardStyles.tableHeader}>
            <Text style={[standardStyles.tableHeaderCell, { flex: 1 }]}>Description</Text>
            <Text style={[standardStyles.tableHeaderCell, { width: 120, textAlign: 'right' }]}>Amount (SAR)</Text>
          </View>
          <View style={standardStyles.tableRow}>
            <Text style={[standardStyles.tableCell, { flex: 1 }]}>Rent Payment — {tenant}</Text>
            <Text style={[standardStyles.tableCellEnd, { width: 120 }]}>{fmt(invoice.subtotal)}</Text>
          </View>
          <View style={standardStyles.tableRowAlt}>
            <Text style={[standardStyles.tableCell, { flex: 1 }]}>VAT (15%)</Text>
            <Text style={[standardStyles.tableCellEnd, { width: 120 }]}>{fmt(invoice.vat_amount)}</Text>
          </View>
          <View style={standardStyles.totalRow}>
            <Text style={[standardStyles.totalCell, { flex: 1 }]}>Total</Text>
            <Text style={[standardStyles.totalCellEnd, { width: 120 }]}>{fmt(invoice.total_amount)} SAR</Text>
          </View>
        </View>

        <View style={standardStyles.qrSection}>
          <View style={standardStyles.qrCol}>
            <Text style={standardStyles.qrLabel}>ZATCA QR Code</Text>
            {qrDataUrl ? <Image src={qrDataUrl} style={{ width: 140, height: 140 }} /> : null}
          </View>
        </View>

        <Text style={standardStyles.footer}>This is a ZATCA-compliant electronic invoice. Thank you for your business.</Text>
      </Page>
    </Document>
  );
}

// ─── Template 2: Lease Minimal (A4) ────────────────────
const minimalStyles = StyleSheet.create({
  page: { fontFamily: 'Tajawal', fontSize: 11, color: '#1e293b', padding: '20mm 20mm', backgroundColor: '#ffffff' },
  header: { textAlign: 'center', marginBottom: 36 },
  title: { fontSize: 22, fontWeight: 700, color: '#1e293b' },
  subtitle: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  infoCol: { fontSize: 10, color: '#64748b' },
  infoLabel: { fontSize: 10, color: '#94a3b8' },
  infoValue: { fontSize: 11, fontWeight: 600, color: '#1e293b' },
  tableHeaderRow: { flexDirection: 'row', borderBottom: '2px solid #333', paddingBottom: 8 },
  tableHeaderCell: { fontSize: 11, fontWeight: 600 },
  tableRow: { flexDirection: 'row', padding: '10px 0', borderBottom: '1px solid #eee' },
  tableCell: { fontSize: 12 },
  tableCellEnd: { fontSize: 12, textAlign: 'right' },
  totalRow: { flexDirection: 'row', padding: '12px 0', borderBottom: '2px solid #333' },
  totalCell: { fontSize: 14, fontWeight: 700 },
  totalCellEnd: { fontSize: 14, fontWeight: 700, textAlign: 'right' },
  signRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 60, alignItems: 'flex-end' },
  signCol: { alignItems: 'center' },
  signLine: { width: 200, borderBottom: '1px solid #cbd5e1', height: 50 },
  signLabel: { fontSize: 10, color: '#94a3b8', marginTop: 4 },
  qrWrap: { alignItems: 'center' },
  qrLabel: { fontSize: 9, fontWeight: 600, color: '#94a3b8', marginBottom: 4 },
});

function LeaseMinimalPdf({ invoice, company, qrDataUrl }: PdfInvoiceData) {
  const tenant = invoice.lease?.tenant_name ?? '—';
  return (
    <Document>
      <Page size="A4" style={minimalStyles.page}>
        <View style={minimalStyles.header}>
          <Text style={minimalStyles.title}>RENT INVOICE</Text>
          <Text style={minimalStyles.subtitle}>{company.name} · {invoice.invoice_number}</Text>
        </View>

        <View style={minimalStyles.infoRow}>
          <View>
            <Text style={minimalStyles.infoValue}>{company.name}</Text>
            {company.address ? <Text style={minimalStyles.infoCol}>{company.address}</Text> : null}
            {company.tax_number ? <Text style={minimalStyles.infoCol}>VAT: {company.tax_number}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={minimalStyles.infoLabel}>Tenant: <Text style={minimalStyles.infoValue}>{tenant}</Text></Text>
            <Text style={minimalStyles.infoLabel}>Issued: {invoice.issue_date}</Text>
            <Text style={minimalStyles.infoLabel}>Due: {invoice.due_date}</Text>
          </View>
        </View>

        <View>
          <View style={minimalStyles.tableHeaderRow}>
            <Text style={[minimalStyles.tableHeaderCell, { flex: 1 }]}>Description</Text>
            <Text style={[minimalStyles.tableHeaderCell, { width: 120, textAlign: 'right' }]}>Amount</Text>
          </View>
          <View style={minimalStyles.tableRow}>
            <Text style={[minimalStyles.tableCell, { flex: 1 }]}>Monthly Rent — {tenant}</Text>
            <Text style={[minimalStyles.tableCellEnd, { width: 120 }]}>{fmt(invoice.subtotal)} SAR</Text>
          </View>
          <View style={minimalStyles.tableRow}>
            <Text style={[minimalStyles.tableCell, { flex: 1 }]}>VAT (15%)</Text>
            <Text style={[minimalStyles.tableCellEnd, { width: 120 }]}>{fmt(invoice.vat_amount)} SAR</Text>
          </View>
          <View style={minimalStyles.totalRow}>
            <Text style={[minimalStyles.totalCell, { flex: 1 }]}>Total Due</Text>
            <Text style={[minimalStyles.totalCellEnd, { width: 120 }]}>{fmt(invoice.total_amount)} SAR</Text>
          </View>
        </View>

        <View style={minimalStyles.signRow}>
          <View style={minimalStyles.signCol}>
            <View style={minimalStyles.signLine} />
            <Text style={minimalStyles.signLabel}>Tenant Signature</Text>
          </View>
          <View style={minimalStyles.signCol}>
            <View style={minimalStyles.signLine} />
            <Text style={minimalStyles.signLabel}>Landlord Signature</Text>
          </View>
          <View style={minimalStyles.qrWrap}>
            <Text style={minimalStyles.qrLabel}>ZATCA QR</Text>
            {qrDataUrl ? <Image src={qrDataUrl} style={{ width: 110, height: 110 }} /> : null}
          </View>
        </View>
      </Page>
    </Document>
  );
}

// ─── Template 3: Thermal Receipt (80mm) ────────────────
const thermalStyles = StyleSheet.create({
  page: { fontFamily: 'Tajawal', fontSize: 9, color: '#000000', padding: '4mm 3mm', backgroundColor: '#ffffff', width: 226 }, // ~80mm at 72dpi
  header: { textAlign: 'center', marginBottom: 8 },
  companyName: { fontSize: 11, fontWeight: 700 },
  companyDetail: { fontSize: 8, color: '#444' },
  divider: { borderBottom: '1px dashed #999', marginVertical: 6 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', fontSize: 8, marginBottom: 2 },
  tableHeaderRow: { flexDirection: 'row', borderBottom: '1px dashed #999', paddingBottom: 4, marginBottom: 4 },
  tableHeaderCell: { fontSize: 8, fontWeight: 600 },
  tableRow: { flexDirection: 'row', fontSize: 8 },
  tableCell: { flex: 1 },
  tableCellEnd: { width: 70, textAlign: 'right' },
  totalRow: { flexDirection: 'row', borderTop: '1px dashed #999', marginTop: 4, paddingTop: 6 },
  totalCell: { fontSize: 11, fontWeight: 700 },
  totalCellEnd: { fontSize: 11, fontWeight: 700, textAlign: 'right' },
  qrSection: { alignItems: 'center', marginTop: 12 },
  qrLabel: { fontSize: 7, color: '#666', marginTop: 4 },
  thankYou: { fontSize: 7, textAlign: 'center', marginTop: 8, color: '#666' },
});

function ThermalReceiptPdf({ invoice, company, qrDataUrl }: PdfInvoiceData) {
  const tenant = invoice.lease?.tenant_name ?? '—';
  return (
    <Document>
      <Page size={{ width: 226, height: 'auto' }} style={thermalStyles.page}>
        <View style={thermalStyles.header}>
          <Text style={thermalStyles.companyName}>{company.name}</Text>
          {company.address ? <Text style={thermalStyles.companyDetail}>{company.address}</Text> : null}
          {company.tax_number ? <Text style={thermalStyles.companyDetail}>VAT: {company.tax_number}</Text> : null}
        </View>
        <View style={thermalStyles.divider} />
        <View>
          <View style={thermalStyles.metaRow}><Text>Invoice:</Text><Text>{invoice.invoice_number}</Text></View>
          <View style={thermalStyles.metaRow}><Text>Date:</Text><Text>{invoice.issue_date}</Text></View>
          <View style={thermalStyles.metaRow}><Text>Due:</Text><Text>{invoice.due_date}</Text></View>
          <View style={thermalStyles.metaRow}><Text>Tenant:</Text><Text>{tenant}</Text></View>
        </View>
        <View style={thermalStyles.divider} />
        <View style={thermalStyles.tableHeaderRow}>
          <Text style={thermalStyles.tableHeaderCell}>Item</Text>
          <Text style={[thermalStyles.tableHeaderCell, { width: 70, textAlign: 'right' }]}>SAR</Text>
        </View>
        <View style={thermalStyles.tableRow}>
          <Text style={thermalStyles.tableCell}>Rent — {tenant}</Text>
          <Text style={thermalStyles.tableCellEnd}>{fmt(invoice.subtotal)}</Text>
        </View>
        <View style={thermalStyles.tableRow}>
          <Text style={thermalStyles.tableCell}>VAT 15%</Text>
          <Text style={thermalStyles.tableCellEnd}>{fmt(invoice.vat_amount)}</Text>
        </View>
        <View style={thermalStyles.totalRow}>
          <Text style={thermalStyles.totalCell}>TOTAL</Text>
          <Text style={thermalStyles.totalCellEnd}>{fmt(invoice.total_amount)}</Text>
        </View>
        <View style={thermalStyles.qrSection}>
          {qrDataUrl ? <Image src={qrDataUrl} style={{ width: 100, height: 100 }} /> : null}
          <Text style={thermalStyles.qrLabel}>ZATCA Phase 1/2 Compliant</Text>
        </View>
        <Text style={thermalStyles.thankYou}>Thank you!</Text>
      </Page>
    </Document>
  );
}

// ─── Export: Template Selector ─────────────────────────
export function getInvoicePdfDocument(template: TemplateId, data: PdfInvoiceData) {
  if (template === 'thermal') return <ThermalReceiptPdf {...data} />;
  if (template === 'minimal') return <LeaseMinimalPdf {...data} />;
  return <StandardCorporatePdf {...data} />;
}

export { StandardCorporatePdf, LeaseMinimalPdf, ThermalReceiptPdf };
