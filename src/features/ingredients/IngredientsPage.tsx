import { useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import clsx from "clsx";
import { Check, Link2, Link2Off, Pencil, Plus, Search, Zap } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { Pagination } from "@/components/ui/Pagination";
import { PAGE_SIZE, pageOf } from "@/components/ui/paging";
import { ImageField, SelectField } from "@/components/ui/Fields";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { Skeleton } from "@/components/ui/Bars";
import { currentLanguage, type Language } from "@/i18n";
import { formatMoney, formatNumber } from "@/lib/format";
import { localizedRecord } from "@/lib/localized";
import { ApiError, toApiError } from "@/lib/http/errors";
import { toNumber, toText } from "@/lib/coerce";
import { usePermissions } from "@/features/auth/hooks";
import { branches, ingredients, menuIngredients, menus, type Named } from "@/services";
import {
  CURRENCIES,
  buildRows,
  hasChanged,
  linkRow,
  normalizeLinks,
  planSave,
  unpricedLinks,
  type CatalogIngredient,
  type IngredientRow,
} from "./model";

type FilterValue = "all" | "linked" | "unlinked" | "changed";

const urlOf = (value: unknown): string | null => {
  if (typeof value === "string" && value) return value;
  const url = (value as { url?: unknown } | null | undefined)?.url;
  return typeof url === "string" && url ? url : null;
};

const toCatalog = (row: Named): CatalogIngredient => ({
  id: toNumber(row.id),
  name: toText(row.name),
  nameAr: toText(row.name_ar),
  image: urlOf(row.image),
  status: toText(row.status) || "active",
});

/** كل مكوّنات الكتالوج، بالصفحات كلها، لأن الشاشة تحتاجها كاملة للربط. */
async function fetchCatalog(signal: AbortSignal): Promise<CatalogIngredient[]> {
  const all: CatalogIngredient[] = [];
  for (let page = 1; page <= 50; page += 1) {
    const result = await ingredients.list({ page, per_page: 100 }, signal);
    all.push(...result.items.map(toCatalog));
    if (result.items.length === 0 || page >= result.meta.lastPage) break;
  }
  return all;
}

/**
 * مكوّنات الفرع: يختار الفرع ثم قائمته، فتظهر مكونات الكتالوج كلها مع ما هو
 * مربوط منها بهذه القائمة وسعره وعملته. التغييرات تُجمع محلياً وتُحفظ دفعة واحدة.
 */
export function IngredientsPage() {
  const { t } = useTranslation();
  const language: Language = currentLanguage();
  const queryClient = useQueryClient();

  // كل زر يغيّر شيئاً يُعطَّل وفق صلاحيته: إنشاء المكوّن، وتعديل الربط والأسعار.
  const permissions = usePermissions();
  const canCreate = permissions.has("ingredients.create");
  // تعديل الربط والأسعار يحتاج صلاحية قوائم المكوّنات، وفك الربط صلاحية حذفها.
  const canEdit = permissions.has("ingredients.menus.update");
  const canUnlink = permissions.has("ingredients.menus.destroy");

  const [branchId, setBranchId] = useState<number | null>(null);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [copySourceId, setCopySourceId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [cardPage, setCardPage] = useState(1);
  const [bulkCurrency, setBulkCurrency] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ menuId: number; rows: IngredientRow[] } | null>(null);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState<null | { mode: "create" } | { mode: "edit"; ingredient: CatalogIngredient }>(null);

  const branchList = useQuery({
    queryKey: ["ingredients-page", "branches"],
    queryFn: async ({ signal }) => (await branches.list({ page: 1, per_page: 500 }, signal)).items,
    staleTime: 5 * 60_000,
  });

  const menuList = useQuery({
    queryKey: ["ingredients-page", "menus"],
    queryFn: async ({ signal }) => (await menus.list({ page: 1, per_page: 500 }, signal)).items,
    staleTime: 60_000,
  });

  const catalog = useQuery({
    queryKey: ["ingredients-page", "catalog"],
    queryFn: ({ signal }) => fetchCatalog(signal),
  });

  const links = useQuery({
    queryKey: ["ingredients-page", "links", menuId],
    queryFn: async ({ signal }) => normalizeLinks(await menuIngredients.list(menuId!, signal)),
    enabled: menuId !== null,
  });

  const copySourceLinks = useQuery({
    queryKey: ["ingredients-page", "links", copySourceId],
    queryFn: async ({ signal }) => normalizeLinks(await menuIngredients.list(copySourceId!, signal)),
    enabled: copySourceId !== null,
  });

  const branchName = (id: number | null | undefined) => {
    const branch = branchList.data?.find((row) => toNumber(row.id) === id);
    return branch ? localizedRecord(branch, language) : "";
  };

  const menusOfBranch = useMemo(
    () =>
      (menuList.data ?? []).filter((menu) => branchId !== null && toNumber((menu as Record<string, unknown>).branch_id) === branchId),
    [menuList.data, branchId]
  );

  const menuLabel = (menu: Named) => {
    const owner = branchName(toNumber((menu as Record<string, unknown>).branch_id));
    return [toText(menu.name) || `#${menu.id}`, owner].filter(Boolean).join(" · ");
  };

  // المسودة تُخزَّن لقائمة بعينها، فتعود القيم المحفوظة عند تغيير القائمة.
  const rows = useMemo<IngredientRow[]>(() => {
    if (menuId === null || !catalog.data || !links.data) return [];
    if (draft && draft.menuId === menuId) return draft.rows;
    return buildRows(catalog.data, links.data);
  }, [menuId, catalog.data, links.data, draft]);

  const changedCount = rows.filter(hasChanged).length;
  const linkedCount = rows.filter((row) => row.isLinked).length;

  const setRows = (next: IngredientRow[]) => {
    if (menuId !== null) setDraft({ menuId, rows: next });
  };

  const updateRow = (id: number, patch: Partial<IngredientRow>) =>
    setRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));

  const visible = rows.filter((row) => {
    const needle = search.trim().toLowerCase();
    const matches =
      needle === "" ||
      row.name.toLowerCase().includes(needle) ||
      row.nameAr.toLowerCase().includes(needle);
    if (!matches) return false;
    if (filter === "linked") return row.isLinked;
    if (filter === "unlinked") return !row.isLinked;
    if (filter === "changed") return hasChanged(row);
    return true;
  });

  const visibleUnlinked = visible.filter((row) => !row.isLinked);
  const visibleLinked = visible.filter((row) => row.isLinked);
  // البطاقات تُعرض عشرين في الصفحة؛ الأزرار الجماعية تعمل على كل ما يطابق البحث والفلتر.
  const cards = pageOf(visible, cardPage);

  const counts = {
    all: rows.length,
    linked: linkedCount,
    unlinked: rows.length - linkedCount,
    changed: changedCount,
  };

  const save = useMutation({
    mutationFn: async () => {
      if (menuId === null) return;
      const plan = planSave(rows);
      const invalid = unpricedLinks(plan);
      if (invalid.length > 0) {
        throw new ApiError(t("ingredientsPage.priceRequired", { name: invalid[0].name || `#${invalid[0].id}` }));
      }

      if (plan.add.length > 0) {
        await menuIngredients.add(menuId, {
          ingredients: plan.add.map((row) => ({ ingredient_id: row.id, price: row.price, currency: row.currency })),
        });
      }
      for (const row of plan.update) {
        await menuIngredients.update(menuId, row.id, { ingredient_id: row.id, price: row.price, currency: row.currency });
      }
      for (const row of plan.remove) {
        await menuIngredients.remove(menuId, row.id);
      }
      return plan.add.length + plan.update.length + plan.remove.length;
    },
    onSuccess: async (count) => {
      toast.success(t("ingredientsPage.saved", { count: count ?? 0 }));
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ["ingredients-page", "links", menuId] });
    },
    onError: (caught) => toast.error(toApiError(caught, t("errors.unexpected")).message),
  });

  const copyPrices = () => {
    const source = copySourceLinks.data;
    if (!source) return;
    const byId = new Map(source.map((link) => [link.ingredientId, link]));
    let applied = 0;
    setRows(
      rows.map((row) => {
        const link = byId.get(row.id);
        if (!visible.some((candidate) => candidate.id === row.id) || !link) return row;
        applied += 1;
        return { ...row, isLinked: true, price: link.price, currency: link.currency };
      })
    );
    toast.info(t("ingredientsPage.copied", { count: applied }));
  };

  const pickBranch = (value: string | number | null) => {
    setBranchId(value === null ? null : Number(value));
    setMenuId(null);
    setCopySourceId(null);
    setDraft(null);
  };

  const pickMenu = (value: string | number | null) => {
    if (changedCount > 0 && !window.confirm(t("ingredientsPage.discardPrompt"))) return;
    setMenuId(value === null ? null : Number(value));
    setCopySourceId(null);
    setDraft(null);
  };

  const filters: { value: FilterValue; label: string }[] = [
    { value: "all", label: t("ingredientsPage.filterAll", { count: counts.all }) },
    { value: "linked", label: t("ingredientsPage.filterLinked", { count: counts.linked }) },
    { value: "unlinked", label: t("ingredientsPage.filterUnlinked", { count: counts.unlinked }) },
    { value: "changed", label: t("ingredientsPage.filterChanged", { count: counts.changed }) },
  ];

  const currencyOptions = CURRENCIES.map((value) => ({ value, label: value }));

  return (
    <div className="space-y-6 pb-28">
      <header>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">{t("nav.ingredients")}</h1>
        <p className="mt-1 text-sm text-muted">{t("ingredientsPage.subtitle")}</p>
      </header>

      <Panel title={t("ingredientsPage.step1")} description={t("ingredientsPage.step1Hint")}>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            label={t("ingredientsPage.branch")}
            options={(branchList.data ?? []).map((row) => ({ value: toNumber(row.id), label: localizedRecord(row, language) || `#${row.id}` }))}
            value={branchId}
            placeholder={t("crud.choose")}
            onChange={pickBranch}
          />
          <SelectField
            label={t("ingredientsPage.menu")}
            options={menusOfBranch.map((menu) => ({ value: toNumber(menu.id), label: menuLabel(menu) }))}
            value={menuId}
            disabled={branchId === null}
            placeholder={branchId === null ? t("ingredientsPage.pickBranchFirst") : t("crud.choose")}
            onChange={pickMenu}
          />
        </div>
        {branchId !== null && menusOfBranch.length === 0 && menuList.isSuccess && (
          <p className="mt-3 text-sm text-warn">{t("ingredientsPage.noMenus")}</p>
        )}
      </Panel>

      {menuId === null && <EmptyState>{t("ingredientsPage.pickMenu")}</EmptyState>}

      {menuId !== null && (catalog.isError || links.isError) && (
        <ErrorState
          message={t("ingredientsPage.loadError")}
          onRetry={() => {
            void catalog.refetch();
            void links.refetch();
          }}
        />
      )}

      {menuId !== null && (catalog.isPending || links.isPending) && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-44" />
          ))}
        </div>
      )}

      {menuId !== null && catalog.isSuccess && links.isSuccess && (
        <>
          <Panel
            title={t("ingredientsPage.manage", { menu: menuLabel(menuList.data?.find((m) => toNumber(m.id) === menuId) ?? { id: menuId }) })}
            description={t("ingredientsPage.linkedCount", { count: linkedCount })}
            action={
              <Button variant="secondary" size="sm" disabled={!canCreate} onClick={() => setCatalogDialog({ mode: "create" })}>
                <Plus className="size-4" aria-hidden /> {t("ingredientsPage.newIngredient")}
              </Button>
            }
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-60 flex-1">
                <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setCardPage(1);
                  }}
                  placeholder={t("ingredientsPage.search")}
                  className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20 sm:h-10"
                />
              </div>
              <div role="radiogroup" aria-label={t("ingredientsPage.filterLabel")} className="grid grid-cols-2 gap-1 rounded-xl bg-line/50 p-1 sm:inline-flex sm:flex-wrap">
                {filters.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={filter === option.value}
                    onClick={() => {
                      setFilter(option.value);
                      setCardPage(1);
                    }}
                    className={clsx(
                      "h-11 cursor-pointer rounded-lg px-3 text-sm font-medium transition sm:h-8",
                      filter === option.value ? "bg-surface text-ink shadow-sm" : "text-ink-soft hover:text-ink"
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-xl bg-canvas/70 p-3 sm:flex sm:flex-wrap sm:items-end">
              <span className="self-center text-xs font-semibold text-muted">
                <Zap className="me-1 inline size-3.5" aria-hidden />
                {t("ingredientsPage.onVisible", { count: visible.length })}
              </span>
              <Button variant="ghost" size="sm" disabled={!canEdit || visibleUnlinked.length === 0}
                onClick={() => setRows(rows.map((row) => (visibleUnlinked.some((v) => v.id === row.id) ? linkRow(row) : row)))}>
                <Link2 className="size-4" aria-hidden /> {t("ingredientsPage.linkVisible", { count: visibleUnlinked.length })}
              </Button>
              <Button variant="ghost" size="sm" disabled={!canUnlink || visibleLinked.length === 0} onClick={() => setConfirmUnlink(true)}>
                <Link2Off className="size-4" aria-hidden /> {t("ingredientsPage.unlinkVisible", { count: visibleLinked.length })}
              </Button>
              <div className="w-full sm:w-32">
                <SelectField label={t("crud.field.currency")} options={currencyOptions} value={bulkCurrency} disabled={!canEdit} placeholder={t("crud.choose")} onChange={(value) => setBulkCurrency(value === null ? null : String(value))} />
              </div>
              <Button variant="ghost" size="sm" disabled={!canEdit || !bulkCurrency || visibleLinked.length === 0}
                onClick={() => {
                  setRows(rows.map((row) => (visibleLinked.some((v) => v.id === row.id) && bulkCurrency ? { ...row, currency: bulkCurrency } : row)));
                  toast.info(t("ingredientsPage.unified", { count: visibleLinked.length }));
                }}>
                <Check className="size-4" aria-hidden /> {t("ingredientsPage.unifyCurrency")}
              </Button>
              <div className="grid gap-2 sm:ms-auto sm:flex sm:flex-wrap sm:items-end">
                <div className="w-full sm:w-56">
                  <SelectField
                    label={t("ingredientsPage.copyFrom")}
                    options={menuList.data?.filter((menu) => toNumber(menu.id) !== menuId).map((menu) => ({ value: toNumber(menu.id), label: menuLabel(menu) })) ?? []}
                    value={copySourceId} disabled={!canEdit}
                    placeholder={t("crud.choose")}
                    onChange={(value) => setCopySourceId(value === null ? null : Number(value))}
                  />
                </div>
                <Button variant="ghost" size="sm" disabled={!canEdit || !copySourceLinks.data} onClick={copyPrices}>
                  {t("ingredientsPage.copy")}
                </Button>
              </div>
            </div>
          </Panel>

          {visible.length === 0 ? (
            <EmptyState>{rows.length === 0 ? t("ingredientsPage.noneAvailable") : t("ingredientsPage.noMatches")}</EmptyState>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cards.items.map((row) => (
                <IngredientCard
                  key={row.id}
                  row={row}
                  language={language}
                  disabled={save.isPending || !canEdit}
                  onToggle={() => (row.isLinked ? updateRow(row.id, { isLinked: false }) : setRows(rows.map((item) => (item.id === row.id ? linkRow(item) : item))))}
                  onPrice={(price) => updateRow(row.id, { price })}
                  onCurrency={(currency) => updateRow(row.id, { currency })}
                  onEdit={() => setCatalogDialog({ mode: "edit", ingredient: { id: row.id, name: row.name, nameAr: row.nameAr, image: row.image, status: row.status } })}
                />
              ))}
            </div>
          )}
          {visible.length > PAGE_SIZE && <Pagination meta={cards.meta} onPageChange={setCardPage} />}
        </>
      )}

      {canEdit && changedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6 lg:start-64">
          <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">
              <span className="font-semibold text-ink tabular-nums">{formatNumber(changedCount)}</span> {t("ingredientsPage.changed")}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="secondary" disabled={save.isPending} onClick={() => setDraft(null)}>
                {t("ingredientsPage.discard")}
              </Button>
              <Button className="bg-primary text-ink hover:bg-primary/90" disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? t("crud.saving") : t("ingredientsPage.save")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog
        open={confirmUnlink}
        onClose={() => setConfirmUnlink(false)}
        title={t("crud.deleteTitle")}
        description={t("ingredientsPage.unlinkConfirm", { count: visibleLinked.length, menu: menuLabel(menuList.data?.find((m) => toNumber(m.id) === menuId) ?? { id: menuId ?? 0 }) })}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmUnlink(false)}>{t("common.cancel")}</Button>
            <Button variant="danger" onClick={() => {
              const targets = new Set(visibleLinked.map((row) => row.id));
              setRows(rows.map((row) => (targets.has(row.id) ? { ...row, isLinked: false } : row)));
              setConfirmUnlink(false);
            }}>
              {t("ingredientsPage.unlinkNow")}
            </Button>
          </>
        }
      >
        <span className="sr-only">{t("ingredientsPage.unlinkWarning")}</span>
      </Dialog>

      {catalogDialog && menuId !== null && (
        <CatalogDialog
          state={catalogDialog}
          menuId={menuId}
          onClose={() => setCatalogDialog(null)}
        />
      )}
    </div>
  );
}

