/**
 * DateInput Component
 * Date picker input with calendar dropdown
 */
import { InputHTMLAttributes } from 'react';
import { FormInput } from './FormFields';

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  hint?: string;
}

export function DateInput({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}: DateInputProps) {
  return (
    <FormInput
      type="date"
      label={label}
      error={error}
      hint={hint}
      className={className}
      id={id}
      {...props}
    />
  );
}

export default DateInput;
