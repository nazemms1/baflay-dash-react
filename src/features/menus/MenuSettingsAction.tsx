import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Search, Settings2 } from "lucide-react";
import { usePermissions } from "@/features/auth/hooks";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { CheckList, type CheckItem } from "@/components/ui/CheckList";
import { Pagination } from "@/components/ui/Pagination";
import { PAGE_SIZE, pageOf } from "@/components/ui/paging";
import { Segmented } from "@/components/ui/Segmented";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { asArray, asRecord, toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import { currentLanguage } from "@/i18n";
import { toApiError } from "@/lib/http/errors";
import { normalizeLinks } from "@/features/ingredients/model";
import { useIngredientDetails } from "@/features/ingredients/details";
import { menuApi, menuIngredients, menus, orderExtras, type Named } from "@/services";

type Tab = "combo" | "extras" | "suggestions";

/** رابط الصورة من حقل نصي أو من كائن فيه `url`. */
const urlOf = (value: unknown): string | null => {
  if (typeof value === "string" && value) return value;
  const url = (value as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && url ? url : null;
};

/**
 * إعدادات القائمة في نافذة واحدة بثلاثة تبويبات: الكومبو، وإطفاء الإضافات العامة
 * في هذا الفرع، واقتراحات كل صنف. كل تبويب يحفظ نفسه بزره.
 */
export function MenuSettingsAction({ row }: { row: Named }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  const [open, setOpen] = useState(false);

  // نافذة الإعدادات تُفتح لمن يملك تعديل تبويب واحد على الأقل: الكومبو، أو الإضافات، أو الاقتراحات.
  const canOpen = ["menus.combo.update", "menus.extras.exclusions.update", "menus.items.suggestions.update"].some(
    (name) => permissions.has(name)
  );
  if (!canOpen) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("menuSettings.open")}
        title={t("menuSettings.open")}
        className="grid size-11 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-primary-soft hover:text-ink sm:size-8"
      >
        <Settings2 className="size-4" aria-hidden />
      </button>
      {open && (
        <MenuSettingsDialog
          menuId={toNumber(row.id)}
          menuName={localizedRecord(row, currentLanguage()) || String(row.name ?? `#${row.id}`)}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function MenuSettingsDialog({ menuId, menuName, onClose }: { menuId: number; menuName: string; onClose: () => void }) {
  const { t } = useTranslation();
  const permissions = usePermissions();
  // كل تبويب يُعرض بصلاحية تعديله، ولا يُفتح تبويب لا يملك صاحبه صلاحيته.
  const tabPermission: Record<Tab, string> = {
    combo: "menus.combo.update",
    extras: "menus.extras.exclusions.update",
    suggestions: "menus.items.suggestions.update",
  };
  const allowedTabs = (Object.keys(tabPermission) as Tab[]).filter((value) => permissions.has(tabPermission[value]));
  const [requestedTab, setTab] = useState<Tab>("combo");
  const tab = allowedTabs.includes(requestedTab) ? requestedTab : (allowedTabs[0] ?? "combo");

  return (
    <Dialog open onClose={onClose} size="lg" fullOnMobile title={t("menuSettings.title", { name: menuName })} description={t("menuSettings.description")}>
      <div className="space-y-6">
        <Segmented<Tab>
          label={t("menuSettings.tabs")}
          value={tab}
          onChange={setTab}
          options={allowedTabs.map((value) => ({ value, label: t(`menuSettings.${value}`) }))}
        />
        {tab === "combo" && <ComboTab menuId={menuId} onDone={onClose} />}
        {tab === "extras" && <ExtrasTab menuId={menuId} onDone={onClose} />}
        {tab === "suggestions" && <SuggestionsTab menuId={menuId} />}
      </div>
    </Dialog>
  );
}

/** الكومبو: سعره يُضاف فوق سعر الساندويتش. الفارغ يعني أن الفرع لا يبيع كومبو. */
function ComboTab({ menuId, onDone }: { menuId: number; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const menu = useQuery({ queryKey: ["menu-detail", menuId], queryFn: ({ signal }) => menus.get(menuId, signal) });

  const [draft, setDraft] = useState<{ price: string; name: string; nameAr: string } | null>(null);
  const body = asRecord(menu.data);
  const offer = asRecord(body.combo);
  const saved = {
    price: String(toNullableNumber(body.combo_price ?? offer.price) ?? ""),
    name: toText(body.combo_name ?? offer.name),
    nameAr: toText(body.combo_name_ar ?? offer.name_ar),
  };
  const form = draft ?? saved;

  const save = useMutation({
    mutationFn: () =>
      menuApi.setCombo(menuId, {
        combo_price: form.price.trim() === "" ? null : Number(form.price),
        combo_name: form.name.trim() || null,
        combo_name_ar: form.nameAr.trim() || null,
      }),
    onSuccess: async () => {
      toast.success(t("menuSettings.saved"));
      await queryClient.invalidateQueries({ queryKey: ["menu-detail", menuId] });
      onDone();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  if (menu.isPending) return <Skeleton className="h-48" />;
  if (menu.isError) return <ErrorState message={t("errors.unexpected")} onRetry={() => void menu.refetch()} />;

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft">{t("menuSettings.comboHint")}</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Input label={t("menuSettings.comboPrice")} type="number" min="0" step="any" dir="ltr" value={form.price}
          onChange={(event) => setDraft({ ...form, price: event.target.value })} />
        <Input label={`${t("menuSettings.comboName")} · ${t("crud.english")}`} dir="ltr" value={form.name}
          onChange={(event) => setDraft({ ...form, name: event.target.value })} />
        <Input label={`${t("menuSettings.comboName")} · ${t("crud.arabic")}`} dir="rtl" value={form.nameAr}
          onChange={(event) => setDraft({ ...form, nameAr: event.target.value })} />
      </div>
      <div className="sm:flex sm:justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full bg-primary text-ink hover:bg-primary/90 sm:w-auto">
          {save.isPending ? t("crud.saving") : t("crud.save")}
        </Button>
      </div>
    </div>
  );
}

/**
 * الإضافات العامة في هذا الفرع: كل إضافة للبراند تظهر هنا بصورتها، إلا ما يُطفئه
 * الفرع. الإضافة غير المسعّرة في الفرع لا يمكن أن تظهر أصلاً، فتبقى معطّلة.
 */
function ExtrasTab({ menuId, onDone }: { menuId: number; onDone: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<number[] | null>(null);

  const brand = useQuery({
    queryKey: ["order-extras"],
    queryFn: async () => asArray(asRecord(await orderExtras.get()).ingredient_ids).map((value) => toNumber(value)),
  });
  const linked = useQuery({
    // مفتاح خاص: الشاشة تحفظ معرّفات المسعَّر، وصفحة المكوّنات تحفظ الروابط كاملة تحت المفتاح نفسه.
    queryKey: ["menu-extras-priced", menuId],
    queryFn: async ({ signal }) => normalizeLinks(await menuIngredients.list(menuId, signal)).map((link) => link.ingredientId),
  });
  const shown = useQuery({
    queryKey: ["menu-public", menuId],
    queryFn: async () => asArray(asRecord(await menuApi.publicGet(menuId)).extras).map((entry) => {
      const row = asRecord(entry);
      return toNumber(row.id ?? row.ingredient_id ?? entry);
    }),
  });
  // أسماء إضافات البراند وصورها، لكل إضافة على حدة وتبقى في الذاكرة المؤقتة.
  const details = useIngredientDetails(brand.data ?? []);
  const pricedHere = linked.data ?? [];
  const extraRows = (brand.data ?? []).map((id) => ({
    id,
    label: details.get(id)?.label ?? `#${id}`,
    image: details.get(id)?.image ?? null,
    priced: pricedHere.includes(id),
  }));

  const selected = draft ?? (shown.data ?? []).filter((id) => pricedHere.includes(id));
  const setOn = (id: number, on: boolean) =>
    setDraft(on ? [...selected, id] : selected.filter((value) => value !== id));

  const save = useMutation({
    mutationFn: () => {
      // المطفأ = مُسعَّر هنا من إضافات البراند، ولم يعد معروضاً في الفرع.
      const excluded = (brand.data ?? []).filter((id) => pricedHere.includes(id) && !selected.includes(id));
      return menuApi.setExtraExclusions(menuId, { ingredient_ids: excluded });
    },
    onSuccess: async () => {
      toast.success(t("menuSettings.saved"));
      await queryClient.invalidateQueries({ queryKey: ["menu-public", menuId] });
      onDone();
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const loading = brand.isPending || linked.isPending || shown.isPending;
  if (loading) return <Skeleton className="h-64" />;
  if (brand.isError || linked.isError || shown.isError) {
    return <ErrorState message={t("errors.unexpected")} onRetry={() => { void brand.refetch(); void linked.refetch(); void shown.refetch(); }} />;
  }

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-ink">{t("menuSettings.extrasTitle")}</h3>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-[11px] font-bold tracking-wide text-surface">Extra</span>
        </div>
        <p className="text-sm text-muted">{t("menuSettings.extrasSubtitle")}</p>
      </header>
      {extraRows.length === 0 ? (
        <p className="text-sm text-muted">{t("menuSettings.noBrandExtras")}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-secondary/30 bg-surface">
          {extraRows.map((row) => {
            const on = selected.includes(row.id);
            const statusText = !row.priced ? t("menuSettings.notPriced") : on ? t("menuSettings.extraOn") : t("menuSettings.extraOff");
            return (
              <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex min-w-0 items-center gap-3">
                  <ExtraImage src={row.image} name={row.label} />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{row.label}</span>
                    <span className={`block text-xs ${!row.priced ? "text-warn" : on ? "text-ok" : "text-muted"}`}>{statusText}</span>
                  </span>
                </span>
                <ExtraSwitch checked={on} disabled={!row.priced} onChange={(next) => setOn(row.id, next)} />
              </li>
            );
          })}
        </ul>
      )}
      <div className="sm:flex sm:justify-end">
        <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full bg-primary text-ink hover:bg-primary/90 sm:w-auto">
          {save.isPending ? t("crud.saving") : t("crud.save")}
        </Button>
      </div>
    </div>
  );
}

/** مفتاح تشغيل لكل إضافة عامة: الشكل نفسه في كل الفروع، والحالة تُكتب بجانبه. */
function ExtraSwitch({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: (next: boolean) => void }) {
  return (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-line transition checked:bg-secondary relative before:absolute before:start-0.5 before:top-0.5 before:size-5 before:rounded-full before:bg-surface before:shadow before:transition checked:before:translate-x-5 rtl:checked:before:-translate-x-5 disabled:cursor-not-allowed disabled:opacity-40"
    />
  );
}

/** صورة الإضافة العامة، وإن غابت فحرفها الأول. */
function ExtraImage({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-line" />
  ) : (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas font-bold text-muted ring-1 ring-line">
      {name.charAt(0)}
    </span>
  );
}

/**
 * الاقتراحات: البحث والأصناف تظهر أولاً. اختر صنفاً من القائمة لتعديل ما يُقترح
 * معه، فتظهر اقتراحاته بجانب صوره ليختار منها.
 */
function SuggestionsTab({ menuId }: { menuId: number }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const language = currentLanguage();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, number[]>>({});

  const menu = useQuery({ queryKey: ["menu-detail", menuId], queryFn: ({ signal }) => menus.get(menuId, signal) });

  const entries = useMemo(
    () =>
      asArray(asRecord(menu.data).items).map((entry) => {
        const row = asRecord(entry);
        const id = toNumber(row.item_id ?? row.id);
        return {
          id,
          label: localizedRecord(row as { name?: unknown; name_ar?: unknown }, language) || `#${id}`,
          image: urlOf(row.image),
          suggested: asArray(row.suggested_item_ids ?? row.suggestions).map((value) => toNumber(value)),
        };
      }),
    [menu.data, language]
  );

  const visible = entries.filter((entry) => {
    const needle = query.trim().toLowerCase();
    return needle === "" || entry.label.toLowerCase().includes(needle);
  });

  // قائمة الأصناف في الاقتراحات تُعرض عشرين في الصفحة، بعد البحث.
  const [entryPage, setEntryPage] = useState(1);
  const entriesPage = pageOf(visible, entryPage);

  const active = entries.find((entry) => entry.id === activeId) ?? null;
  const selected = active ? (drafts[active.id] ?? active.suggested) : [];
  const others: CheckItem[] = entries
    .filter((entry) => entry.id !== activeId)
    .map((entry) => ({ id: entry.id, label: entry.label, image: entry.image }));

  const save = useMutation({
    mutationFn: () => menuApi.setSuggestions(menuId, activeId!, { item_ids: selected }),
    onSuccess: async () => {
      toast.success(t("menuSettings.saved"));
      await queryClient.invalidateQueries({ queryKey: ["menu-detail", menuId] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  if (menu.isPending) return <Skeleton className="h-64" />;
  if (menu.isError) return <ErrorState message={t("errors.unexpected")} onRetry={() => void menu.refetch()} />;
  if (entries.length === 0) return <p className="text-sm text-muted">{t("menuSettings.noMenuItems")}</p>;

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-canvas px-4 py-3 text-sm text-ink-soft">{t("menuSettings.suggestionsHint")}</p>

      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setEntryPage(1);
          }}
          placeholder={t("crud.searchPlaceholder")}
          aria-label={t("crud.searchPlaceholder")}
          className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 sm:h-10"
        />
      </div>

      <ul className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
        {entriesPage.items.map((entry) => {
          const isActive = entry.id === activeId;
          return (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setActiveId(entry.id)}
                aria-pressed={isActive}
                className={`flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-start transition ${
                  isActive ? "border-primary bg-primary-soft" : "border-line bg-surface hover:border-primary/60"
                }`}
              >
                {entry.image ? (
                  <img src={entry.image} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-line" />
                ) : (
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas text-sm font-bold text-muted ring-1 ring-line" aria-hidden>
                    {entry.label.charAt(0)}
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{entry.label}</span>
                <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs text-muted tabular-nums">
                  {entry.suggested.length}
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && <li className="text-sm text-muted">{t("crud.noResults")}</li>}
      </ul>
      {visible.length > PAGE_SIZE && <Pagination meta={entriesPage.meta} onPageChange={setEntryPage} />}

      {active && (
        <section className="space-y-3 rounded-2xl border border-line p-4">
          <h3 className="text-sm font-semibold text-ink">{t("menuSettings.suggestFor", { name: active.label })}</h3>
          <CheckList
            items={others}
            selected={selected}
            onChange={(next) => setDrafts({ ...drafts, [active.id]: next })}
          />
          <div className="sm:flex sm:justify-end">
            <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full bg-primary text-ink hover:bg-primary/90 sm:w-auto">
              {save.isPending ? t("crud.saving") : t("crud.save")}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
