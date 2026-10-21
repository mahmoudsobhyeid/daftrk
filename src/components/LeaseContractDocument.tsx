import { forwardRef } from 'react';
import { Home, UserCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { Lease } from '../lib/types';

export interface LeaseContractCompany {
  name: string;
  address: string | null;
  phone: string | null;
  tax_number: string | null;
}

interface LeaseContractDocumentProps {
  lease: Lease;
  company: LeaseContractCompany | null;
}

/**
 * Printable lease contract agreement. Reused by the contract modal and by the
 * off-screen PDF export host on the leases list.
 */
export const LeaseContractDocument = forwardRef<HTMLDivElement, LeaseContractDocumentProps>(
  ({ lease, company }, ref) => {
    const { t } = useLanguage();

    return (
      <div
        ref={ref}
        className="rounded-xl border border-secondary-200 dark:border-secondary-800 p-8 space-y-6 bg-white dark:bg-secondary-900"
      >
        <div className="text-center border-b border-secondary-200 pb-4">
          <h1 className="text-2xl font-black text-secondary-800 dark:text-secondary-100">
            {t('rental.leaseContractTitle')}
          </h1>
          <p className="text-sm text-secondary-500 mt-1">
            {t('rental.ejarSubtitle')}
          </p>
          {lease.contract_number && (
            <p className="text-xs font-semibold text-primary-600 mt-2">
              {t('rental.contractNo')}: {lease.contract_number}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg border border-secondary-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Home size={14} className="text-primary-500" />
              <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">{t('rental.lessor')}</h3>
            </div>
            <dl className="space-y-1 text-xs text-secondary-600 dark:text-secondary-400">
              <div><dt className="inline font-semibold">{t('rental.name')}: </dt><dd className="inline">{lease.lessor_name ?? company?.name ?? '—'}</dd></div>
              <div><dt className="inline font-semibold">{t('rental.phone')}: </dt><dd className="inline">{lease.lessor_phone ?? company?.phone ?? '—'}</dd></div>
              <div><dt className="inline font-semibold">{t('rental.idCr')}: </dt><dd className="inline">{lease.lessor_id_number ?? company?.tax_number ?? '—'}</dd></div>
            </dl>
          </div>
          <div className="rounded-lg border border-secondary-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <UserCheck size={14} className="text-primary-500" />
              <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">{t('rental.tenantLessee')}</h3>
            </div>
            <dl className="space-y-1 text-xs text-secondary-600 dark:text-secondary-400">
              <div><dt className="inline font-semibold">{t('rental.name')}: </dt><dd className="inline">{lease.tenant_name}</dd></div>
              <div><dt className="inline font-semibold">{t('rental.phone')}: </dt><dd className="inline">{lease.tenant_phone ?? '—'}</dd></div>
              <div><dt className="inline font-semibold">{t('rental.idIqama')}: </dt><dd className="inline">{lease.tenant_id_number ?? '—'}</dd></div>
              <div><dt className="inline font-semibold">{t('rental.email')}: </dt><dd className="inline">{lease.tenant_email ?? '—'}</dd></div>
            </dl>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200 border-b border-secondary-200 pb-1">
            {t('rental.contractTerms')}
          </h3>
          <table className="w-full text-xs">
            <tbody>
              <tr className="border-b border-secondary-100 dark:border-secondary-800">
                <td className="py-2 font-semibold text-secondary-600 dark:text-secondary-300 w-1/3">{t('rental.rentedUnit')}</td>
                <td className="py-2 text-secondary-700 dark:text-secondary-200">{lease.unit?.unit_number ?? '—'}</td>
              </tr>
              <tr className="border-b border-secondary-100 dark:border-secondary-800">
                <td className="py-2 font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.contractDuration')}</td>
                <td className="py-2 text-secondary-700 dark:text-secondary-200">{lease.start_date} → {lease.end_date}</td>
              </tr>
              <tr className="border-b border-secondary-100 dark:border-secondary-800">
                <td className="py-2 font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.rentalCost')}</td>
                <td className="py-2 text-secondary-700 dark:text-secondary-200">{lease.rent_amount.toFixed(2)} SAR</td>
              </tr>
              <tr className="border-b border-secondary-100 dark:border-secondary-800">
                <td className="py-2 font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.paymentInstallments')}</td>
                <td className="py-2 text-secondary-700 dark:text-secondary-200">{t(`paymentFreq.${lease.payment_frequency}`)}</td>
              </tr>
              <tr className="border-b border-secondary-100 dark:border-secondary-800">
                <td className="py-2 font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.securityDeposit')}</td>
                <td className="py-2 text-secondary-700 dark:text-secondary-200">{lease.security_deposit?.toFixed(2) ?? '0.00'} SAR</td>
              </tr>
              <tr className="border-b border-secondary-100 dark:border-secondary-800">
                <td className="py-2 font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.maintenanceResp')}</td>
                <td className="py-2 text-secondary-700 dark:text-secondary-200">{t(`maintenance.${lease.maintenance_responsibility ?? 'landlord'}`)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {lease.notes && (
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-secondary-700 dark:text-secondary-200">{t('rental.additionalTerms')}</h3>
            <p className="text-xs text-secondary-600 dark:text-secondary-400 whitespace-pre-wrap rounded-lg bg-secondary-50 dark:bg-secondary-800/50 p-3">{lease.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-8 pt-8">
          <div className="text-center">
            <div className="border-t border-secondary-400 pt-2">
              <p className="text-xs font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.lessorSignature')}</p>
              <p className="text-[10px] text-secondary-400 mt-1">{lease.lessor_name ?? company?.name ?? ''}</p>
            </div>
          </div>
          <div className="text-center">
            <div className="border-t border-secondary-400 pt-2">
              <p className="text-xs font-semibold text-secondary-600 dark:text-secondary-300">{t('rental.tenantSignature')}</p>
              <p className="text-[10px] text-secondary-400 mt-1">{lease.tenant_name}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

LeaseContractDocument.displayName = 'LeaseContractDocument';
