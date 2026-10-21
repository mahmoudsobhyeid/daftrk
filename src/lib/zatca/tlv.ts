/**
 * ZATCA Phase 2 TLV (Tag-Length-Value) Encoder
 *
 * Produces the official Saudi QR code data per ZATCA e-Invoicing specifications.
 * TLV structure: each field is encoded as [Tag(1byte)][Length(1byte)][Value(Nbytes)]
 * The resulting byte array is Base64-encoded to produce the QR data string.
 *
 * Phase 2 Tags:
 *   1 — Seller name (UTF-8)
 *   2 — VAT registration number (ASCII)
 *   3 — Timestamp ISO 8601 (ASCII): YYYY-MM-DDTHH:MM:SS+03:00
 *   4 — Invoice total with VAT (ASCII decimal, 2dp)
 *   5 — VAT total (ASCII decimal, 2dp)
 *   6 — Invoice hash (Base64 of SHA-256)  [Phase 2 STANDARD invoice]
 *   7 — ECDSA signature (Base64)          [Phase 2 STANDARD invoice]
 *   8 — ECDSA public key (Base64)         [Phase 2 STANDARD invoice]
 *   9 — Certificate signature (Base64)    [Phase 2 SIMPLIFIED invoice]
 */

import type { ZatcaQrInput } from './types';

function encodeTlvField(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Converts a Uint8Array to a Base64 string without using the spread operator,
 * which would exceed the call stack for large payloads (Phase 2 signatures).
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/**
 * Encodes a ZatcaQrInput into the official ZATCA TLV Base64 string.
 * This string is what gets embedded in the QR code image.
 */
export function encodeTlvQr(input: ZatcaQrInput): string {
  const fields: Uint8Array[] = [
    encodeTlvField(1, input.sellerName),
    encodeTlvField(2, input.vatNumber),
    encodeTlvField(3, input.timestamp),
    encodeTlvField(4, input.invoiceTotal),
    encodeTlvField(5, input.vatTotal),
  ];

  if (input.invoiceHash) {
    fields.push(encodeTlvField(6, input.invoiceHash));
  }
  if (input.ecdsaSignature) {
    fields.push(encodeTlvField(7, input.ecdsaSignature));
  }
  if (input.publicKey) {
    fields.push(encodeTlvField(8, input.publicKey));
  }
  if (input.certificateSignature) {
    fields.push(encodeTlvField(9, input.certificateSignature));
  }

  const combined = concatUint8Arrays(...fields);
  return uint8ArrayToBase64(combined);
}

/**
 * Decodes a ZATCA TLV Base64 string back to a structured object.
 * Useful for validation and debugging.
 */
export function decodeTlvQr(base64: string): Record<string, string> {
  const tagNames: Record<number, string> = {
    1: 'sellerName',
    2: 'vatNumber',
    3: 'timestamp',
    4: 'invoiceTotal',
    5: 'vatTotal',
    6: 'invoiceHash',
    7: 'ecdsaSignature',
    8: 'publicKey',
    9: 'certificateSignature',
  };

  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const result: Record<string, string> = {};
  let i = 0;

  while (i < bytes.length) {
    const tag = bytes[i++];
    const length = bytes[i++];
    const value = new TextDecoder().decode(bytes.slice(i, i + length));
    i += length;
    const name = tagNames[tag] ?? `tag_${tag}`;
    result[name] = value;
  }

  return result;
}

/**
 * Builds the QR input for a ZATCA invoice.
 * Supply invoiceHash, ecdsaSignature, publicKey for Phase 2 extended tags.
 */
export function buildQrInput(params: {
  sellerName: string;
  vatNumber: string;
  issueDate: string;
  issueTime: string;
  invoiceTotal: number;
  vatTotal: number;
  invoiceHash?: string;
  ecdsaSignature?: string;
  publicKey?: string;
  certificateSignature?: string;
  isSimplified?: boolean;
}): ZatcaQrInput {
  const timestamp = `${params.issueDate}T${params.issueTime}+03:00`;

  return {
    sellerName: params.sellerName,
    vatNumber: params.vatNumber,
    timestamp,
    invoiceTotal: params.invoiceTotal.toFixed(2),
    vatTotal: params.vatTotal.toFixed(2),
    invoiceHash: params.invoiceHash,
    ecdsaSignature: params.ecdsaSignature,
    publicKey: params.publicKey,
    certificateSignature: params.isSimplified ? params.certificateSignature : undefined,
  };
}
