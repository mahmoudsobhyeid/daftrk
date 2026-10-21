/**
 * ZATCA Phase 2 — SHA-256 Invoice Hash Engine
 *
 * Implements the official ZATCA hashing algorithm:
 * 1. Generate canonical XML (with empty signature element)
 * 2. Compute SHA-256 of the canonical XML bytes
 * 3. Base64-encode the hash
 *
 * The hash is stored in the invoice and used for:
 * - Chaining invoices (each invoice stores the hash of the previous one)
 * - The QR code (tag 6)
 * - Digital signature verification
 */

export interface HashResult {
  hashBase64: string;
  hashHex: string;
}

/**
 * Computes SHA-256 of a UTF-8 string using the Web Crypto API.
 * Returns both Base64 and hex representations.
 */
export async function sha256(input: string): Promise<HashResult> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashBase64 = btoa(String.fromCharCode(...hashArray));

  return { hashBase64, hashHex };
}

/**
 * Generates the hash for a ZATCA invoice.
 * Input is the canonical XML string with the PIH (Previous Invoice Hash) embedded
 * and the signature element present but empty.
 */
export async function hashInvoiceXml(canonicalXml: string): Promise<HashResult> {
  return sha256(canonicalXml);
}

/**
 * Generates a placeholder hash for the very first invoice in a sequence
 * (no previous invoice exists). Per ZATCA spec, this is the SHA-256 of the
 * empty string, Base64-encoded.
 */
export async function generateFirstInvoiceHash(): Promise<string> {
  const { hashBase64 } = await sha256('');
  return hashBase64;
}

/**
 * Verifies that an invoice hash matches the stored hash.
 * Used for integrity validation.
 */
export async function verifyInvoiceHash(
  canonicalXml: string,
  storedHash: string
): Promise<boolean> {
  const { hashBase64 } = await hashInvoiceXml(canonicalXml);
  return hashBase64 === storedHash;
}

/**
 * ECDSA Digital Signature Architecture
 *
 * NOTE: In production ZATCA Phase 2, signing requires:
 * 1. A CCSID (Cryptographic Customer Stamp Identifier) certificate from ZATCA
 * 2. The corresponding private key (ECDSA P-256)
 * 3. Using the certificate to sign the invoice XML
 *
 * This function provides the structural interface for when certificates are loaded.
 * The actual ECDSA signing will be wired in when connecting to ZATCA.
 */
export interface SignatureContext {
  privateKeyPem?: string;
  certificatePem?: string;
  publicKeyPem?: string;
}

/**
 * Produces a mock signature placeholder for use before ZATCA certificate onboarding.
 * Replace with actual ECDSA signing once the certificate is provisioned.
 */
export function buildSignaturePlaceholder(invoiceHash: string): string {
  return btoa(`SIGNATURE_PENDING::${invoiceHash.slice(0, 16)}`);
}

/**
 * Formats invoice hash value to include the standard ZATCA PIH (Previous Invoice Hash)
 * element format used in UBL XML.
 */
export function formatPihValue(prevHash: string | null): string {
  if (!prevHash) {
    return 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI4NWYzMTRiNjM4MzUzYWZkNA==';
  }
  return prevHash;
}
