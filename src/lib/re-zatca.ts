/**
 * Lightweight ZATCA Phase 1/2 QR generator using TLV (Tag-Length-Value) Base64 encoding.
 * Tags: 1=Seller Name, 2=VAT Reg Number, 3=Timestamp, 4=Total with VAT, 5=VAT Total.
 */

function encodeField(tag: number, value: string): Uint8Array {
  const bytes = new TextEncoder().encode(value);
  const tlv = new Uint8Array(2 + bytes.length);
  tlv[0] = tag;
  tlv[1] = bytes.length;
  tlv.set(bytes, 2);
  return tlv;
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { result.set(arr, offset); offset += arr.length; }
  return result;
}

export function generateZatcaQr(params: {
  sellerName: string;
  vatNumber: string;
  issueDate: string;
  invoiceTotal: number;
  vatTotal: number;
}): string {
  const timestamp = `${params.issueDate}T${new Date().toTimeString().slice(0, 8)}+03:00`;
  const combined = concat(
    encodeField(1, params.sellerName),
    encodeField(2, params.vatNumber),
    encodeField(3, timestamp),
    encodeField(4, params.invoiceTotal.toFixed(2)),
    encodeField(5, params.vatTotal.toFixed(2)),
  );
  return btoa(String.fromCharCode(...combined));
}

export const VAT_RATE = 0.15;

export function calcVat(subtotal: number): number {
  return Math.round(subtotal * VAT_RATE * 100) / 100;
}

export function calcTotal(subtotal: number): number {
  return Math.round(subtotal * (1 + VAT_RATE) * 100) / 100;
}

export function generatePaymentSchedule(params: {
  startDate: string;
  endDate: string;
  rentAmount: number;
  frequency: PaymentFrequency;
}): { date: string; amount: number }[] {
  const schedule: { date: string; amount: number }[] = [];
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);
  const stepMonths = params.frequency === 'monthly' ? 1 : params.frequency === 'quarterly' ? 3 : 12;
  const current = new Date(start);
  while (current <= end) {
    schedule.push({ date: current.toISOString().slice(0, 10), amount: params.rentAmount });
    current.setMonth(current.getMonth() + stepMonths);
  }
  return schedule;
}

import type { PaymentFrequency } from './types';
