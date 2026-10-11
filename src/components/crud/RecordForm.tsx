import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import clsx from "clsx";
import { ChevronDown, ChevronUp, GripVertical, Plus } from "lucide-react";
import { SearchSelect } from "@/components/ui/SearchSelect";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ImageField, MultiCheck, SelectField, TextArea, Toggle, type Option } from "@/components/ui/Fields";
import { PermissionPicker } from "@/components/ui/PermissionPicker";
import { RemoteSelect } from "@/components/ui/RemoteSelect";
import { usePermissions } from "@/features/auth/hooks";
import { ApiError } from "@/lib/http/errors";
import { containsFile, toFormData } from "@/lib/form-data";
import { buildPayload, defaultValues, rangeErrors, requiredErrors, serverErrors } from "./payload";
import { groupFields } from "./groups";
import { LocationField } from "./LocationField";
import { isRemoteSource, type CrudModule, type FieldDef, type OptionSource, type RemoteSource, type RowColumn, type Values } from "./types";

type RecordLike = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value : "");

/** رسالة الحقل: رمز `required` يُترجم، وأي نص آخر يأتي من الخادم كما هو. */
const useErrorText = () => {
  const { t } = useTranslation();
  return (code: string | undefined) => (code === "required" ? t("crud.required") : code ?? null);
};

const isWide = (field: FieldDef) =>
  field.kind === "textarea" ||
  field.kind === "bilingual" ||
  field.kind === "multiselect" ||
  field.kind === "permissions" ||
  field.kind === "image" ||
  field.kind === "rows" ||
  field.kind === "location" ||
  field.kind === "custom" ||
  field.kind === "switch";

/** خيارات ثابتة أو مجلوبة من الخادم، بصيغة واحدة للحقلين المنسدل والمتعدد. */
function useOptions(source: Option[] | OptionSource) {
  const remote = useQuery({
    queryKey: ["options", Array.isArray(source) ? "static" : source.cacheKey],
    queryFn: ({ signal }) => (source as OptionSource).load(signal),
    enabled: !Array.isArray(source),
    staleTime: 60_000,
  });
  return Array.isArray(source) ? source : (remote.data ?? []);
}

function SelectSource({
  label,
  required,
  source,
  placeholder,
  searchable,
  fallbackLabel,
  value,
  onChange,
  error,
}: {
  label: string;
  required?: boolean;
  source: Option[] | OptionSource | RemoteSource;
  placeholder?: string;
  searchable?: boolean;
  fallbackLabel?: string;
  value: string | number | null;
  onChange: (value: string | number | null, label: string) => void;
  error?: string;
}) {
  const options = useOptions(isRemoteSource(source) ? [] : source);
  const { t } = useTranslation();

  if (isRemoteSource(source)) {
    return (
      <RemoteSelect
        label={label}
        required={required}
        source={source}
        value={value}
        fallbackLabel={fallbackLabel}
        placeholder={placeholder ?? t("crud.choose")}
        onChange={onChange}
        error={error}
      />
    );
  }

  if (searchable) {
    return (
      <SearchSelect
        label={label}
        required={required}
        options={options}
        value={value}
        fallbackLabel={fallbackLabel}
        placeholder={placeholder ?? t("crud.choose")}
        onChange={onChange}
        error={error}
      />
    );
  }

  return (
    <SelectField
      label={label}
      required={required}
      options={options}
      value={value}
      placeholder={placeholder ?? t("crud.choose")}
      onChange={(next) => onChange(next, options.find((o) => o.value === next)?.label ?? "")}
      error={error}
    />
  );
}

/**
 * الصفوف المتكررة: كل صف بأعمدته، ويُضاف ويُحذف بأزرار واضحة. يُستعمل لسطور
 * الأصناف داخل القائمة ولصور المعرض.
 */
