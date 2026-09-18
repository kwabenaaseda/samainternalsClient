/**
 * Input Components
 * Reusable form input components
 */
import React, { InputHTMLAttributes, SelectHTMLAttributes, forwardRef } from 'react';

/**
 * Label component
 */
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export const FormLabel = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, className = '', children, ...props }, ref) => (
    <label ref={ref} className={`label ${className}`} {...props}>
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  )
);

FormLabel.displayName = 'FormLabel';

/**
 * Input component
 */
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormInput = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1">
        {label && (
          <FormLabel htmlFor={inputId}>{label}</FormLabel>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`input ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';

/**
 * Select component
 */
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  hint?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, hint, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1">
        {label && (
          <FormLabel htmlFor={inputId}>{label}</FormLabel>
        )}
        <select
          ref={ref}
          id={inputId}
          className={`select ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : ''} ${className}`}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
    );
  }
);

FormSelect.displayName = 'FormSelect';

/**
 * Textarea component
 */
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1">
        {label && (
          <FormLabel htmlFor={inputId}>{label}</FormLabel>
        )}
        <textarea
          ref={ref}
          id={inputId}
          className={`input min-h-[100px] resize-y ${error ? 'border-red-500' : ''} ${className}`}
          {...props}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {hint && !error && <p className="text-sm text-gray-500">{hint}</p>}
      </div>
    );
  }
);

FormTextarea.displayName = 'FormTextarea';

/**
 * Currency Input component
 * Specialized input for monetary values
 */
interface CurrencyInputProps extends Omit<InputProps, 'type' | 'value' | 'onChange'> {
  value?: number | string;
  onChange?: (value: number) => void;
  currency?: string;
}

export function CurrencyInput({
  value,
  onChange,
  currency = 'GHS',
  className = '',
  ...props
}: CurrencyInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/[^0-9.]/g, '');
    const numValue = parseFloat(rawValue) || 0;
    onChange?.(numValue);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
        {currency}
      </span>
      <FormInput
        type="text"
        inputMode="decimal"
        value={value ?? ''}
        onChange={handleChange}
        className={`pl-7 ${className}`}
        {...props}
      />
    </div>
  );
}
