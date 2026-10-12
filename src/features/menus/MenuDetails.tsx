import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useBranchScope, usePermissions } from "@/features/auth/hooks";
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
 * كل صنف وسعره بعملة القائمة. التبويب «الكل» يعرض الأصناف جميعها. توفّر كل صنف يُقرأ من
 * القائمة العامة كما يراها الزبون، ومن يملك الصلاحية يوقف الصنف في هذه القائمة وحده.
 */
export function MenuDetails({ record }: { record: Named }) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClient = useQueryClient();
  const permissions = usePermissions();
  const scope = useBranchScope();
  const [active, setActive] = useState<"all" | number>("all");
  const [page, setPage] = useState(1);
  // التوفّر الذي غيّرته هذه النافذة، يظهر فوراً دون انتظار إعادة الجلب.
  const [availability, setAvailability] = useState<Partial<Record<number, boolean>>>({});

  // مصدر حالة التوفّر هو القائمة العامة كما يقرؤها الموقع، ونسخة الإدارة قد لا تحمل الحقل.
  const publicMenu = useQuery({
    queryKey: ["public-menu", record.id],
    queryFn: () => menuApi.publicGet(record.id),
  });
  const publicAvailability = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const entry of asArray(asRecord(publicMenu.data).items)) {
      const row = asRecord(entry);
      map.set(toNumber(row.item_id ?? row.id), row.is_available !== false);
    }
    return map;
  }, [publicMenu.data]);

  const menuCurrency = toText(record.currency);
  // المستخدم المرتبط بفرع يوقف أصناف فرعه وحده، والخادم يرفض قائمة غيرها بـ 403.
  const menuBranchId = toNumber(record.branch_id ?? asRecord(record.branch).id);
  const canToggle =
    permissions.has(AVAILABILITY_PERMISSION) && (!scope.isBranchScoped || scope.branchId === menuBranchId);

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
    onSuccess: (result, { itemId, next }) => {
      // الخادم يعيد الحالة التي حفظها وهي المعتمدة، وإن غابت نأخذ ما أرسلناه.
      const confirmed = asRecord(asRecord(result).data).is_available;
      setAvailability((current) => ({ ...current, [itemId]: typeof confirmed === "boolean" ? confirmed : next }));
      void queryClient.invalidateQueries({ queryKey: ["public-menu", record.id] });
      toast.success(t("itemAvailability.saved"));
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  // الأولوية: ما غيّرته هذه النافذة، ثم القائمة العامة، ثم نسخة الإدارة.
  const isOn = (item: MenuItemView) => availability[item.id] ?? publicAvailability.get(item.id) ?? item.available;

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
            const on = isOn(item);
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
                        disabled={publicMenu.isPending || (save.isPending && save.variables?.itemId === item.id)}
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