// المنصة لا تمنح صلاحية تعديل مكوّن في الكتالوج نفسه، فلا يظهر زر التعديل؛ الإنشاء وحده متاح.
const canEditCatalog = false;

/** بطاقة مكوّن: مفتاح الربط، واسمه، وسعره وعملته عند الربط، وزر تعديل الكتالوج. */
function IngredientCard({
  row,
  language,
  disabled,
  onToggle,
  onPrice,
  onCurrency,
  onEdit,
}: {
  row: IngredientRow;
  language: Language;
  disabled: boolean;
  onToggle: () => void;
  onPrice: (price: number) => void;
  onCurrency: (currency: string) => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation();
  const primary = language === "ar" ? row.nameAr || row.name : row.name || row.nameAr;
  const secondary = language === "ar" ? row.name : row.nameAr;
  const changed = hasChanged(row);
  const unnamed = t("common.unnamed");

  return (
    <article
      className={clsx(
        "flex flex-col gap-4 rounded-2xl border bg-surface p-4 transition sm:p-5",
        row.isLinked ? "border-primary/60 shadow-[0_6px_20px_-12px_rgba(254,197,95,0.9)]" : "border-line",
        changed && "ring-2 ring-primary/40"
      )}
    >
      <header className="flex items-start gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={row.isLinked}
          aria-label={t("ingredientsPage.linkToggle")}
          disabled={disabled}
          onClick={onToggle}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:opacity-50"
        >
          <span className={clsx("relative block h-6 w-11 rounded-full transition", row.isLinked ? "bg-primary" : "bg-line")}>
            <span
              className={clsx(
                "absolute top-0.5 size-5 rounded-full bg-surface shadow transition",
                row.isLinked ? "start-[1.375rem]" : "start-0.5"
              )}
            />
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{primary || unnamed}</p>
          {secondary && <p className="truncate text-xs text-muted">{secondary}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className={clsx("rounded-full px-2 py-0.5 font-medium", row.status === "active" ? "bg-ok-soft text-ok" : "bg-line/60 text-muted")}>
              {row.status === "active" ? t("ingredientsPage.active") : t("ingredientsPage.inactive")}
            </span>
            {changed && <span className="rounded-full bg-primary-soft px-2 py-0.5 font-medium text-ink">{t("ingredientsPage.modified")}</span>}
          </div>
        </div>

        {row.image ? (
          <img src={row.image} alt="" className="size-14 shrink-0 rounded-xl object-cover ring-1 ring-line" />
        ) : (
          <span className="grid size-14 shrink-0 place-items-center rounded-xl bg-canvas text-lg font-bold text-muted ring-1 ring-line">
            {(primary || "?").charAt(0)}
          </span>
        )}
      </header>

      {row.isLinked ? (
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Input
            label={t("ingredientsPage.price")}
            type="number"
            min="0"
            step="any"
            dir="ltr"
            value={row.price || ""}
            disabled={disabled}
            onChange={(event) => onPrice(Number(event.target.value) || 0)}
          />
          <SelectField
            label={t("crud.field.currency")}
            options={CURRENCIES.map((value) => ({ value, label: value }))}
            value={row.currency}
            disabled={disabled}
            onChange={(value) => onCurrency(value === null ? row.currency : String(value))}
          />
          {row.price > 0 && (
            <p className="col-span-2 text-sm font-semibold tabular-nums text-ink-soft">
              {formatMoney(row.price, row.currency)}
            </p>
          )}
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Link2Off className="size-4" aria-hidden /> {t("ingredientsPage.notLinked")}
        </p>
      )}

      <footer className="mt-auto flex justify-end">
        {canEditCatalog && <button type="button" onClick={onEdit} disabled={disabled}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-ink-soft ring-1 ring-line transition hover:ring-primary disabled:opacity-50">
          <Pencil className="size-3.5" aria-hidden /> {t("ingredientsPage.edit")}
        </button>}
      </footer>
    </article>
  );
}

/** إنشاء مكوّن كتالوجي أو تعديله من الشاشة نفسها، بالحقول التي يستقبلها الخادم. */
function CatalogDialog({
  state,
  menuId,
  onClose,
}: {
  state: { mode: "create" } | { mode: "edit"; ingredient: CatalogIngredient };
  menuId: number;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const initial = state.mode === "edit" ? state.ingredient : null;
  const [name, setName] = useState(initial?.name ?? "");
  const [nameAr, setNameAr] = useState(initial?.nameAr ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      if (state.mode === "create") {
        const form = new FormData();
        form.append("name", name.trim());
        form.append("name_ar", nameAr.trim());
        form.append("status", status);
        if (image) form.append("image", image);
        return ingredients.create(form);
      }
      const form = new FormData();
      form.append("id", String(state.ingredient.id));
      form.append("ingredients.name", name.trim());
      form.append("ingredients.name_ar", nameAr.trim());
      form.append("status", status);
      if (image) form.append("image", image);
      return menuIngredients.updateCatalog(menuId, state.ingredient.id, form);
    },
    onSuccess: async () => {
      toast.success(t(state.mode === "create" ? "ingredientsPage.created" : "ingredientsPage.updated"));
      await queryClient.invalidateQueries({ queryKey: ["ingredients-page", "catalog"] });
      onClose();
    },
    onError: (caught) => setError(caught instanceof ApiError ? caught.message : t("errors.unexpected")),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return setError(t("ingredientsPage.nameEnRequired"));
    if (!nameAr.trim()) return setError(t("ingredientsPage.nameArRequired"));
    setError(null);
    save.mutate();
  }

  return (
    <Dialog open onClose={onClose} title={t(state.mode === "create" ? "ingredientsPage.newTitle" : "ingredientsPage.editTitle")} fullOnMobile>
      <form onSubmit={submit} noValidate className="space-y-5">
        {error && <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={`${t("ingredientsPage.nameEn")}`} dir="ltr" required value={name} onChange={(event) => setName(event.target.value)} />
          <Input label={`${t("ingredientsPage.nameAr")}`} dir="rtl" required value={nameAr} onChange={(event) => setNameAr(event.target.value)} />
          <SelectField
            label={t("ingredientsPage.status")}
            options={[
              { value: "active", label: t("ingredientsPage.active") },
              { value: "inactive", label: t("ingredientsPage.inactive") },
            ]}
            value={status}
            onChange={(value) => setStatus(value === null ? "active" : String(value))}
          />
          <ImageField label={t("crud.field.image")} currentUrl={initial?.image ?? null} file={image} onChange={setImage} />
        </div>
        <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex justify-end gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mb-5 sm:px-6 sm:py-4 [&>*]:flex-1 sm:[&>*]:flex-none">
          <Button variant="secondary" onClick={onClose} disabled={save.isPending}>{t("common.cancel")}</Button>
          <Button type="submit" disabled={save.isPending} className="bg-primary text-ink hover:bg-primary/90">
            {save.isPending ? t("crud.saving") : t("crud.save")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
