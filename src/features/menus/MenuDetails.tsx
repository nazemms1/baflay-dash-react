import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { usePermissions } from "@/features/auth/hooks";
import { Pagination } from "@/components/ui/Pagination";
import { PAGE_SIZE, pageOf } from "@/components/ui/paging";
import { currentLanguage } from "@/i18n";
import { asArray, asRecord, toNumber, toText } from "@/lib/coerce";
import { formatMoney } from "@/lib/format";
import { toApiError } from "@/lib/http/errors";
import { localizedRecord } from "@/lib/localized";
import { menuApi, type Named } from "@/services";

/** صلاحية توفّر الصنف داخل القائمة، بالاسم الذي يعرفه الخادم. */
const AVAILABILITY_PERMISSION = "menus.items.availability.update";

interface MenuItemView {
  id: number;
  name: string;
  image: string | null;
  price: number;
  currency: string;
  categoryId: number | null;
  categoryName: string;
  available: boolean;
}

/**
 * تفاصيل القائمة كما في الداشبورد القديم: أصنافها مجمّعة حسب التصنيف في تبويبات، مع صورة
 * كل صنف وسعره بعملة القائمة. التبويب «الكل» يعرض الأصناف جميعها. ومن يملك الصلاحية
 * يوقف توفّر صنف داخل هذه القائمة أو يعيده.
 */
export function MenuDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const canToggle = usePermissions().has(AVAILABILITY_PERMISSION);
  const [active, setActive] = useState<"all" | number>("all");
  const [page, setPage] = useState(1);
  // التوفّر الذي غيّرته هذه النافذة، يظهر فوراً دون انتظار إعادة تحميل القائمة.
  const [availability, setAvailability] = useState<Partial<Record<number, boolean>>>({});

  const menuCurrency = toText(record.currency);

  const items = useMemo<MenuItemView[]>(
    () =>
      asArray(record.items).map((entry) => {
        const row = asRecord(entry);
        const category = asRecord(row.category);
        const categoryId = toNumber(category.id ?? row.category_id) || null;
        return {
          id: toNumber(row.item_id ?? row.id),
          name: localizedRecord(row, language) || `#${toNumber(row.item_id ?? row.id)}`,
          image: typeof row.image === "string" && row.image ? row.image : null,
          price: toNumber(row.price),
          currency: toText(row.currency) || menuCurrency,
          categoryId,
          categoryName: localizedRecord(category, language),
          available: row.is_available !== false,
        };
      }),
    [record.items, language, menuCurrency]
  );

  const save = useMutation({
    mutationFn: ({ itemId, next }: { itemId: number; next: boolean }) =>
      menuApi.setItemAvailability(record.id, itemId, next),
    onSuccess: (_, { itemId, next }) => {
      setAvailability((current) => ({ ...current, [itemId]: next }));
      toast.success(t("itemAvailability.saved"));
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  // تصنيفات الأصناف بترتيب ظهورها، دون تكرار.
  const categories = useMemo(() => {
    const seen = new Map<number, string>();
    for (const item of items) {
      if (item.categoryId !== null && !seen.has(item.categoryId)) {
        seen.set(item.categoryId, item.categoryName || `#${item.categoryId}`);
      }
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [items]);

  const visible = active === "all" ? items : items.filter((item) => item.categoryId === active);
  const paged = pageOf(visible, page);

  return (
    <div className="space-y-5">
      {categories.length > 0 && (
        <div role="tablist" aria-label={t("menus.details.categories")} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {[{ id: "all" as const, label: t("menus.details.allCategories") }, ...categories].map((tab) => {
            const on = active === tab.id;
            return (
              <button
                key={String(tab.id)}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => {
                  setActive(tab.id);
                  setPage(1);
                }}
                className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${
                  on ? "bg-primary text-ink" : "ring-1 ring-line hover:bg-primary-soft"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {visible.length === 0 ? (
        <p className="rounded-xl bg-canvas px-4 py-8 text-center text-sm text-muted">{t("menus.details.empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {paged.items.map((item) => {
            const on = availability[item.id] ?? item.available;
            return (
              <li key={`${item.id}-${item.categoryId ?? "none"}`} className="overflow-hidden rounded-2xl border border-line bg-surface">
                {item.image ? (
                  <img src={item.image} alt="" className={`aspect-square w-full object-cover ${on ? "" : "grayscale"}`} />
                ) : (
                  <span
                    className={`grid aspect-square w-full place-items-center bg-canvas text-2xl font-bold text-muted ${on ? "" : "grayscale"}`}
                  >
                    {item.name.charAt(0)}
                  </span>
                )}
                <div className="space-y-1 p-3">
                  <p className="line-clamp-2 text-sm font-medium text-ink">{item.name}</p>
                  {item.categoryName && <p className="text-xs text-muted">{item.categoryName}</p>}
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold tabular-nums text-ok">{formatMoney(item.price, item.currency)}</p>
                    {canToggle && (
                      <AvailabilitySwitch
                        on={on}
                        label={t("itemAvailability.toggle")}
                        disabled={save.isPending && save.variables?.itemId === item.id}
                        onToggle={() => save.mutate({ itemId: item.id, next: !on })}
                      />
                    )}
                  </div>
                  {!on && <p className="text-xs font-medium text-danger">{t("itemAvailability.unavailable")}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {visible.length > PAGE_SIZE && <Pagination meta={paged.meta} onPageChange={setPage} />}
    </div>
  );
}

/** مفتاح التوفّر: مفتوح يعني متوفراً. الزر يحمل الحالة في `aria-checked` للقراءة الصوتية. */
function AvailabilitySwitch({
  on,
  label,
  disabled,
  onToggle,
}: {
  on: boolean;
  label: string;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition disabled:opacity-50 ${on ? "bg-ok" : "bg-line"}`}
    >
      <span className={`absolute top-0.5 size-4 rounded-full bg-surface shadow transition ${on ? "end-0.5" : "start-0.5"}`} />
    </button>
  );
}
