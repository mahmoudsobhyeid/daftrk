interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const sizes = {
  sm: { track: 'h-5 w-9', thumb: 'h-3.5 w-3.5', translate: 'translate-x-3.5' },
  md: { track: 'h-6 w-11', thumb: 'h-4.5 w-4.5', translate: 'translate-x-5' },
};

export function Switch({ checked, onChange, label, size = 'md', disabled = false }: SwitchProps) {
  const s = sizes[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 group"
    >
      <span
        className={`relative inline-flex items-center rounded-full transition-all duration-300 ease-out-expo ${
          checked
            ? 'bg-primary-600 shadow-primary'
            : 'bg-secondary-200 dark:bg-secondary-700'
        } ${s.track} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block transform rounded-full bg-white shadow-md transition-transform duration-300 ease-out-expo ${
            checked ? `translate-x-${size === 'sm' ? '3.5' : '5'}` : 'translate-x-0.5'
          } ${size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'}`}
          style={{
            transform: checked ? `translateX(${size === 'sm' ? '14px' : '20px'})` : 'translateX(2px)',
            height: size === 'sm' ? '14px' : '18px',
            width: size === 'sm' ? '14px' : '18px',
          }}
        />
      </span>
      {label && (
        <span className="text-sm font-medium text-secondary-700 dark:text-secondary-300 select-none">
          {label}
        </span>
      )}
    </button>
  );
}
