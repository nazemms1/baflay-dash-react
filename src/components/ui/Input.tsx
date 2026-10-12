import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import clsx from "clsx";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  required?: boolean;
  /**
   * عنصر يُثبَّت داخل الحقل على يمينه، كزر إظهار كلمة المرور. الحقل LTR، فيمينه هو نهاية النص
   * في كل لغة، ويُزاح النص عنه بالحشو حتى لا يختفي تحت العنصر.
   */
  adornment?: ReactNode;
}

export function Input({ label, error, required, id, className, adornment, ...props }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const field = (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
      className={clsx(
        "h-11 w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition",
        "placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/20",
        error ? "border-danger" : "border-line",
        adornment && "pe-11",
        className
      )}
      {...props}
    />
  );

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink-soft">
        {label}
        {required && <span className="ms-1 text-secondary">*</span>}
      </label>
      {adornment ? (
        <div className="relative">
          {field}
          <div className="absolute inset-y-0 right-2 flex items-center">{adornment}</div>
        </div>
      ) : (
        field
      )}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
