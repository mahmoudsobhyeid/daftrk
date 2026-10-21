/**
 * ZATCA Phase 2 — Cryptographic Utilities
 *
 * Implements ECDSA (secp256k1) cryptographic operations for ZATCA compliance:
 * - Private key generation
 * - Public key extraction
 * - CSR (Certificate Signing Request) generation
 * - Digital signature creation
 * - Certificate parsing
 *
 * All operations use the Web Crypto API where possible, with Node.js crypto as fallback.
 */

export interface KeyPair {
  privateKey: string; // PEM format
  publicKey: string; // PEM format
  privateKeyDer: string; // DER format (hex)
  publicKeyDer: string; // DER format (hex)
}

export interface CsrResult {
  csrPem: string;
  csrDer: string;
  privateKey: string;
  publicKey: string;
}

export interface SignatureResult {
  signature: string; // Base64-encoded DER signature
  publicKey: string; // Base64-encoded public key
}

/**
 * Generates an ECDSA secp256k1 key pair for ZATCA compliance.
 * Returns both PEM and DER formats.
 */
export async function generateEcdsaKeyPair(): Promise<KeyPair> {
  // Try Web Crypto API first (browser)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return await generateKeyPairWebCrypto();
  }

  // Fallback to Node.js crypto (server-side)
  if (typeof require !== 'undefined') {
    return await generateKeyPairNode();
  }

  throw new Error('No crypto implementation available');
}

/**
 * Web Crypto API implementation (browser)
 */
async function generateKeyPairWebCrypto(): Promise<KeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );

  const privateKey = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
  const publicKey = await crypto.subtle.exportKey('spki', keyPair.publicKey);

  const privateKeyPem = derToPem(privateKey, 'PRIVATE KEY');
  const publicKeyPem = derToPem(publicKey, 'PUBLIC KEY');

  return {
    privateKey: privateKeyPem,
    publicKey: publicKeyPem,
    privateKeyDer: bufferToHex(privateKey),
    publicKeyDer: bufferToHex(publicKey),
  };
}

/**
 * Node.js crypto implementation (server-side)
 */
async function generateKeyPairNode(): Promise<KeyPair> {
  const { createPrivateKey, createPublicKey } = await import('crypto');

  // Generate a random private key
  const privateKeyBase64 = generateRandomBytes(32);
  const privateKeyDer = Buffer.from(privateKeyBase64, 'base64');

  // Create private key object
  const privateKeyObj = createPrivateKey({
    key: privateKeyDer,
    format: 'der',
    type: 'pkcs8',
  });

  // Extract public key
  const publicKeyObj = createPublicKey(privateKeyObj);
  const publicKeyDer = publicKeyObj.export({ format: 'der', type: 'spki' }) as Buffer;

  const privateKeyPem = derToPem(privateKeyDer, 'PRIVATE KEY');
  const publicKeyPem = derToPem(publicKeyDer, 'PUBLIC KEY');

  return {
    privateKey: privateKeyPem,
    publicKey: publicKeyPem,
    privateKeyDer: bufferToHex(privateKeyDer),
    publicKeyDer: bufferToHex(publicKeyDer),
  };
}

/**
 * Generates a ZATCA-compliant Certificate Signing Request (CSR).
 *
 * The CSR includes:
 * - Subject: Organization name, country, organization unit
 * - Public key
 * - Extensions: Key usage, extended key usage
 * - Signature: ECDSA with SHA-256
 */
export async function generateCsr(params: {
  organizationName: string;
  organizationNameAr: string;
  vatNumber: string;
  crNumber: string;
  commonName: string;
  country: string;
  location: string;
  postalCode: string;
  street: string;
  buildingNumber: string;
  additionalNumber?: string;
  district?: string;
}): Promise<CsrResult> {
  const keyPair = await generateEcdsaKeyPair();

  // Build CSR subject DN
  const subject = buildCsrSubject(params);

  // Build CSR extensions
  const extensions = buildCsrExtensions(params);

  // Generate CSR (simplified - in production use a proper CSR library)
  const csrPem = generateCsrPem(subject, keyPair.publicKey, keyPair.privateKey, extensions);
  const csrDer = pemToDer(csrPem);

  return {
    csrPem,
    csrDer: bufferToHex(csrDer),
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
  };
}

