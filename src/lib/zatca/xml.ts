/**
 * ZATCA Phase 2 — UBL 2.1 XML Generator
 *
 * Generates fully compliant UBL 2.1 XML for Saudi e-invoices.
 * Supports:
 * - Standard Tax Invoice (B2B) — requires clearance
 * - Simplified Tax Invoice (B2C) — requires reporting
 * - Credit Notes (381)
 * - Debit Notes (383)
 *
 * Follows ZATCA specifications:
 * - UBL 2.1 namespace declarations
 * - Saudi Extensions (ZATCA Extension namespace)
 * - Mandatory fields per Business Rules v3.x
 * - Arabic character support
 * - Tax category breakdown
 */

import type { ZatcaInvoiceData } from './types';
import { formatPihValue } from './hash';

function xmlEscape(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fmtAmount(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

/**
 * Generates the UBL 2.1 XML Invoice document string.
 * This is the exact format required by ZATCA for submission/clearance.
 */
export function generateUblXml(data: ZatcaInvoiceData): string {
  const isCredit = data.typeCode === '381';
  const isDebit = data.typeCode === '383';
  const isStandard = data.invoiceType === 'standard';
  const rootElement = isCredit ? 'CreditNote' : isDebit ? 'DebitNote' : 'Invoice';
  const lineElement = isCredit ? 'CreditNoteLine' : isDebit ? 'DebitNoteLine' : 'InvoiceLine';
  const qtyElement = isCredit ? 'CreditedQuantity' : isDebit ? 'DebitedQuantity' : 'InvoicedQuantity';

  const pihValue = formatPihValue(data.prevInvoiceHash ?? null);
  const signatureValue = data.signature ?? '';
  const certContent = data.certificateContent ?? '';
  const legalTaxExclusiveAmount = Math.max(0, data.lineExtensionAmount - data.allowanceTotal);
  const legalTaxInclusiveAmount = Math.max(0, data.lineExtensionAmount + data.taxTotal - data.allowanceTotal + data.roundingAmount);

  return `<?xml version="1.0" encoding="UTF-8"?>
<${rootElement} xmlns="urn:oasis:names:specification:ubl:schema:xsd:${rootElement}-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
          xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
          xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
          <sac:SignatureInformation>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
            <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
            <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
              <ds:SignedInfo>
                <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
                <ds:Reference Id="invoiceSignedData" URI="">
                  <ds:Transforms>
                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                      <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                    </ds:Transform>
                    <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                      <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                    </ds:Transform>
                    <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                  </ds:Transforms>
                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                  <ds:DigestValue>${xmlEscape(data.invoiceHash ?? '')}</ds:DigestValue>
                </ds:Reference>
                <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                  <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                  <ds:DigestValue></ds:DigestValue>
                </ds:Reference>
              </ds:SignedInfo>
              <ds:SignatureValue>${xmlEscape(signatureValue)}</ds:SignatureValue>
              <ds:KeyInfo>
                <ds:X509Data>
                  <ds:X509Certificate>${xmlEscape(certContent)}</ds:X509Certificate>
                </ds:X509Data>
              </ds:KeyInfo>
              <ds:Object>
                <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                  <xades:SignedProperties Id="xadesSignedProperties">
                    <xades:SignedSignatureProperties>
                      <xades:SigningTime>${data.issueDate}T${data.issueTime}+03:00</xades:SigningTime>
                      <xades:SigningCertificate>
                        <xades:Cert>
                          <xades:CertDigest>
                            <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                            <ds:DigestValue></ds:DigestValue>
                          </xades:CertDigest>
                          <xades:IssuerSerial>
                            <ds:X509IssuerName></ds:X509IssuerName>
                            <ds:X509SerialNumber></ds:X509SerialNumber>
                          </xades:IssuerSerial>
                        </xades:Cert>
                      </xades:SigningCertificate>
                    </xades:SignedSignatureProperties>
                  </xades:SignedProperties>
                </xades:QualifyingProperties>
              </ds:Object>
            </ds:Signature>
          </sac:SignatureInformation>
        </sig:UBLDocumentSignatures>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${xmlEscape(data.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${xmlEscape(data.uuid)}</cbc:UUID>
  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${data.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${data.subtype}">${data.typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${data.currencyCode}</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>${
    data.purchaseOrder
      ? `\n  <cbc:BuyerReference>${xmlEscape(data.purchaseOrder)}</cbc:BuyerReference>`
      : ''
  }
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${data.icv}</cbc:UUID>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${pihValue}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${xmlEscape(data.qrData ?? '')}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>
  <cac:Signature>
    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${xmlEscape(data.seller.crNumber ?? '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(data.seller.address.street)}</cbc:StreetName>${
          data.seller.address.additionalStreet
            ? `\n        <cbc:AdditionalStreetName>${xmlEscape(data.seller.address.additionalStreet)}</cbc:AdditionalStreetName>`
            : ''
        }
        <cbc:BuildingNumber>${xmlEscape(data.seller.address.buildingNumber)}</cbc:BuildingNumber>${
          data.seller.address.additionalNumber
            ? `\n        <cbc:PlotIdentification>${xmlEscape(data.seller.address.additionalNumber)}</cbc:PlotIdentification>`
            : ''
        }
        <cbc:CitySubdivisionName>${xmlEscape(data.seller.address.district ?? '')}</cbc:CitySubdivisionName>
        <cbc:CityName>${xmlEscape(data.seller.address.cityName)}</cbc:CityName>
        <cbc:PostalZone>${xmlEscape(data.seller.address.postalZone)}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${data.seller.address.countryCode}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEscape(data.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(data.seller.nameAr)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>${
      isStandard && data.buyer.vatNumber
        ? `
      <cac:PartyIdentification>
        <cbc:ID schemeID="NAT">${xmlEscape(data.buyer.crNumber ?? '')}</cbc:ID>
      </cac:PartyIdentification>`
        : ''
    }${
      data.buyer.address
        ? `
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(data.buyer.address.street ?? '')}</cbc:StreetName>
        <cbc:BuildingNumber>${xmlEscape(data.buyer.address.buildingNumber ?? '')}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${xmlEscape(data.buyer.address.district ?? '')}</cbc:CitySubdivisionName>
        <cbc:CityName>${xmlEscape(data.buyer.address.cityName ?? '')}</cbc:CityName>
        <cbc:PostalZone>${xmlEscape(data.buyer.address.postalZone ?? '')}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${data.buyer.address.countryCode ?? 'SA'}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>`
        : ''
    }${
      isStandard && data.buyer.vatNumber
        ? `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xmlEscape(data.buyer.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`
        : ''
    }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(data.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${data.deliveryDate ?? data.issueDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${data.paymentMeansCode}</cbc:PaymentMeansCode>${
      data.paymentAccountId
        ? `
    <cac:PayeeFinancialAccount>
      <cbc:ID>${xmlEscape(data.paymentAccountId)}</cbc:ID>
    </cac:PayeeFinancialAccount>`
        : ''
    }
  </cac:PaymentMeans>${
    data.notes
      ? `
  <cac:PaymentTerms>
    <cbc:Note>${xmlEscape(data.notes)}</cbc:Note>
  </cac:PaymentTerms>`
      : ''
  }
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReasonCode>95</cbc:AllowanceChargeReasonCode>
    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="${data.currencyCode}">${fmtAmount(data.allowanceTotal)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>15.00</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${fmtAmount(data.taxTotal)}</cbc:TaxAmount>
    ${data.taxTotals
      .map(
        (tt) => `<cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${data.currencyCode}">${fmtAmount(tt.taxableAmount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${data.currencyCode}">${fmtAmount(tt.taxAmount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${tt.taxCategory}</cbc:ID>
        <cbc:Percent>${fmtAmount(tt.taxRate)}</cbc:Percent>${
          tt.exemptionReasonCode
            ? `\n        <cbc:TaxExemptionReasonCode>${xmlEscape(tt.exemptionReasonCode)}</cbc:TaxExemptionReasonCode>`
            : ''
        }${
          tt.exemptionReason
            ? `\n        <cbc:TaxExemptionReason>${xmlEscape(tt.exemptionReason)}</cbc:TaxExemptionReason>`
            : ''
        }
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`
      )
      .join('\n    ')}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${data.currencyCode}">${fmtAmount(data.lineExtensionAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${data.currencyCode}">${fmtAmount(legalTaxExclusiveAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${data.currencyCode}">${fmtAmount(legalTaxInclusiveAmount)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${data.currencyCode}">${fmtAmount(data.allowanceTotal)}</cbc:AllowanceTotalAmount>
    <cbc:PrepaidAmount currencyID="${data.currencyCode}">0.00</cbc:PrepaidAmount>
    <cbc:PayableRoundingAmount currencyID="${data.currencyCode}">${fmtAmount(data.roundingAmount)}</cbc:PayableRoundingAmount>
    <cbc:PayableAmount currencyID="${data.currencyCode}">${fmtAmount(legalTaxInclusiveAmount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  ${data.items
    .map(
      (item, idx) => `<${lineElement}>
    <cbc:ID>${idx + 1}</cbc:ID>
    <${qtyElement} unitCode="${item.unit}">${item.quantity}</${qtyElement}>
    <cbc:LineExtensionAmount currencyID="${data.currencyCode}">${fmtAmount(item.netAmount)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="${data.currencyCode}">${fmtAmount(item.vatAmount)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="${data.currencyCode}">${fmtAmount(item.lineTotal)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${xmlEscape(item.description)}</cbc:Name>${
        item.sku
          ? `\n      <cac:SellersItemIdentification>\n        <cbc:ID>${xmlEscape(item.sku)}</cbc:ID>\n      </cac:SellersItemIdentification>`
          : ''
      }
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${item.taxCategory}</cbc:ID>
        <cbc:Percent>${fmtAmount(item.taxRate)}</cbc:Percent>${
          item.taxExemptionReasonCode
            ? `\n        <cbc:TaxExemptionReasonCode>${xmlEscape(item.taxExemptionReasonCode)}</cbc:TaxExemptionReasonCode>`
            : ''
        }${
          item.taxExemptionReason
            ? `\n        <cbc:TaxExemptionReason>${xmlEscape(item.taxExemptionReason)}</cbc:TaxExemptionReason>`
            : ''
        }
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${data.currencyCode}">${fmtAmount(item.unitPrice)}</cbc:PriceAmount>
      <cbc:BaseQuantity unitCode="${item.unit}">1</cbc:BaseQuantity>${
        item.discountAmount > 0
          ? `\n      <cac:AllowanceCharge>\n        <cbc:ChargeIndicator>false</cbc:ChargeIndicator>\n        <cbc:Amount currencyID="${data.currencyCode}">${fmtAmount(item.discountAmount / item.quantity)}</cbc:Amount>\n      </cac:AllowanceCharge>`
          : ''
      }
    </cac:Price>
  </${lineElement}>`
    )
    .join('\n  ')}
</${rootElement}>`;
}

/**
 * Generates the canonical XML used for hashing.
 * Strips the UBLExtensions (signature) block and produces a normalized string.
 */
export function generateCanonicalXml(data: ZatcaInvoiceData): string {
  const full = generateUblXml(data);
  const withoutExtensions = full
    .replace(/<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/m, '')
    .replace(/<cac:Signature>[\s\S]*?<\/cac:Signature>/m, '')
    .replace(/\n\s*\n/g, '\n')
    .trim();
  return withoutExtensions;
}
