import type { ReactNode } from "react";
import { currentLanguage, type Language } from "@/i18n";
import { localizedRecord, type RawBilingual } from "@/lib/localized";
import { toPage, type Page } from "@/lib/http/envelope";
import type { ColumnDef, ListQuery, OptionSource, RemoteSource } from "@/components/crud/types";
import { Badge } from "@/components/ui/Badge";

type WithId = { id: number | string };

/** عمود الاسم: اللغة المعروضة بخط واضح، والاسم الآخر تحته للتوضيح. */
export function nameColumn<T extends WithId & RawBilingual>(header = "crud.col.name"): ColumnDef<T> {
  return {
    key: "name",
    header,
    render: (row, language: Language) => {
      const primary = localizedRecord(row, language);
      const other = localizedRecord(row, language === "ar" ? "en" : "ar");
      return (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{primary || "—"}</p>
          {other && other !== primary && <p className="truncate text-xs text-muted">{other}</p>}
        </div>
      );
    },
  };
}

/** عمود نصي بسيط يقرأ حقلاً واحداً من السجل. */
export function textColumn<T extends WithId>(key: string, header: string, read?: (row: T) => ReactNode): ColumnDef<T> {
  return {
    key,
    header,
    render: (row) => {
      if (read) return read(row);
      const value = (row as unknown as Record<string, unknown>)[key];
      return <span className="text-ink-soft">{value === null || value === undefined || value === "" ? "—" : String(value)}</span>;
    },
  };
}

/** عمود صورة مصغّرة، يقرأ الرابط من حقل نصي أو من كائن فيه `url`. */
export function imageColumn<T extends WithId>(key: string, header: string): ColumnDef<T> {
  return {
    key,
    header,
    className: "w-16",
    render: (row) => {
      const raw = (row as unknown as Record<string, unknown>)[key];
      const url = typeof raw === "string" ? raw : (raw as { url?: string } | null)?.url;
      return url ? (
        <img src={url} alt="" className="size-10 rounded-lg object-cover ring-1 ring-line" />
      ) : (
        <span className="block size-10 rounded-lg bg-canvas ring-1 ring-line" aria-hidden />
      );
    },
  };
}

/** شارة للقيم المنطقية، بلون أخضر للفعّال ورمادي لغيره. */
export function flagColumn<T extends WithId>(key: string, header: string, labels: { on: string; off: string }): ColumnDef<T> {
  return {
    key,
    header,
    render: (row) => {
      const on = Boolean((row as unknown as Record<string, unknown>)[key]);
      return <Badge tone={on ? "ok" : "neutral"}>{on ? labels.on : labels.off}</Badge>;
    },
  };
}

/** اسم العلاقة من السجل، سواء جاء كائناً متداخلاً أو معرّفاً فقط. */
export function relationName(row: unknown, field: string, language: Language): string {
  const record = row as Record<string, unknown>;
  const nested = record[field];
  if (nested && typeof nested === "object") {
    return localizedRecord(nested as RawBilingual, language) || "—";
  }
  return record[`${field}_id`] !== undefined && record[`${field}_id`] !== null ? `#${String(record[`${field}_id`])}` : "—";
}

/**
 * مصدر خيارات لحقل علاقة. يجلب صفحة كبيرة واحدة، لأن القوائم المرجعية
 * (الفروع والمدن والتصنيفات) لا تتجاوز بضع مئات عادةً.
 */
export function optionSource<T extends WithId & RawBilingual>(
  cacheKey: string,
  fetch: (signal: AbortSignal) => Promise<Page<T>>,
  labelOf: (row: T, language: Language) => string = (row, language) => localizedRecord(row, language)
): OptionSource {
  return {
    cacheKey,
    load: async (signal) => {
      const page = await fetch(signal);
      const language = currentLanguage();
      return page.items.map((row) => ({ value: row.id, label: labelOf(row, language) || `#${row.id}` }));
    },
  };
}

/**
 * مصدر خيارات يجلب كل العناصر، لا صفحة واحدة. يُستعمل حين يجب أن يجد الحقل كل
 * صنف، فالصنف المختار لا يختفي لأنه خارج الصفحة الأولى.
 */
export function allOptionSource<T extends WithId & RawBilingual>(
  cacheKey: string,
  fetchAll: (signal: AbortSignal) => Promise<T[]>,
  labelOf: (row: T, language: Language) => string = (row, language) => localizedRecord(row, language)
): OptionSource {
  return {
    cacheKey,
    load: async (signal) => {
      const rows = await fetchAll(signal);
      const language = currentLanguage();
      return rows.map((row) => ({ value: row.id, label: labelOf(row, language) || `#${row.id}` }));
    },
  };
}

/**
 * مصدر خيارات بحث على الخادم. كل طلب يجلب عشرين صفاً تطابق ما كتبه المستخدم، والخيار المختار
 * يُجلب وحده بمعرّفه. لا تُنزَّل القائمة كلها، فالقوائم قد تكبر دون أن تثقل الشاشة.
 */
export function remoteSource<T extends WithId & RawBilingual>(
  cacheKey: string,
  resource: {
    list: (query: ListQuery & { search?: string }, signal?: AbortSignal) => Promise<Page<T>>;
    get: (id: number | string, signal?: AbortSignal) => Promise<T>;
  },
  labelOf: (row: T, language: Language) => string = (row, language) => localizedRecord(row, language)
): RemoteSource {
  const toOption = (row: T) => ({
    value: row.id,
    label: labelOf(row, currentLanguage()) || `#${row.id}`,
    image: imageOf(row),
  });
  return {
    cacheKey,
    search: async (term, page, signal) => {
      const result = await resource.list({ page, per_page: 20, ...(term ? { search: term } : {}) }, signal);
      return { items: result.items.map(toOption), lastPage: result.meta.lastPage };
    },
    byId: async (value, signal) => {
      try {
        return toOption(await resource.get(value, signal));
      } catch {
        return null;
      }
    },
  };
}

/** صورة السجل: نص مباشر أو كائن يحمل `url`، كما يعيدها الخادم. */
function imageOf(row: unknown): string | null {
  const raw = (row as { image?: unknown } | null)?.image;
  if (typeof raw === "string" && raw) return raw;
  const url = (raw as { url?: unknown } | null)?.url;
  return typeof url === "string" && url ? url : null;
}

/** ينقل استجابة الخادم المفكوكة إلى صفحة موحّدة، لاستعمالها في مصادر الخيارات. */
export const asPage = <T,>(body: unknown): Page<T> => toPage<T>(body);
