import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export interface AppInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function AppInput({ label, error, hint, id, className, ...props }: AppInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium text-neo-dark">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn(
          'min-h-11 rounded-neo-input border bg-neo-surface px-3 text-sm text-neo-dark placeholder:text-neo-muted',
          error ? 'border-red-600' : 'border-neo-border',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-neo-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
