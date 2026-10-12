import { useId, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { Crop, ImagePlus, Trash2 } from "lucide-react";
import { ImageCropDialog } from "@/components/crop/ImageCropDialog";
import { Select } from "./Select";

const CONTROL =
  "w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink outline-none transition placeholder:text-muted focus:border-primary focus:ring-4 focus:ring-primary/20";

function FieldShell({
  label,
  htmlFor,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  required?: boolean;
  children: React.ReactNode;
}) {
  const errorId = `${htmlFor}-error`;
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="flex items-center gap-1 text-sm font-medium text-ink-soft">
        {label}
        {required && <span className="text-secondary">*</span>}
      </label>
      {children}
      {error && (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  error,
  required,
  rows = 3,
  id,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string | null; required?: boolean }) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} required={required}>
      <textarea
        id={fieldId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={clsx(CONTROL, "min-h-24 py-3", error ? "border-danger" : "border-line")}
        {...props}
      />
    </FieldShell>
  );
}

export interface Option {
  value: string | number;
  label: string;
  /** صورة الخيار، إن وُجدت، تظهر في قوائم الاختيار المتعدد. */
  image?: string | null;
  /** المجموعة التي ينتمي إليها الخيار، كمجال الصلاحية، فتُعرض مجمّعة. */
  group?: string;
  /** نص ثانوي يُعرض تحت التسمية ويدخل في البحث، كاسم الصلاحية التقني. */
  hint?: string;
}

export function SelectField({
  label,
  error,
  required,
  options,
  placeholder,
  value,
  onChange,
  id,
  disabled,
}: {
  label: string;
  error?: string | null;
  required?: boolean;
  options: Option[];
  placeholder?: string;
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  id?: string;
  disabled?: boolean;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <FieldShell label={label} htmlFor={fieldId} error={error} required={required}>
      <Select
        id={fieldId}
        value={value ?? ""}
        disabled={disabled}
        error={!!error}
        wrapperClassName="w-full"
        className="w-full"
        onChange={(event) => {
          const raw = event.target.value;
          const match = options.find((option) => String(option.value) === raw);
          onChange(match ? match.value : null);
        }}
      >
        <option value="">{placeholder ?? ""}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

/** اختيار متعدد على شكل بطاقات قابلة للنقر، أوضح من القائمة المنسدلة المتعددة. */
export function MultiCheck({
  label,
  error,
  options,
  value,
  onChange,
}: {
  label: string;
  error?: string | null;
  options: Option[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
}) {
  const { t } = useTranslation();
  const toggle = (optionValue: string | number) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((entry) => entry !== optionValue)
        : [...value, optionValue]
    );
  };

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink-soft">
        {label}
        <span className="ms-2 text-xs text-muted">({t("crud.selectedCount", { count: value.length })})</span>
      </legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted">{t("common.noData")}</p>
      ) : (
        <div className="grid max-h-64 gap-2 overflow-y-auto rounded-xl border border-line p-2 sm:grid-cols-2">
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <label
                key={option.value}
                className={clsx(
                  "flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition",
                  checked ? "bg-primary-soft text-ink" : "hover:bg-canvas"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(option.value)}
                  className="size-4 accent-secondary"
                />
                <span className="truncate">{option.label}</span>
              </label>
            );
          })}
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

export function Toggle({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-primary relative before:absolute before:start-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-surface before:shadow before:transition checked:before:translate-x-5 rtl:checked:before:-translate-x-5"
      />
    </label>
  );
}

/**
 * حقل صورة: معاينة للصورة الحالية، واختيار ملف جديد، وإزالته. الملف المختار لا يدخل النموذج
 * إلا بعد قصّه في النافذة، فما يُرسل هو المنطقة التي أكدها المستخدم.
 */
export function ImageField({
  label,
  currentUrl,
  file,
  onChange,
  error,
  ratio = 1,
}: {
  label: string;
  currentUrl?: string | null;
  file: File | null;
  onChange: (file: File | null) => void;
  error?: string | null;
  /** نسبة القص الافتراضية: 1 مربع، و`null` كما هي. */
  ratio?: number | null;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [cropping, setCropping] = useState(false);
  const preview = file ? URL.createObjectURL(file) : currentUrl ?? null;

  const handle = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    // تفريغ الحقل يتيح اختيار الملف نفسه من جديد بعد الإلغاء.
    event.target.value = "";
    if (chosen) setPicked(chosen);
  };

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium text-ink-soft">{label}</p>
      <div className="flex items-center gap-4 rounded-xl border border-dashed border-line bg-canvas p-3">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface ring-1 ring-line">
          {preview ? (
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-muted" aria-hidden />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="h-9 cursor-pointer rounded-lg bg-surface px-3 text-sm font-medium ring-1 ring-line hover:ring-secondary"
          >
            {t("crud.chooseImage")}
          </button>
          {(file || currentUrl) && (
            <button
              type="button"
              onClick={() => setCropping(true)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-surface px-3 text-sm font-medium ring-1 ring-line hover:ring-secondary"
            >
              <Crop className="size-4" aria-hidden />
              {t("crud.cropImage")}
            </button>
          )}
          {file && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-sm text-secondary hover:bg-secondary-soft"
            >
              <Trash2 className="size-4" aria-hidden />
              {t("crud.removeImage")}
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/*" onChange={handle} className="hidden" />
        {cropping && (file || currentUrl) && (
          <ImageCropDialog
            file={file ?? undefined}
            url={file ? undefined : currentUrl ?? undefined}
            defaultRatio={ratio}
            onCancel={() => setCropping(false)}
            onConfirm={(cropped) => {
              onChange(cropped);
              setCropping(false);
            }}
          />
        )}
        {picked && (
          <ImageCropDialog
            file={picked}
            defaultRatio={ratio}
            onCancel={() => setPicked(null)}
            onConfirm={(cropped) => {
              onChange(cropped);
              setPicked(null);
            }}
          />
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
