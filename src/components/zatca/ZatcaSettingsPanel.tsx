/**
 * ZATCA / E-Invoicing Settings Panel
 *
 * Company-level e-invoicing configuration (Saudi ZATCA / Fatoora):
 * - Master "Enable E-Invoicing" toggle (settings are hidden/disabled until enabled)
 * - Section 1: E-Invoicing Settings (registration + credentials)
 * - Section 2: Address Details (national address)
 *
 * All fields are bound to component state and persisted to Supabase
 * (zatca_company_config + companies).
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { Shield, CheckCircle, AlertCircle, Loader2, Save, Link2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardBody, CardHeader, CardTitle } from '../ui/Card';
import type { Company } from '../../lib/types';

interface ZatcaConfigRow {
  company_id: string;
  is_enabled: boolean | null;
  common_name: string | null;
  branch_name: string | null;
  vat_number: string | null;
  cr_number: string | null;
  organization_name: string | null;
  country_code: string | null;
  business_category: string | null;
  zatca_otp: string | null;
  is_onboarded: boolean | null;
  onboarding_status: string | null;
  production_csid: string | null;
}

interface Fields {
  commonName: string;
  branchName: string;
  vatNumber: string;
  crNumber: string;
  organizationName: string;
  countryCode: string;
  address: string;
  businessCategory: string;
  zatcaOtp: string;
  buildingNumber: string;
  streetName: string;
  additionalNumber: string;
  district: string;
  city: string;
  postalCode: string;
  shortAddress: string;
}

type FieldErrors = Partial<Record<keyof Fields, string>>;

const EMPTY_FIELDS: Fields = {
  commonName: '',
  branchName: '',
  vatNumber: '',
  crNumber: '',
  organizationName: '',
  countryCode: 'SA',
  address: '',
  businessCategory: '',
  zatcaOtp: '',
  buildingNumber: '',
  streetName: '',
  additionalNumber: '',
  district: '',
  city: '',
  postalCode: '',
  shortAddress: '',
};

/** Required fields (ZATCA OTP is additionally required while not connected). */
const REQUIRED_FIELDS: (keyof Fields)[] = [
  'commonName', 'branchName', 'vatNumber', 'organizationName',
  'countryCode', 'address', 'businessCategory',
];

export interface ZatcaSettingsPanelProps {
  company: Company;
}

