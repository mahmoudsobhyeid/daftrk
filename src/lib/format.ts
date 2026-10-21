import { useLanguage } from '../contexts/LanguageContext';
import { currencySymbols } from '../lib/i18n';

export function formatCurrency(amount: number, currency: string = 'USD', lang: string = 'en'): string {
  const symbol = currencySymbols[currency] ?? currency;
  const formatted = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return lang === 'ar' ? `${formatted} ${symbol}` : `${symbol}${formatted}`;
}

export function useCurrency() {
  const { lang } = useLanguage();
  return (amount: number, currency: string = 'USD') => formatCurrency(amount, currency, lang);
}

export function formatDate(dateStr: string, lang: string = 'en'): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

export function useFormatDate() {
  const { lang } = useLanguage();
  return (dateStr: string) => formatDate(dateStr, lang);
}