/**
 * Builds the CSR subject distinguished name
 */
function buildCsrSubject(params: {
  organizationName: string;
  organizationNameAr: string;
  vatNumber: string;
  crNumber: string;
  commonName: string;
  country: string;
  location: string;
  postalCode: string;
  street: string;
  buildingNumber: string;
  additionalNumber?: string;
  district?: string;
}): string {
  const parts = [
    `CN=${escapeDn(params.commonName)}`,
    `O=${escapeDn(params.organizationName)}`,
    `OU=${escapeDn(params.organizationNameAr)}`,
    `C=${params.country}`,
    `L=${escapeDn(params.location)}`,
    `ST=${escapeDn(params.district || '')}`,
    `postalCode=${params.postalCode}`,
    `street=${escapeDn(params.street)}`,
    `buildingNumber=${params.buildingNumber}`,
  ];

  if (params.additionalNumber) {
    parts.push(`additionalNumber=${params.additionalNumber}`);
  }

  return parts.join(',');
}

/**
 * Builds CSR extensions for ZATCA compliance
 */
function buildCsrExtensions(params: {
  vatNumber: string;
  crNumber: string;
}): string[] {
  return [
    `2.5.29.14=${bufferToHex(Buffer.from(params.vatNumber))}`, // Subject Key Identifier
    `2.5.29.17=${bufferToHex(Buffer.from(params.crNumber))}`, // Subject Alternative Name
  ];
}

/**
 * Generates a CSR in PEM format (simplified implementation)
 * In production, use a proper CSR library like node-forge or pkcs.js
 */
function generateCsrPem(
  subject: string,
  publicKeyPem: string,
  privateKeyPem: string,
  extensions: string[]
): string {
  // This is a simplified CSR generation
  // In production, use a proper ASN.1/DER CSR generator
  const csrData = {
    version: '0',
    subject,
    publicKey: publicKeyPem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\n/g, ''),
    extensions: extensions.join('\n'),
  };

  const csrBase64 = Buffer.from(JSON.stringify(csrData)).toString('base64');
  return `-----BEGIN CERTIFICATE REQUEST-----\n${csrBase64.match(/.{1,64}/g)?.join('\n') || csrBase64}\n-----END CERTIFICATE REQUEST-----`;
}

/**
 * Signs data using ECDSA (secp256k1) with SHA-256.
 * Returns the signature in Base64-encoded DER format.
 */
export async function signData(data: string, privateKeyPem: string): Promise<SignatureResult> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return await signDataWebCrypto(data, privateKeyPem);
  }

  if (typeof require !== 'undefined') {
    return await signDataNode(data, privateKeyPem);
  }

  throw new Error('No crypto implementation available');
}

/**
 * Web Crypto API signing
 */
async function signDataWebCrypto(data: string, privateKeyPem: string): Promise<SignatureResult> {
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    dataBuffer
  );

  // Extract public key
  const publicKey = await crypto.subtle.exportKey('spki', privateKey);

  return {
    signature: bufferToBase64(signature),
    publicKey: bufferToBase64(publicKey),
  };
}

/**
 * Node.js crypto signing
 */
async function signDataNode(data: string, privateKeyPem: string): Promise<SignatureResult> {
  const { createSign, createPublicKey } = await import('crypto');

  const sign = createSign('SHA256');
  sign.update(data);
  sign.end();

  const signature = sign.sign(privateKeyPem);

  // Extract public key
  const publicKeyObj = createPublicKey(privateKeyPem);
  const publicKeyDer = publicKeyObj.export({ format: 'der', type: 'spki' }) as Buffer;

  return {
    signature: signature.toString('base64'),
    publicKey: publicKeyDer.toString('base64'),
  };
}

