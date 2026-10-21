import { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes, type ReactNode, useId } from 'react';
import { ChevronDown } from 'lucide-react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export function Input({ label, error, hint, icon, className = '', id: externalId, ...props }: InputProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {hint && <span className="label-hint ms-1">— {hint}</span>}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute top-1/2 -translate-y-1/2 start-3.5 text-secondary-400 pointer-events-none" aria-hidden="true">
            {icon}
          </span>
        )}
        <input
          id={id}
          className={`input ${error ? 'input-error' : ''} ${icon ? 'ps-10' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          {...props}
        />
      </div>
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger-500" role="alert">{error}</p>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, className = '', id: externalId, ...props }: TextareaProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {hint && <span className="label-hint ms-1">— {hint}</span>}
        </label>
      )}
      <textarea
        id={id}
        className={`input min-h-[88px] resize-y leading-relaxed ${error ? 'input-error' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs font-medium text-danger-500" role="alert">{error}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

export function Select({ label, error, hint, className = '', children, id: externalId, ...props }: SelectProps) {
  const generatedId = useId();
  const id = externalId ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={id} className="label">
          {label}
          {hint && <span className="label-hint ms-1">— {hint}</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          className={`input appearance-none cursor-pointer pe-10 ${error ? 'input-error' : ''} ${className}`}
          aria-invalid={error ? true : undefined}
          {...props}
        >
          {children}
        </select>
        <ChevronDown size={16} className="absolute top-1/2 -translate-y-1/2 end-3.5 text-secondary-400 pointer-events-none" aria-hidden="true" />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-danger-500" role="alert">{error}</p>}
    </div>
  );
}
