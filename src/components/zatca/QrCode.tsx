/**
 * ZATCA QR Code renderer component.
 * Renders as an <img> tag with a data URL so it displays in both screen and print/PDF.
 *
 * If a pre-encoded TLV Base64 `data` string is provided (from invoice-service), it is used directly.
 * If `data` is empty but `invoice` details are supplied, the TLV payload is generated client-side
 * with placeholder fallbacks for any missing tax fields, so the QR always renders for testing.
 */
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { encodeTlvQr } from '../../lib/zatca/tlv';

export interface ZatcaQrInvoiceData {
  sellerName?: string | null;
  vatNumber?: string | null;
  invoiceTotal?: number | null;
  vatTotal?: number | null;
  issueDate?: string | null;
  issueTime?: string | null;
}

interface ZatcaQrCodeProps {
  data?: string | null; // Pre-encoded Base64 TLV string
  invoice?: ZatcaQrInvoiceData; // Raw invoice fields for client-side TLV generation
  size?: number;
  className?: string;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

const PLACEHOLDER = {
  sellerName: 'Test Supplier',
  vatNumber: '00000000000000',
  invoiceTotal: '0.00',
  vatTotal: '0.00',
  timestamp: '2026-01-01T00:00:00+03:00',
};

function buildFallbackTlv(invoice: ZatcaQrInvoiceData): string {
  const sellerName = invoice.sellerName?.trim() || PLACEHOLDER.sellerName;
  const vatNumber = invoice.vatNumber?.trim() || PLACEHOLDER.vatNumber;
  const total = invoice.invoiceTotal != null ? invoice.invoiceTotal.toFixed(2) : PLACEHOLDER.invoiceTotal;
  const vatTotal = invoice.vatTotal != null ? invoice.vatTotal.toFixed(2) : PLACEHOLDER.vatTotal;

  let timestamp = PLACEHOLDER.timestamp;
  if (invoice.issueDate) {
    const time = invoice.issueTime?.trim() || '00:00:00';
    timestamp = `${invoice.issueDate}T${time}+03:00`;
  }

  return encodeTlvQr({
    sellerName,
    vatNumber,
    timestamp,
    invoiceTotal: total,
    vatTotal,
  });
}

export function ZatcaQrCode({
  data,
  invoice,
  size = 128,
  className = '',
  errorCorrectionLevel = 'M',
}: ZatcaQrCodeProps) {
  const [dataUrl, setDataUrl] = useState('');
  const [error, setError] = useState(false);
  const mounted = useRef(true);

  const qrPayload = data ? data : invoice ? buildFallbackTlv(invoice) : '';

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!qrPayload) { setDataUrl(''); setError(false); return; }
    setError(false);
    QRCode.toDataURL(qrPayload, {
      width: size,
      margin: 1,
      errorCorrectionLevel,
      color: { dark: '#000000', light: '#ffffff' },
    }).then((url) => {
      if (mounted.current) setDataUrl(url);
    }).catch(() => {
      if (mounted.current) setError(true);
    });
  }, [qrPayload, size, errorCorrectionLevel]);

  if (!qrPayload) {
    return (
      <div
        className={`flex items-center justify-center bg-secondary-100 dark:bg-secondary-800 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-secondary-400 text-xs text-center px-2">No QR</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`flex items-center justify-center bg-danger-50 dark:bg-danger-900/20 rounded-lg ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-danger-500 text-xs text-center px-2">QR Error</span>
      </div>
    );
  }

  return (
    <img
      src={dataUrl}
      alt="ZATCA QR Code"
      width={size}
      height={size}
      className={`rounded ${className}`}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  );
}

/**
 * Async utility to generate a QR code as a data URL.
 * Used for embedding QR in PDF/print templates.
 */
export async function generateQrDataUrl(data: string, size = 200): Promise<string> {
  if (!data) return '';
  try {
    return await QRCode.toDataURL(data, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return '';
  }
}