function RowsField({
  label,
  columns,
  newRow,
  rows,
  sortable,
  onChange,
  error,
}: {
  label: string;
  columns: RowColumn[];
  newRow: RecordLike;
  rows: RecordLike[];
  sortable?: boolean;
  onChange: (rows: RecordLike[]) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const setCell = (index: number, key: string, cell: unknown) =>
    onChange(rows.map((row, position) => (position === index ? { ...row, [key]: cell } : row)));

  /** نقل صف من موضع إلى آخر؛ يُستعمل للسحب والإفلات ولأزرار الأسهم معاً. */
  const moveRow = (from: number, to: number) => {
    if (from === to || to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  return (
    <fieldset className="space-y-3">
      {/* الإضافة في الرأس: لا حاجة للنزول إلى آخر القائمة (92 صفاً مثلاً) لإضافة صف واحد. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <legend className="text-sm font-medium text-ink-soft">
          {label}
          <span className="ms-2 text-xs text-muted">({t("crud.rowsCount", { count: rows.length })})</span>
        </legend>
        <Button variant="secondary" size="sm" onClick={() => onChange([{ ...newRow }, ...rows])}>
          <Plus className="size-4" aria-hidden /> {t("crud.addRow")}
        </Button>
      </div>
      {sortable && rows.length > 1 && (
        <p className="text-xs text-muted">{t("crud.dragHint")}</p>
      )}

      {rows.map((row, index) => (
        <div
          key={index}
          onDragOver={(event) => {
            if (sortable && dragFrom !== null) event.preventDefault();
          }}
          onDrop={(event) => {
            if (!sortable || dragFrom === null) return;
            event.preventDefault();
            moveRow(dragFrom, index);
            setDragFrom(null);
          }}
          className={clsx(
            "flex items-end gap-2 rounded-xl border border-line bg-canvas/60 p-3 transition",
            dragFrom === index && "opacity-50",
            dragFrom !== null && dragFrom !== index && "ring-2 ring-primary/30"
          )}
        >
          {sortable && (
            <div className="flex shrink-0 flex-col items-center gap-0.5 self-center">
              <button
                type="button"
                draggable
                aria-label={t("crud.dragToReorder")}
                title={t("crud.dragToReorder")}
                onDragStart={(event) => {
                  setDragFrom(index);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", String(index));
                }}
                onDragEnd={() => setDragFrom(null)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowUp") moveRow(index, index - 1);
                  if (event.key === "ArrowDown") moveRow(index, index + 1);
                }}
                className="grid h-9 w-7 cursor-grab place-items-center rounded-md text-muted hover:bg-surface hover:text-ink active:cursor-grabbing"
              >
                <GripVertical className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("crud.moveUp")}
                disabled={index === 0}
                onClick={() => moveRow(index, index - 1)}
                className="grid size-6 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronUp className="size-3.5" aria-hidden />
              </button>
              <button
                type="button"
                aria-label={t("crud.moveDown")}
                disabled={index === rows.length - 1}
                onClick={() => moveRow(index, index + 1)}
                className="grid size-6 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface hover:text-ink disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
            </div>
          )}

          <div className="grid min-w-0 flex-1 items-end gap-3 sm:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
          {columns.map((column) => {
            if (column.kind === "select") {
              return (
                <SelectSource
                  key={column.key}
                  label={column.label}
                  required={column.required}
                  source={column.options}
                  searchable={column.searchable}
                  fallbackLabel={str(row[`${column.key}__label`])}
                  value={(row[column.key] as string | number | null) ?? null}
                  onChange={(cell, cellLabel) => {
                    onChange(
                      rows.map((item, position) =>
                        position === index
                          ? { ...item, [column.key]: cell, [`${column.key}__label`]: cellLabel }
                          : item
                      )
                    );
                  }}
                />
              );
            }
            if (column.kind === "image") {
              const file = row[column.key] instanceof File ? (row[column.key] as File) : null;
              const currentUrl = typeof row.url === "string" ? row.url : null;
              return (
                <ImageField
                  key={column.key}
                  label={column.label}
                  currentUrl={currentUrl}
                  file={file}
                  onChange={(next) => setCell(index, column.key, next)}
                  ratio={column.ratio}
                />
              );
            }
            return (
              <Input
                key={column.key}
                label={column.label}
                required={column.required}
                type={column.kind === "number" ? "number" : "text"}
                step={column.kind === "number" ? "any" : undefined}
                value={String(row[column.key] ?? "")}
                onChange={(event) => setCell(index, column.key, event.target.value)}
              />
            );
          })}
          </div>
          <button
            type="button"
            aria-label={t("crud.removeRow")}
            onClick={() => onChange(rows.filter((_, position) => position !== index))}
            className="h-11 cursor-pointer self-end rounded-xl px-3 text-sm text-secondary hover:bg-secondary-soft"
          >
            {t("crud.removeRow")}
          </button>
        </div>
      ))}

      {error && <p className="text-xs text-danger">{error}</p>}
    </fieldset>
  );
}

function MultiSource({
  field,
  value,
  onChange,
  error,
}: {
  field: Extract<FieldDef, { kind: "multiselect" }>;
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  error?: string;
}) {
  const options = useOptions(field.options);
  return <MultiCheck label={field.label} options={options} value={value} onChange={onChange} error={error} />;
}

/** حقل الصلاحيات: يُجمَع في مجالات قابلة للطي، مع بحث وتحديد لكل مجال. */
function PermissionSource({
  field,
  value,
  onChange,
  error,
}: {
  field: Extract<FieldDef, { kind: "permissions" }>;
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  error?: string;
}) {
  const options = useOptions(field.options);
  return <PermissionPicker label={field.label} options={options} value={value} onChange={onChange} error={error} />;
}

/** الحقل ثنائي اللغة: الإنجليزي والعربي جنباً إلى جنب، والعربي يتبع اتجاه الكتابة له. */
function BilingualInputs({
  field,
  values,
  set,
  error,
}: {
  field: Extract<FieldDef, { kind: "bilingual" }>;
  values: Values;
  set: (key: string, value: unknown) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const english = String(values[field.key] ?? "");
  const arabic = String(values[`${field.key}_ar`] ?? "");

  const common = {
    error,
    required: field.required,
  };

  if (field.multiline) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea
          label={`${field.label} · ${t("crud.english")}`}
          dir="ltr"
          value={english}
          onChange={(event) => set(field.key, event.target.value)}
          {...common}
        />
        <TextArea
          label={`${field.label} · ${t("crud.arabic")}`}
          dir="rtl"
          value={arabic}
          onChange={(event) => set(`${field.key}_ar`, event.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input
        label={`${field.label} · ${t("crud.english")}`}
        dir="ltr"
        value={english}
        onChange={(event) => set(field.key, event.target.value)}
        {...common}
      />
      <Input
        label={`${field.label} · ${t("crud.arabic")}`}
        dir="rtl"
        value={arabic}
        onChange={(event) => set(`${field.key}_ar`, event.target.value)}
      />
    </div>
  );
}

/**
 * نموذج إنشاء أو تعديل لأي وحدة. الحقول تُبنى من تعريف الوحدة، والإرسال يتبع
 * ما تتوقعه: `FormData` للملفات أو للوحدات المشروطة، وJSON لما عدا ذلك.
 */
export function RecordForm<T extends { id: number | string }>({
  module,
  record,
  onDone,
}: {
  module: CrudModule<T>;
  record: T | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const errorText = useErrorText();
  const permissions = usePermissions();
  const mode = record ? "update" : "create";
  // الحقل المحمي بصلاحية لا يظهر لمن لا يملكها، ولا تُرسل قيمته فلا تُعدَّل.
  const fields = module.fields.filter(
    (field) =>
      !field.readOnly &&
      (mode === "create" ? !field.editOnly : !field.createOnly) &&
      (!field.requires || permissions.has(field.requires))
  );

  const [values, setValues] = useState<Values>(() => {
    if (!record) return defaultValues(module.fields, null);
    return module.toValues
      ? module.toValues(record)
      : defaultValues(module.fields, record as unknown as RecordLike);
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown> | FormData) =>
      record ? module.api.update!(record.id, payload) : module.api.create!(payload),
    onSuccess: async () => {
      toast.success(t(mode === "create" ? "crud.created" : "crud.updated"));
      // الحقول المنسدلة تقرأ قوائمها من ذاكرة مؤقتة، فيجب تحديثها مع الحفظ حتى يظهر السجل الجديد فوراً.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [module.id] }),
        queryClient.invalidateQueries({ queryKey: ["options"] }),
      ]);
      onDone();
    },
    onError: (error) => {
      if (error instanceof ApiError) {
        const mapped = serverErrors(fields, error.fieldErrors);
        setErrors(mapped);
        // رسالة عامة فقط إن لم تُربط أي رسالة بحقل. الخادم يرسل عادةً «البيانات غير صحيحة» دون تفاصيل،
        // فنعرض أول خطأ تفصيلي يرسله بدلاً منها.
        const detail = Object.values(error.fieldErrors).flat()[0];
        setFormError(Object.keys(mapped).length === 0 ? (detail ?? error.message) : null);
      }
    },
  });

  const set = (key: string, value: unknown) => setValues((current) => ({ ...current, [key]: value }));
  const setMany = (patch: Values) => setValues((current) => ({ ...current, ...patch }));

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const missing = {
      ...requiredErrors(fields, values, mode),
      ...rangeErrors(fields, values, (key, options) => String(t(key, options))),
    };
    if (Object.keys(missing).length > 0) {
      setErrors(missing);
      return;
    }

    setErrors({});
    setFormError(null);
    const built = buildPayload(fields, values, mode);
    const payload = module.toPayload ? module.toPayload(built) : built;
    save.mutate(module.multipart || containsFile(payload) ? toFormData(payload) : payload);
  }

  function renderField(field: FieldDef) {
    const error = errorText(errors[field.key]) ?? undefined;

    switch (field.kind) {
      case "text":
      case "email":
      case "phone":
      case "number":
      case "password": {
        const type = field.kind === "phone" ? "tel" : field.kind;
        const placeholder =
          field.kind === "password" && record ? t("crud.keepPassword") : undefined;
        return (
          <Input
            label={field.label}
            required={field.required}
            type={type}
            dir={field.ltr || field.kind === "email" || field.kind === "phone" ? "ltr" : undefined}
            step={field.kind === "number" ? "any" : undefined}
            autoComplete={field.kind === "password" ? "new-password" : "off"}
            placeholder={placeholder}
            value={String(values[field.key] ?? "")}
            onChange={(event) => set(field.key, event.target.value)}
            error={error}
          />
        );
      }
      case "textarea":
        return (
          <TextArea
            label={field.label}
            required={field.required}
            value={String(values[field.key] ?? "")}
            onChange={(event) => set(field.key, event.target.value)}
            error={error}
          />
        );
      case "bilingual":
        return (
          <BilingualInputs
            field={field}
            values={values}
            set={set}
            error={error}
          />
        );
      case "select":
        return (
          <SelectSource
            label={field.label}
            required={field.required}
            source={field.options}
            placeholder={field.placeholder}
            searchable={field.searchable}
            value={(values[field.key] as string | number | null) ?? null}
            onChange={(value) => set(field.key, value)}
            error={error}
          />
        );
      case "permissions":
        return (
          <PermissionSource
            field={field}
            value={(values[field.key] as (string | number)[]) ?? []}
            onChange={(value) => set(field.key, value)}
            error={error}
          />
        );
      case "multiselect":
        return (
          <MultiSource
            field={field}
            value={(values[field.key] as (string | number)[]) ?? []}
            onChange={(value) => set(field.key, value)}
            error={error}
          />
        );
      case "location":
        return (
          <LocationField
            label={field.label}
            lat={(values[field.key] as number | null) ?? null}
            lng={(values[field.lngKey] as number | null) ?? null}
            radius={field.radiusKey ? Number(values[field.radiusKey]) || null : null}
            onChange={(point) =>
              setMany({ [field.key]: point?.lat ?? null, [field.lngKey]: point?.lng ?? null })
            }
            onRadiusChange={(km) => {
              if (field.radiusKey) set(field.radiusKey, km);
            }}
            error={error}
          />
        );
      case "rows":
        return (
          <RowsField
            label={field.label}
            columns={field.columns}
            newRow={field.newRow}
            sortable={field.sortable}
            rows={(values[field.key] as RecordLike[]) ?? []}
            onChange={(rows) => set(field.key, rows)}
            error={error}
          />
        );
      case "switch":
        return (
          <Toggle
            label={field.label}
            hint={field.hint}
            checked={Boolean(values[field.key])}
            onChange={(checked) => set(field.key, checked)}
          />
        );
      case "custom": {
        const Block = field.component;
        return <Block values={values} />;
      }
      case "image": {
        const raw = (record as RecordLike | null)?.[field.key];
        const currentUrl =
          typeof raw === "string" ? raw : (raw as { url?: string } | null | undefined)?.url ?? null;
        const file = values[field.key] instanceof File ? (values[field.key] as File) : null;
        return (
          <ImageField
            label={field.label}
            currentUrl={currentUrl}
            file={file}
            onChange={(next) => set(field.key, next)}
            error={error}
            ratio={field.ratio}
          />
        );
      }
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {formError && (
        <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
          {formError}
        </p>
      )}

      {groupFields(fields).map((group, index) => (
        <section
          key={`${group.title ?? "general"}-${index}`}
          className={group.title ? "space-y-4 rounded-2xl border border-line bg-canvas/40 p-5" : undefined}
        >
          {group.title && <h3 className="text-sm font-semibold text-ink">{group.title}</h3>}
          <div className="grid gap-5 sm:grid-cols-2">
            {group.fields.map((field) => (
              <div key={field.key} className={isWide(field) ? "sm:col-span-2" : undefined}>
                {renderField(field)}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="sticky bottom-0 z-20 -mx-6 -mb-5 flex flex-wrap justify-end gap-2 border-t border-line bg-surface/95 px-6 py-4 backdrop-blur">
        <Button variant="secondary" onClick={onDone} disabled={save.isPending}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={save.isPending} className="bg-primary text-ink hover:bg-primary/90">
          {save.isPending ? t("crud.saving") : t("crud.save")}
        </Button>
      </div>
    </form>
  );
}
