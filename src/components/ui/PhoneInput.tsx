export interface CountryCode {
  code: string;
  dial: string;
  name: string;
  flag: string;
}

export const ALL_COUNTRIES: CountryCode[] = [
  { code: 'EG', dial: '+20', name: 'Egypt', flag: '🇪🇬' },
  { code: 'SA', dial: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'AE', dial: '+971', name: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'KW', dial: '+965', name: 'Kuwait', flag: '🇰🇼' },
  { code: 'QA', dial: '+974', name: 'Qatar', flag: '🇶🇦' },
  { code: 'BH', dial: '+973', name: 'Bahrain', flag: '🇧🇭' },
  { code: 'OM', dial: '+968', name: 'Oman', flag: '🇴🇲' },
  { code: 'JO', dial: '+962', name: 'Jordan', flag: '🇯🇴' },
  { code: 'IQ', dial: '+964', name: 'Iraq', flag: '🇮🇶' },
  { code: 'LB', dial: '+961', name: 'Lebanon', flag: '🇱🇧' },
  { code: 'SY', dial: '+963', name: 'Syria', flag: '🇸🇾' },
  { code: 'YE', dial: '+967', name: 'Yemen', flag: '🇾🇪' },
  { code: 'PS', dial: '+970', name: 'Palestine', flag: '🇵🇸' },
  { code: 'LY', dial: '+218', name: 'Libya', flag: '🇱🇾' },
  { code: 'SD', dial: '+249', name: 'Sudan', flag: '🇸🇩' },
  { code: 'TN', dial: '+216', name: 'Tunisia', flag: '🇹🇳' },
  { code: 'MA', dial: '+212', name: 'Morocco', flag: '🇲🇦' },
  { code: 'DZ', dial: '+213', name: 'Algeria', flag: '🇩🇿' },
  { code: 'US', dial: '+1', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', dial: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: 'GB', dial: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'FR', dial: '+33', name: 'France', flag: '🇫🇷' },
  { code: 'DE', dial: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: 'IT', dial: '+39', name: 'Italy', flag: '🇮🇹' },
  { code: 'ES', dial: '+34', name: 'Spain', flag: '🇪🇸' },
  { code: 'NL', dial: '+31', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'BE', dial: '+32', name: 'Belgium', flag: '🇧🇪' },
  { code: 'CH', dial: '+41', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'SE', dial: '+46', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', dial: '+47', name: 'Norway', flag: '🇳🇴' },
  { code: 'DK', dial: '+45', name: 'Denmark', flag: '🇩🇰' },
  { code: 'FI', dial: '+358', name: 'Finland', flag: '🇫🇮' },
  { code: 'PL', dial: '+48', name: 'Poland', flag: '🇵🇱' },
  { code: 'PT', dial: '+351', name: 'Portugal', flag: '🇵🇹' },
  { code: 'GR', dial: '+30', name: 'Greece', flag: '🇬🇷' },
  { code: 'TR', dial: '+90', name: 'Turkey', flag: '🇹🇷' },
  { code: 'RU', dial: '+7', name: 'Russia', flag: '🇷🇺' },
  { code: 'UA', dial: '+380', name: 'Ukraine', flag: '🇺🇦' },
  { code: 'IN', dial: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'PK', dial: '+92', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', dial: '+880', name: 'Bangladesh', flag: '🇧🇩' },
  { code: 'CN', dial: '+86', name: 'China', flag: '🇨🇳' },
  { code: 'JP', dial: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: 'KR', dial: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: 'HK', dial: '+852', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'SG', dial: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: 'MY', dial: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'ID', dial: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'TH', dial: '+66', name: 'Thailand', flag: '🇹🇭' },
  { code: 'PH', dial: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: 'VN', dial: '+84', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'AU', dial: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: 'NZ', dial: '+64', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'MX', dial: '+52', name: 'Mexico', flag: '🇲🇽' },
  { code: 'BR', dial: '+55', name: 'Brazil', flag: '🇧🇷' },
  { code: 'AR', dial: '+54', name: 'Argentina', flag: '🇦🇷' },
  { code: 'CL', dial: '+56', name: 'Chile', flag: '🇨🇱' },
  { code: 'CO', dial: '+57', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', dial: '+51', name: 'Peru', flag: '🇵🇪' },
  { code: 'VE', dial: '+58', name: 'Venezuela', flag: '🇻🇪' },
  { code: 'ZA', dial: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: 'NG', dial: '+234', name: 'Nigeria', flag: '🇳🇬' },
  { code: 'KE', dial: '+254', name: 'Kenya', flag: '🇰🇪' },
  { code: 'GH', dial: '+233', name: 'Ghana', flag: '🇬🇭' },
  { code: 'ET', dial: '+251', name: 'Ethiopia', flag: '🇪🇹' },
  { code: 'TZ', dial: '+255', name: 'Tanzania', flag: '🇹🇿' },
  { code: 'UG', dial: '+256', name: 'Uganda', flag: '🇺🇬' },
  { code: 'CM', dial: '+237', name: 'Cameroon', flag: '🇨🇲' },
  { code: 'CI', dial: '+225', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'SN', dial: '+221', name: 'Senegal', flag: '🇸🇳' },
  { code: 'ZM', dial: '+260', name: 'Zambia', flag: '🇿🇲' },
  { code: 'ZW', dial: '+263', name: 'Zimbabwe', flag: '🇿🇼' },
  { code: 'RW', dial: '+250', name: 'Rwanda', flag: '🇷🇼' },
  { code: 'AE2', dial: '+971', name: 'Other / Manual', flag: '🌍' },
];

export function buildE164(dial: string, local: string): string {
  return `${dial}${local.replace(/\D/g, '')}`;
}

export function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

interface PhoneInputProps {
  label?: string;
  value: string;
  onChange: (fullE164: string, localDigits: string, country: CountryCode) => void;
  onCountryChange?: (country: CountryCode) => void;
  country: CountryCode;
  placeholder?: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function PhoneInput({
  label,
  value,
  onChange,
  onCountryChange,
  country,
  placeholder = '50 123 4567',
  error,
  required,
  className = '',
}: PhoneInputProps) {
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-danger-500 ms-0.5">*</span>}
        </label>
      )}
      <div className="flex gap-2 items-start">
        <select
          value={country.code}
          onChange={(e) => {
            const c = ALL_COUNTRIES.find((c) => c.code === e.target.value);
            if (c) {
              onCountryChange?.(c);
              onChange(buildE164(c.dial, value), value, c);
            }
          }}
          className="input appearance-none cursor-pointer pe-6 shrink-0 text-sm"
          style={{ width: '4.5rem', minWidth: '4.5rem' }}
        >
          {ALL_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.dial}
            </option>
          ))}
        </select>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(e) => {
            const local = e.target.value;
            onChange(buildE164(country.dial, local), local, country);
          }}
          placeholder={placeholder}
          required={required}
          className={`input flex-1 min-w-0 ${error ? 'input-error' : ''}`}
        />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-danger-500">{error}</p>}
    </div>
  );
}
