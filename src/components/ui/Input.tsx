import { useId, type InputHTMLAttributes } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  required?: boolean;
}

export function Input({ label, error, required, id, className, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-soft">
        {label}
        {required && <span className="ms-1 text-secondary">*</span>}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={clsx(
          "h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition",
          "placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/20",
          error ? "border-danger" : "border-line",
          className
        )}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
