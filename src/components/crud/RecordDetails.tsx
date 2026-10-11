import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { currentLanguage, type Language } from "@/i18n";
import { LocationPicker } from "@/components/map/LocationPicker";
import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format";
import { localizedRecord, type RawBilingual } from "@/lib/localized";
import { groupFields } from "./groups";
import type { CrudModule, FieldDef, RowColumn } from "./types";

type RecordLike = Record<string, unknown>;

const str = (value: unknown) => (typeof value === "string" ? value : value == null ? "" : String(value));

/** الرابط من حقل صورة: نص مباشر أو كائن فيه `url`. */
const urlOf = (value: unknown): string | null => {
  if (typeof value === "string" && value) return value;
  const url = (value as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && url ? url : null;
};

/** اسم العلاقة من كائن متداخل، أو المعرّف إن لم يصل الكائن. */
function relationLabel(source: RecordLike, key: string, language: Language): string {
  const nested = source[key.replace(/_id$/, "")];
  if (nested && typeof nested === "object") {
    const label = localizedRecord(nested as RawBilingual, language);
    if (label) return label;
  }
  const raw = source[key];
  return raw === null || raw === undefined || raw === "" ? "—" : String(raw);
}

/** بطاقة واحدة لحقل: عنوان صغير ثم القيمة. */
function Tile({ label, wide, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={clsx("rounded-xl bg-canvas/70 p-4 ring-1 ring-line/60", wide && "sm:col-span-2")}>
      <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
      <div className="mt-2 text-sm leading-relaxed text-ink">{children}</div>
    </div>
  );
}

/** قسم بعنوان واضح يحمل مجموعة من البطاقات. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgba(63,62,60,0.04)]">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
        <span aria-hidden className="h-4 w-1 rounded-full bg-primary" />
        {title}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  );
}

/** قيمة الحقل ثنائي اللغة: كل لغة في سطر بوسمها، والعربي باتجاهه الصحيح. */
function Bilingual({ en, ar, multiline }: { en: string; ar: string; multiline?: boolean }) {
  const { t } = useTranslation();
  const body = clsx(multiline && "whitespace-pre-line");
  return (
    <div className="space-y-1.5">
      <p className="flex gap-2">
        <span className="shrink-0 rounded bg-surface px-1.5 text-[10px] font-semibold text-muted ring-1 ring-line">
          {t("crud.english")}
        </span>
        <span dir="ltr" className={clsx("min-w-0 break-words", body)}>{en || "—"}</span>
      </p>
      <p className="flex gap-2">
        <span className="shrink-0 rounded bg-surface px-1.5 text-[10px] font-semibold text-muted ring-1 ring-line">
          {t("crud.arabic")}
        </span>
        <span dir="rtl" className={clsx("min-w-0 break-words", body)}>{ar || "—"}</span>
      </p>
    </div>
  );
}

/** جدول الصفوف المتكررة كما تُدخَل: سطر لكل صف، وأعمدته من تعريف الحقل. */
function RowsTable({ columns, rows, language }: { columns: RowColumn[]; rows: RecordLike[]; language: Language }) {
  const { t } = useTranslation();
  if (rows.length === 0) return <span className="text-muted">{t("common.noData")}</span>;

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-line">
      <table className="w-full min-w-[320px] text-sm">
        <thead className="bg-secondary text-xs font-semibold text-surface">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2.5 text-start font-medium">{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-t border-line">
              {columns.map((column) => {
                if (column.kind === "image") {
                  const url = urlOf(row.url) ?? urlOf(row[column.key]);
                  return (
                    <td key={column.key} className="px-3 py-2.5">
                      {url ? (
                        <img src={url} alt="" className="size-12 rounded-lg object-cover ring-1 ring-line" />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  );
                }
                if (column.kind === "select") {
                  const name = column.self ? localizedRecord(row as RawBilingual, language) : "";
                  return (
                    <td key={column.key} className="px-3 py-2.5">{name || relationLabel(row, column.key, language)}</td>
                  );
                }
                const value = row[column.key];
                return (
                  <td key={column.key} className="px-3 py-2.5 tabular-nums">
                    {value === null || value === undefined || value === "" ? "—" : str(value)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** قيمة حقل واحد داخل بطاقته، بحسب نوعه. */
function FieldValue({
  field,
  record,
  language,
}: {
  field: FieldDef;
  record: RecordLike;
  language: Language;
}): ReactNode {
  const { t } = useTranslation();
  const raw = record[field.key];

  switch (field.kind) {
    case "bilingual":
      return (
        <Bilingual
          en={str(record[field.key])}
          ar={str(record[`${field.key}_ar`])}
          multiline={field.multiline}
        />
      );
    case "switch":
      return <Badge tone={raw ? "ok" : "neutral"}>{raw ? t("common.yes") : t("common.no")}</Badge>;
    case "email":
      return str(raw) ? (
        <a href={`mailto:${str(raw)}`} dir="ltr" className="text-secondary underline-offset-4 hover:underline">
          {str(raw)}
        </a>
      ) : (
        <span className="text-muted">—</span>
      );
    case "phone":
      return str(raw) ? (
        <a href={`tel:${str(raw)}`} dir="ltr" className="tabular-nums text-secondary underline-offset-4 hover:underline">
          {str(raw)}
        </a>
      ) : (
        <span className="text-muted">—</span>
      );
    case "number":
      return raw === null || raw === undefined || raw === "" ? (
        <span className="text-muted">—</span>
      ) : (
        <span className="text-base font-semibold tabular-nums">
          {formatNumber(Number(raw), { maximumFractionDigits: 2 })}
        </span>
      );
    case "textarea":
      return str(raw) ? <p className="whitespace-pre-line">{str(raw)}</p> : <span className="text-muted">—</span>;
    case "select":
      return <span>{relationLabel(record, field.key, language)}</span>;
    case "multiselect": {
      const list = Array.isArray(raw) ? (raw as unknown[]) : [];
      if (list.length === 0) return <span className="text-muted">—</span>;
      return (
        <ul className="flex flex-wrap gap-1.5">
          {list.map((entry, index) => {
            const label =
              entry && typeof entry === "object"
                ? str((entry as RecordLike).label ?? (entry as RecordLike).name ?? (entry as RecordLike).id)
                : str(entry);
            return (
              <li key={index} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-medium text-ink ring-1 ring-primary/30">
                {label}
              </li>
            );
          })}
        </ul>
      );
    }
    default:
      return str(raw) ? <span className="break-words">{str(raw)}</span> : <span className="text-muted">—</span>;
  }
}

/**
 * عرض التفاصيل: بطاقة رأس بالصورة والاسم، ثم أقسام منظمة بحقولها. الموقع
 * يظهر على خريطة للقراءة، والصفوف تظهر في جداول.
 */
export function RecordDetails<T extends { id: number | string }>({
  module,
  record,
}: {
  module: CrudModule<T>;
  record: T;
}) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const source = record as unknown as RecordLike;
  const visible = module.fields.filter((field) => field.kind !== "password");
  const groups = groupFields(visible);

  const imageField = module.fields.find((field) => field.kind === "image");
  const heroUrl = imageField ? urlOf(source[imageField.key]) : null;
  const title = module.nameOf ? module.nameOf(record, language) : `#${record.id}`;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center gap-5 rounded-2xl bg-night p-5 text-surface">
        {heroUrl ? (
          <img src={heroUrl} alt="" className="size-20 rounded-2xl object-cover ring-2 ring-primary/60" />
        ) : (
          <span className="grid size-20 place-items-center rounded-2xl bg-night-soft text-2xl font-bold text-primary">
            {title.trim().charAt(0).toUpperCase() || "#"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xl font-bold">{title}</p>
          <p className="mt-1 text-sm text-surface/60 tabular-nums">#{record.id}</p>
        </div>
      </header>

      {groups.map((group, index) => (
        <Section key={`${group.title ?? "general"}-${index}`} title={group.title ?? t("crud.group.general")}>
          {group.fields.map((field) => {
            if (field.kind === "location") {
              const lat = typeof source[field.key] === "number" ? (source[field.key] as number) : null;
              const lng = typeof source[field.lngKey] === "number" ? (source[field.lngKey] as number) : null;
              const radius = field.radiusKey ? Number(source[field.radiusKey]) || null : null;
              return (
                <Tile key={field.key} label={field.label} wide>
                  {lat !== null && lng !== null ? (
                    <div className="space-y-3">
                      <LocationPicker lat={lat} lng={lng} radiusKm={radius} readOnly height="16rem" />
                      <div className="flex flex-wrap gap-4 text-xs text-muted tabular-nums" dir="ltr">
                        <span>{lat.toFixed(6)}, {lng.toFixed(6)}</span>
                        {radius !== null && (
                          <span>{t("crud.location.radius")}: {formatNumber(radius, { maximumFractionDigits: 1 })} {t("crud.location.km")}</span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted">{t("crud.location.notSet")}</span>
                  )}
                </Tile>
              );
            }

            if (field.kind === "rows") {
              const rows = Array.isArray(source[field.key]) ? (source[field.key] as RecordLike[]) : [];
              return (
                <Tile key={field.key} label={field.label} wide>
                  <RowsTable columns={field.columns} rows={rows} language={language} />
                </Tile>
              );
            }

            if (field.kind === "image") {
              const url = urlOf(source[field.key]);
              return (
                <Tile key={field.key} label={field.label}>
                  {url ? (
                    <img src={url} alt="" className="h-28 w-28 rounded-xl object-cover ring-1 ring-line" />
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </Tile>
              );
            }

            const wide = field.kind === "textarea" || field.kind === "bilingual" || field.kind === "multiselect";
            return (
              <Tile key={field.key} label={field.label} wide={wide}>
                <FieldValue field={field} record={source} language={language} />
              </Tile>
            );
          })}
        </Section>
      ))}
    </div>
  );
}