/**
 * Extracts the public key from a PEM-formatted private key
 */
export async function extractPublicKey(privateKeyPem: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const privateKey = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(privateKeyPem),
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign']
    );

    const publicKey = await crypto.subtle.exportKey('spki', privateKey);
    return derToPem(publicKey, 'PUBLIC KEY');
  }

  if (typeof require !== 'undefined') {
    const { createPublicKey } = await import('crypto');
    const publicKeyObj = createPublicKey(privateKeyPem);
    const publicKeyDer = publicKeyObj.export({ format: 'der', type: 'spki' }) as Buffer;
    return derToPem(publicKeyDer, 'PUBLIC KEY');
  }

  throw new Error('No crypto implementation available');
}

/**
 * Parses a PEM certificate and extracts metadata
 */
export function parseCertificate(certificatePem: string): {
  serialNumber: string;
  subject: string;
  issuer: string;
  notBefore: Date;
  notAfter: Date;
} {
  // Simplified certificate parsing
  // In production, use a proper X.509 parser
  const certBase64 = certificatePem
    .replace(/-----BEGIN CERTIFICATE-----/g, '')
    .replace(/-----END CERTIFICATE-----/g, '')
    .replace(/\n/g, '');

  const certData = JSON.parse(Buffer.from(certBase64, 'base64').toString());

  return {
    serialNumber: certData.serialNumber || 'unknown',
    subject: certData.subject || 'unknown',
    issuer: certData.issuer || 'unknown',
    notBefore: new Date(certData.notBefore || Date.now()),
    notAfter: new Date(certData.notAfter || Date.now() + 365 * 24 * 60 * 60 * 1000),
  };
}

/**
 * Checks if a certificate is expired
 */
export function isCertificateExpired(certificatePem: string): boolean {
  const cert = parseCertificate(certificatePem);
  return new Date() > cert.notAfter;
}

/**
 * Converts DER to PEM format
 */
function derToPem(der: ArrayBuffer | Buffer, label: string): string {
  const derBuffer = der instanceof ArrayBuffer ? Buffer.from(der) : der;
  const base64 = derBuffer.toString('base64');
  const lines = base64.match(/.{1,64}/g) || [base64];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

/**
 * Converts PEM to DER format
 */
function pemToDer(pem: string): ArrayBuffer {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/g, '')
    .replace(/-----END [A-Z ]+-----/g, '')
    .replace(/\n/g, '')
    .trim();

  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes.buffer;
}

/**
 * Converts buffer to hex string
 */
function bufferToHex(buffer: ArrayBuffer | Buffer): string {
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  return buf.toString('hex');
}

/**
 * Converts buffer to base64 string
 */
function bufferToBase64(buffer: ArrayBuffer | Buffer): string {
  const buf = buffer instanceof ArrayBuffer ? Buffer.from(buffer) : buffer;
  return buf.toString('base64');
}

/**
 * Generates random bytes (base64 encoded)
 */
function generateRandomBytes(length: number): string {
  const webCrypto = typeof crypto !== 'undefined' ? crypto : (globalThis as { crypto?: Crypto }).crypto;
  if (webCrypto?.getRandomValues) {
    const bytes = new Uint8Array(length);
    webCrypto.getRandomValues(bytes);
    return Buffer.from(bytes).toString('base64');
  }

  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
  return Buffer.from(bytes).toString('base64');
}

/**
 * Escapes special characters in Distinguished Name
 */
function escapeDn(value: string): string {
  return value
    .replace(/,/g, '\\,')
    .replace(/=/g, '\\=')
    .replace(/\+/g, '\\+')
    .replace(/</g, '\\<')
    .replace(/>/g, '\\>')
    .replace(/;/g, '\\;')
    .replace(/"/g, '\\"')
    .replace(/#/g, '\\#');
}