export function ZatcaSettingsPanel({ company }: ZatcaSettingsPanelProps) {
  const { toast } = useToast();
  const { refresh } = useCompany();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [connected, setConnected] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY_FIELDS);
  const [errors, setErrors] = useState<FieldErrors>({});

  const set = useCallback(<K extends keyof Fields>(key: K, value: Fields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }, []);

  // Load configuration
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('zatca_company_config')
        .select('*')
        .eq('company_id', company.id)
        .maybeSingle();

      if (!active) return;
      const cfg = data as ZatcaConfigRow | null;

      setEnabled(Boolean(cfg?.is_enabled));
      setConnected(Boolean(cfg?.is_onboarded || cfg?.onboarding_status === 'connected' || cfg?.production_csid));
      setFields({
        commonName: cfg?.common_name ?? company.name ?? '',
        branchName: cfg?.branch_name ?? '',
        vatNumber: cfg?.vat_number ?? company.tax_number ?? '',
        crNumber: cfg?.cr_number ?? company.commercial_registration ?? '',
        organizationName: cfg?.organization_name ?? company.name ?? '',
        countryCode: cfg?.country_code ?? 'SA',
        address: company.address ?? '',
        businessCategory: cfg?.business_category ?? '',
        zatcaOtp: cfg?.zatca_otp ?? '',
        buildingNumber: company.building_number ?? '',
        streetName: company.street_name ?? '',
        additionalNumber: company.additional_number ?? '',
        district: company.district ?? '',
        city: company.city ?? '',
        postalCode: company.postal_code ?? '',
        shortAddress: company.short_address ?? '',
      });
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [company]);

  const handleToggle = useCallback(async (next: boolean) => {
    setEnabled(next);
    const { error } = await supabase.from('zatca_company_config').upsert({
      company_id: company.id,
      is_enabled: next,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (error) {
      setEnabled(!next);
      toast(error.message, 'error');
    }
  }, [company.id, toast]);

  const validate = useCallback((): boolean => {
    const next: FieldErrors = {};
    const required = connected ? REQUIRED_FIELDS : [...REQUIRED_FIELDS, 'zatcaOtp' as keyof Fields];
    required.forEach((key) => {
      if (!fields[key].trim()) next[key] = t('settings.zatcaRequiredField');
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [connected, fields, t]);

  /** Persist every field to Supabase (config table + company record). */
  const persist = useCallback(async () => {
    const { error: cfgError } = await supabase.from('zatca_company_config').upsert({
      company_id: company.id,
      is_enabled: true,
      common_name: fields.commonName.trim() || null,
      branch_name: fields.branchName.trim() || null,
      vat_number: fields.vatNumber.trim() || null,
      cr_number: fields.crNumber.trim() || null,
      organization_name: fields.organizationName.trim() || null,
      seller_name: fields.organizationName.trim() || null,
      country_code: fields.countryCode.trim() || 'SA',
      business_category: fields.businessCategory.trim() || null,
      ...(fields.zatcaOtp.trim() ? { zatca_otp: fields.zatcaOtp.trim() } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' });
    if (cfgError) throw new Error(cfgError.message);

    const { error: companyError } = await supabase.from('companies').update({
      tax_number: fields.vatNumber.trim() || null,
      commercial_registration: fields.crNumber.trim() || null,
      address: fields.address.trim() || null,
      city: fields.city.trim() || null,
      district: fields.district.trim() || null,
      building_number: fields.buildingNumber.trim() || null,
      additional_number: fields.additionalNumber.trim() || null,
      postal_code: fields.postalCode.trim() || null,
      street_name: fields.streetName.trim() || null,
      short_address: fields.shortAddress.trim() || null,
    }).eq('id', company.id);
    if (companyError) throw new Error(companyError.message);
  }, [company.id, fields]);

  const handleSave = useCallback(async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await persist();
      await refresh();
      toast(t('settings.zatcaSaved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('settings.zatcaSaveError'), 'error');
    } finally {
      setSaving(false);
    }
  }, [validate, persist, refresh, toast, t]);

  const handleConnect = useCallback(async () => {
    if (!validate()) return;
    setConnecting(true);
    try {
      await persist();
      const { error } = await supabase.functions.invoke('zatca-otp-onboarding', {
        body: {
          company_id: company.id,
          vat_number: fields.vatNumber.trim(),
          cr_number: fields.crNumber.trim(),
          otp: fields.zatcaOtp.trim(),
        },
      });
      if (error) {
        if (typeof error.message === 'string' && error.message.toLowerCase().includes('not found')) {
          toast(t('settings.zatcaSaved'), 'success');
        } else {
          throw new Error(error.message);
        }
      } else {
        toast(t('settings.zatcaOnboardingStarted'), 'success');
      }
      await refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('settings.zatcaOnboardingError'), 'error');
    } finally {
      setConnecting(false);
    }
  }, [validate, persist, refresh, toast, t, company.id, fields.vatNumber, fields.crNumber, fields.zatcaOtp]);

  const busy = saving || connecting;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={22} className="animate-spin text-secondary-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Master toggle */}
      <Card>
        <CardBody className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                <Shield size={18} />
              </div>
              <div>
                <p className="text-sm font-bold text-secondary-800 dark:text-secondary-100">{t('settings.enableEInvoicing')}</p>
                <p className="mt-0.5 text-xs text-secondary-500 dark:text-secondary-400">{t('settings.enableEInvoicingHint')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                connected
                  ? 'bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-300'
                  : 'bg-secondary-100 text-secondary-500 dark:bg-secondary-800 dark:text-secondary-400'
              }`}>
                {connected ? <CheckCircle size={13} /> : <AlertCircle size={13} />}
                {connected ? t('settings.zatcaConnected') : t('settings.zatcaNotConnected')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => handleToggle(!enabled)}
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  enabled ? 'justify-end bg-primary-600' : 'justify-start bg-secondary-300 dark:bg-secondary-600'
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-white shadow-sm transition-transform" />
              </button>
            </div>
          </div>
        </CardBody>
      </Card>

      {!enabled ? (
        <div className="rounded-2xl border border-dashed border-secondary-300 dark:border-secondary-700 p-6 text-center text-sm text-secondary-500 dark:text-secondary-400">
          {t('settings.eInvoicingDisabledHint')}
        </div>
      ) : (
        <>
          {/* Section 1: E-Invoicing Settings */}
          <Card>
            <CardHeader>
              <CardTitle icon={<Shield size={18} />}>{t('settings.eInvoicingSettings')}</CardTitle>
            </CardHeader>
            <CardBody className="p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label={`${t('settings.commonName')} *`}
                  value={fields.commonName}
                  onChange={(e) => set('commonName', e.target.value)}
                  error={errors.commonName}
                  placeholder={t('settings.commonName')}
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.branchName')} *`}
                  value={fields.branchName}
                  onChange={(e) => set('branchName', e.target.value)}
                  error={errors.branchName}
                  placeholder={t('settings.branchName')}
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.vatNumber')} *`}
                  value={fields.vatNumber}
                  onChange={(e) => set('vatNumber', e.target.value.replace(/\D/g, '').slice(0, 15))}
                  error={errors.vatNumber}
                  placeholder="310179122200003"
                  maxLength={15}
                  inputMode="numeric"
                  disabled={busy}
                />
                <Input
                  label={t('settings.crNumber')}
                  value={fields.crNumber}
                  onChange={(e) => set('crNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="1010123456"
                  maxLength={10}
                  inputMode="numeric"
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.organizationName')} *`}
                  value={fields.organizationName}
                  onChange={(e) => set('organizationName', e.target.value)}
                  error={errors.organizationName}
                  placeholder={t('settings.organizationName')}
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.countryCode')} *`}
                  value={fields.countryCode}
                  onChange={(e) => set('countryCode', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2))}
                  error={errors.countryCode}
                  placeholder="SA"
                  maxLength={2}
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.address')} *`}
                  value={fields.address}
                  onChange={(e) => set('address', e.target.value)}
                  error={errors.address}
                  placeholder={t('settings.address')}
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.businessCategory')} *`}
                  value={fields.businessCategory}
                  onChange={(e) => set('businessCategory', e.target.value)}
                  error={errors.businessCategory}
                  placeholder={t('settings.businessCategory')}
                  disabled={busy}
                />
                <Input
                  label={`${t('settings.zatcaOtp')} *`}
                  value={fields.zatcaOtp}
                  onChange={(e) => set('zatcaOtp', e.target.value.replace(/\D/g, '').slice(0, 6))}
                  error={errors.zatcaOtp}
                  placeholder="123456"
                  maxLength={6}
                  inputMode="numeric"
                  disabled={busy}
                />
              </div>
            </CardBody>
          </Card>

          {/* Section 2: Address Details */}
          <Card>
            <CardHeader>
              <CardTitle icon={<Shield size={18} />}>{t('settings.addressDetails')}</CardTitle>
            </CardHeader>
            <CardBody className="p-5 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input
                  label={t('settings.buildingNo')}
                  value={fields.buildingNumber}
                  onChange={(e) => set('buildingNumber', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="1234"
                  maxLength={4}
                  inputMode="numeric"
                  disabled={busy}
                />
                <Input
                  label={t('settings.streetName')}
                  value={fields.streetName}
                  onChange={(e) => set('streetName', e.target.value)}
                  placeholder={t('settings.streetName')}
                  disabled={busy}
                />
                <Input
                  label={t('settings.additionalNo')}
                  value={fields.additionalNumber}
                  onChange={(e) => set('additionalNumber', e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="5678"
                  maxLength={4}
                  inputMode="numeric"
                  disabled={busy}
                />
                <Input
                  label={t('settings.district')}
                  value={fields.district}
                  onChange={(e) => set('district', e.target.value)}
                  placeholder={t('settings.district')}
                  disabled={busy}
                />
                <Input
                  label={t('settings.city')}
                  value={fields.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder={t('settings.city')}
                  disabled={busy}
                />
                <Input
                  label={t('settings.postalCode')}
                  value={fields.postalCode}
                  onChange={(e) => set('postalCode', e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="12211"
                  maxLength={5}
                  inputMode="numeric"
                  disabled={busy}
                />
                <Input
                  label={t('settings.shortAddress')}
                  value={fields.shortAddress}
                  onChange={(e) => set('shortAddress', e.target.value.toUpperCase().slice(0, 8))}
                  placeholder="DMAL2678"
                  maxLength={8}
                  disabled={busy}
                />
              </div>
            </CardBody>
          </Card>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} loading={saving} disabled={busy} variant="primary">
              <Save size={16} />
              {t('settings.saveEInvoicing')}
            </Button>
            {!connected && fields.zatcaOtp.trim().length > 0 && (
              <Button onClick={handleConnect} loading={connecting} disabled={busy} variant="secondary">
                <Link2 size={16} />
                {t('settings.zatcaConnect')}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
