import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { ChevronDown, Search, X } from "lucide-react";
import type { Option } from "./Fields";

/** ترتيب المجالات كما في الداشبورد القديم: طلبات الزبون أولاً، ثم القوائم والفروع، ثم الإدارة. */
const AREA_ORDER = [
  "orders",
  "admin",
  "menus",
  "items",
  "ingredients",
  "order-extras",
  "branches",
  "categories",
  "galleries",
  "users",
  "roles",
  "permissions",
  "access",
  "customers",
  "customer",
  "surveys",
  "questions",
  "answers",
  "countries",
  "states",
  "cities",
  "franchises",
  "contact-us",
  "game",
];

const areaRank = (area: string) => {
  const index = AREA_ORDER.indexOf(area);
  return index === -1 ? AREA_ORDER.length : index;
};

interface PermissionPickerProps {
  label: string;
  options: Option[];
  value: (string | number)[];
  onChange: (value: (string | number)[]) => void;
  error?: string;
}

/**
 * اختيار الصلاحيات مجمّعة في مجالات قابلة للطي، لكل مجال عدّاده وزر تحديده كله. البحث يعرض
 * النتائج داخل أقسامها، فيجد المستخدم الصلاحية بسرعة دون التمرير بين عشرات الخيارات.
 */
export function PermissionPicker({ label, options, value, onChange, error }: PermissionPickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  // فتح القسم أو طيّه يدوياً؛ الافتراضي أن يبقى مفتوحاً ما فيه تحديد أو نتيجة بحث.
  const [openOverride, setOpenOverride] = useState<Record<string, boolean>>({});

  const selected = useMemo(() => new Set(value.map(String)), [value]);
  const needle = query.trim().toLowerCase();

  // إحصاءات كل مجال من الخيارات كلها، لا من نتائج البحث، فالعدّاد يبقى صحيحاً.
  const stats = useMemo(() => {
    const byArea = new Map<string, { total: number; chosen: number }>();
    for (const option of options) {
      const area = option.group ?? "";
      const entry = byArea.get(area) ?? { total: 0, chosen: 0 };
      entry.total += 1;
      if (selected.has(String(option.value))) entry.chosen += 1;
      byArea.set(area, entry);
    }
    return byArea;
  }, [options, selected]);

  // الأقسام المعروضة: خيارات تطابق البحث، مرتبة بالمجال ثم بالاسم.
  const sections = useMemo(() => {
    const byArea = new Map<string, Option[]>();
    for (const option of options) {
      const haystack = `${option.label} ${option.hint ?? ""}`.toLowerCase();
      if (needle && !haystack.includes(needle)) continue;
      const area = option.group ?? "";
      const bucket = byArea.get(area) ?? [];
      bucket.push(option);
      byArea.set(area, bucket);
    }
    return [...byArea.entries()]
      .sort(([a], [b]) => areaRank(a) - areaRank(b) || a.localeCompare(b))
      .map(([area, items]) => ({ area, items: [...items].sort((x, y) => x.label.localeCompare(y.label)) }));
  }, [options, needle]);

  const toggleOne = (id: string | number) => {
    const key = String(id);
    onChange(selected.has(key) ? value.filter((item) => String(item) !== key) : [...value, id]);
  };

  const toggleSection = (items: Option[]) => {
    const keys = new Set(items.map((item) => String(item.value)));
    const allOn = items.every((item) => selected.has(String(item.value)));
    if (allOn) {
      onChange(value.filter((item) => !keys.has(String(item))));
    } else {
      const missing = items.map((item) => item.value).filter((id) => !selected.has(String(id)));
      onChange([...value, ...missing]);
    }
  };

  const areaLabel = (area: string) => t(`permissions.areas.${area}`, { defaultValue: area || "—" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-soft">
          {label}
          <span className="ms-2 font-semibold tabular-nums text-ink">({t("permissionPicker.selected", { count: value.length })})</span>
        </p>
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-secondary hover:bg-secondary-soft"
          >
            <X className="size-3.5" aria-hidden />
            {t("permissionPicker.clearAll")}
          </button>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("crud.searchPlaceholder")}
          aria-label={t("crud.searchPlaceholder")}
          className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm text-ink outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/20"
        />
      </div>

      <div className="max-h-[26rem] space-y-2 overflow-y-auto rounded-xl border border-line bg-surface p-2">
        {sections.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">{t("crud.noResults")}</p>}

        {sections.map(({ area, items }) => {
          const stat = stats.get(area) ?? { total: items.length, chosen: 0 };
          const defaultOpen = needle !== "" || stat.chosen > 0;
          const isOpen = openOverride[area] ?? defaultOpen;
          const allChosen = stat.chosen === stat.total;

          return (
            <section key={area || "none"} className="rounded-xl bg-canvas/60">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenOverride((previous) => ({ ...previous, [area]: !isOpen }))}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
                >
                  <ChevronDown
                    className={clsx("size-4 shrink-0 text-muted transition", !isOpen && "-rotate-90 rtl:rotate-90")}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-semibold text-ink">{areaLabel(area)}</span>
                  <span className="ms-auto shrink-0 text-xs font-medium tabular-nums text-muted">
                    {stat.chosen}/{stat.total}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleSection(items)}
                  className="shrink-0 cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-secondary hover:bg-secondary-soft"
                >
                  {allChosen ? t("permissionPicker.clearSection") : t("permissionPicker.selectSection")}
                </button>
              </div>

              {isOpen && (
                <ul className="grid gap-1 px-2 pb-2 sm:grid-cols-2">
                  {items.map((option) => {
                    const on = selected.has(String(option.value));
                    return (
                      <li key={String(option.value)}>
                        <label
                          className={clsx(
                            "flex cursor-pointer items-start gap-3 rounded-lg px-2.5 py-2 transition",
                            on ? "bg-primary-soft" : "hover:bg-surface"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggleOne(option.value)}
                            className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-ink">{option.label}</span>
                            {option.hint && (
                              <span dir="ltr" className="block truncate text-[11px] text-muted">
                                {option.hint}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
