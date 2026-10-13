import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { asArray, asRecord, toNumber } from "@/lib/coerce";
import { formatMoney } from "@/lib/format";
import { normalizeLinks } from "@/features/ingredients/model";
import { useIngredientDetails } from "@/features/ingredients/details";
import { itemAddOns, menuApi, menuIngredients, orderExtras } from "@/services";
import { MAX_ADD_ONS_PER_ITEM, TILL_MAX_QUANTITY, type ItemDraft, type Variant } from "./buildOrderBody";
import { offeredExtraIds, visibleExtras } from "./offeredExtras";

export interface MenuItemOption {
  id: number;
  name: string;
  image: string | null;
  price: number;
  currency: string;
}

export interface SuggestedItem {
  id: number;
  name: string;
  image: string | null;
  price: number;
  currency: string;
}

interface ChoiceRow {
  id: number;
  label: string;
  image: string | null;
  price: number;
  currency: string;
}

/**
 * نافذة اختيار الصنف للكاشير: الساندويش أو الوجبة، والكمية حتى 50، والإضافات حتى 3 (مجموع
 * كمياتها، كما في الموقع)، والصلصات بكميات بلا حد، والاقتراحات تُضاف سطراً مستقلاً.
 * النافذة لا ترسل شيئاً: تضيف السطر إلى السلة، والطلب كله يُرسل مرة واحدة عند الدفع.
 */
export function ItemOptionsDialog({
  menuId,
  item,
  comboName,
  comboPrice,
  suggestions,
  currency,
  onAdd,
  onAddSuggestion,
  onClose,
}: {
  menuId: number;
  item: MenuItemOption;
  comboName: string;
  comboPrice: number | null;
  suggestions: SuggestedItem[];
  currency: string;
  onAdd: (draft: ItemDraft) => void;
  onAddSuggestion: (suggestion: SuggestedItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();

  const [variant, setVariant] = useState<Variant>("sandwich");
  const [quantity, setQuantity] = useState(1);
  // كمية كل إضافة وكل صلصة في هذا الصنف، والصفر يعني غير مختارة.
  const [addOnQty, setAddOnQty] = useState<Record<number, number>>({});
  const [sauceQty, setSauceQty] = useState<Record<number, number>>({});
  // عدد مرات إضافة كل اقتراح من هذه النافذة.
  const [addedSuggestions, setAddedSuggestions] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");

  // الإضافات المعروضة: إضافات الصنف، ومسعّرة في هذه القائمة فقط.
  const addOnsOfItem = useQuery({
    // مفتاح خاص بالكاشير: شاشة الصنف تحفظ تحت المفتاح نفسه كائناً، لا قائمة معرّفات.
    queryKey: ["pos-item-addons", item.id],
    queryFn: async () => asArray(asRecord(await itemAddOns.get(item.id)).ingredient_ids).map((value) => toNumber(value)),
  });
  // الصلصات: الإضافات العامة للبراند.
  const brandSauces = useQuery({
    queryKey: ["order-extras"],
    queryFn: async () => asArray(asRecord(await orderExtras.get()).ingredient_ids).map((value) => toNumber(value)),
  });
  // القائمة العامة للفرع: تعرض ما يقبله الفرع فعلاً، والإضافات التي أطفأها الفرع تغيب منها.
  // بلا تخزين مؤقت: كل فتح للنافذة يجلبها من جديد، فلا تبقى إضافة أطفأها الفرع للتو.
  const publicMenu = useQuery({
    queryKey: ["pos-menu-offer", menuId],
    queryFn: () => menuApi.publicGet(menuId),
    staleTime: 0,
  });
  // أسعار المكونات داخل هذه القائمة، وهي التي تحدد ما يُعرض للزبون وبأي سعر.
  const pricedHere = useQuery({
    queryKey: ["ingredients-page", "links", menuId],
    queryFn: async ({ signal }) => normalizeLinks(await menuIngredients.list(menuId, signal)),
  });
  // أسماء الإضافات وصورها تُطلب للمسعّر في هذه القائمة فقط، كلٌّ مرة واحدة وتبقى في الذاكرة المؤقتة.
  const pricedIds = new Set((pricedHere.data ?? []).map((link) => link.ingredientId));
  // ما يعرضه الفرع فعلاً: الصلصات من إضافات البراند المعروضة، والإضافات بعد استبعاد ما أطفأه الفرع.
  const offered = offeredExtraIds(publicMenu.data);
  const visible = visibleExtras({
    brandExtras: asArray<number>(brandSauces.data),
    itemAddOns: asArray<number>(addOnsOfItem.data),
    offered,
  });
  const shownIds = [...new Set([...visible.addOns, ...visible.sauces])].filter((id) => pricedIds.has(id));
  const details = useIngredientDetails(shownIds);

  const loading = addOnsOfItem.isPending || brandSauces.isPending || pricedHere.isPending || publicMenu.isPending;
  const failed = addOnsOfItem.isError || brandSauces.isError || pricedHere.isError || publicMenu.isError;

  const rowsFor = (ids: number[]): ChoiceRow[] => {
    const prices = new Map((pricedHere.data ?? []).map((link) => [link.ingredientId, link]));
    return ids.flatMap((id) => {
      const link = prices.get(id);
      if (!link) return [];
      const detail = details.get(id);
      return [
        {
          id,
          label: detail?.label ?? `#${id}`,
          image: detail?.image ?? null,
          price: link.price,
          currency: link.currency,
        },
      ];
    });
  };
  const addOnRows = rowsFor(visible.addOns);
  const sauceRows = rowsFor(visible.sauces);

  const basePrice = variant === "meal" ? item.price + Number(comboPrice ?? 0) : item.price;
  const chosenAddOns = addOnRows
    .filter((row) => (addOnQty[row.id] ?? 0) > 0)
    .map((row) => ({ ...row, quantity: addOnQty[row.id] ?? 0 }));
  const chosenSauces = sauceRows
    .filter((row) => (sauceQty[row.id] ?? 0) > 0)
    .map((row) => ({ ...row, quantity: sauceQty[row.id] ?? 0 }));
  const addOnCount = chosenAddOns.reduce((sum, row) => sum + row.quantity, 0);
  const addOnsTotal = chosenAddOns.reduce((sum, row) => sum + row.price * row.quantity, 0);
  const saucesTotal = chosenSauces.reduce((sum, row) => sum + row.price * row.quantity, 0);
  // السعر لكل وحدة: الأساس والإضافات والصلصات بكمياتها، والسطر كله يُضرب في الكمية.
  const unitTotal = basePrice + addOnsTotal + saucesTotal;
  const orderTotal = unitTotal * quantity;

  /** إضافات الصنف: الحد على مجموع الكميات، كما في الموقع. لا تتجاوز الكمية الإجمالية الحد. */
  const stepAddOn = (id: number, delta: number) =>
    setAddOnQty((current) => {
      const count = Object.values(current).reduce((sum, value) => sum + value, 0);
      if (delta > 0 && count >= MAX_ADD_ONS_PER_ITEM) return current;
      return { ...current, [id]: Math.max(0, Math.min(TILL_MAX_QUANTITY, (current[id] ?? 0) + delta)) };
    });

  /** الصلصات بلا حد للإضافات، والسقف الوحيد حد الكمية لكل سطر. */
  const stepSauce = (id: number, delta: number) =>
    setSauceQty((current) => ({
      ...current,
      [id]: Math.max(0, Math.min(TILL_MAX_QUANTITY, (current[id] ?? 0) + delta)),
    }));

  const submit = () => {
    onAdd({
      itemId: item.id,
      name: item.name,
      image: item.image,
      variant,
      addOns: chosenAddOns.map((row) => ({ id: row.id, name: row.label, price: row.price, quantity: row.quantity })),
      sauces: chosenSauces.map((row) => ({ id: row.id, name: row.label, price: row.price, quantity: row.quantity })),
      notes: note.trim(),
      quantity,
      unitPrice: unitTotal,
      currency,
    });
    onClose();
  };

  // الاقتراح يُضاف إلى السلة فور اختياره، سطراً مستقلاً بكمية 1.
  const suggest = (suggestion: SuggestedItem) => {
    onAddSuggestion(suggestion);
    setAddedSuggestions((current) => ({ ...current, [suggestion.id]: (current[suggestion.id] ?? 0) + 1 }));
  };

  const canMeal = comboPrice !== null && comboPrice > 0;

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={item.name}
      description={formatMoney(item.price, currency)}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={loading || failed} className="bg-primary text-ink hover:bg-primary/90">
            {`${t("orderBuilder.addToOrder")} · ${formatMoney(orderTotal, currency)}`}
          </Button>
        </>
      }
    >
      {loading && <Skeleton className="h-64" />}
      {failed && <ErrorState message={t("errors.unexpected")} onRetry={() => { void addOnsOfItem.refetch(); void brandSauces.refetch(); void pricedHere.refetch(); void publicMenu.refetch(); }} />}

      {!loading && !failed && (
        <div className="space-y-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-ink">{t("orderBuilder.variant")}</h3>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setVariant("sandwich")} aria-pressed={variant === "sandwich"}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-start text-sm font-medium ${variant === "sandwich" ? "border-primary bg-primary-soft" : "border-line"}`}>
                {t("orderBuilder.sandwich")}
                <span className="block text-xs text-muted tabular-nums">{formatMoney(item.price, currency)}</span>
              </button>
              <button type="button" onClick={() => canMeal && setVariant("meal")} aria-pressed={variant === "meal"} disabled={!canMeal}
                className={`cursor-pointer rounded-xl border px-4 py-3 text-start text-sm disabled:cursor-not-allowed disabled:opacity-40 ${variant === "meal" ? "border-primary bg-primary-soft" : "border-line"}`}>
                <span className="block font-medium">{t("orderBuilder.meal")}</span>
                {canMeal ? (
                  <>
                    {comboName && <span className="mt-1 block text-ink">{t("orderBuilder.mealIncludes", { name: comboName })}</span>}
                    <span className="block text-xs text-muted tabular-nums">
                      {t("orderBuilder.comboPrice", { price: formatMoney(Number(comboPrice), currency) })} · {formatMoney(item.price + Number(comboPrice), currency)}
                    </span>
                  </>
                ) : (
                  <span className="block text-xs text-muted">{t("orderBuilder.noCombo")}</span>
                )}
              </button>
            </div>
          </section>

          <section className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-ink">{t("orderBuilder.quantity")}</h3>
            <div className="flex items-center gap-2">
              <button type="button" aria-label={t("createOrder.less")} disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}
                className="grid size-9 cursor-pointer place-items-center rounded-lg ring-1 ring-line disabled:opacity-40">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="w-8 text-center font-semibold tabular-nums">{quantity}</span>
              <button type="button" aria-label={t("createOrder.more")} disabled={quantity >= TILL_MAX_QUANTITY} onClick={() => setQuantity(quantity + 1)}
                className="grid size-9 cursor-pointer place-items-center rounded-lg ring-1 ring-line disabled:opacity-40">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
          </section>

          {addOnRows.length > 0 && (
            <AddOnGroup
              rows={addOnRows}
              quantities={addOnQty}
              count={addOnCount}
              limit={MAX_ADD_ONS_PER_ITEM}
              onStep={stepAddOn}
              currency={currency}
            />
          )}

          {sauceRows.length > 0 && (
            <ExtraGroup rows={sauceRows} quantities={sauceQty} onStep={stepSauce} currency={currency} />
          )}

          {suggestions.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-ink">{t("orderBuilder.suggestions")}</h3>
              <p className="text-xs text-muted">{t("orderBuilder.suggestionsHint")}</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => {
                  const count = addedSuggestions[suggestion.id] ?? 0;
                  return (
                    <li key={suggestion.id}>
                      <button type="button" onClick={() => suggest(suggestion)}
                        className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-line px-3 py-2 text-start text-sm transition hover:border-primary hover:bg-primary-soft">
                        <span className="flex min-w-0 items-center gap-3">
                          <Thumb src={suggestion.image} name={suggestion.name} />
                          <span className="truncate">{suggestion.name}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {count > 0 && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-ink tabular-nums">×{count}</span>
                          )}
                          <span className="text-xs text-muted tabular-nums">{formatMoney(suggestion.price, suggestion.currency || currency)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="space-y-2">
            <label htmlFor="item-note" className="text-sm font-semibold text-ink">{t("orderBuilder.note")}</label>
            <textarea id="item-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)}
              className="w-full rounded-xl border border-line bg-surface p-3 text-sm outline-none focus:border-primary" />
          </section>

          <p className="text-sm text-ink-soft">
            {t("orderBuilder.unitTotal")}: <span className="font-semibold tabular-nums text-ink">{formatMoney(unitTotal, currency)}</span>
          </p>
        </div>
      )}
    </Dialog>
  );
}

/** صورة الصنف أو المكوّن، وإن غابت فحرفه الأول كما في شبكة الأصناف. */
function Thumb({ src, name }: { src: string | null; name: string }) {
  return src ? (
    <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover ring-1 ring-line" />
  ) : (
    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-canvas font-bold text-muted ring-1 ring-line">
      {name.charAt(0)}
    </span>
  );
}

/**
 * بطاقة الخيار كما في الموقع: صورة وتسمية وسعر في صف واحد. غير المختار يُضغط فيُضاف واحد،
 * والمختار يظهر بعدّاد (− كمية +). الزيادة تُعطَّل حين يبلغ الحد، فلا يجرّب الكاشير ما لا يُقبل.
 */
function OptionCard({
  row,
  qty,
  currency,
  blocked,
  onStep,
}: {
  row: ChoiceRow;
  qty: number;
  currency: string;
  blocked: boolean;
  onStep: (delta: number) => void;
}) {
  const { t } = useTranslation();
  const on = qty > 0;

  const body = (
    <>
      <Thumb src={row.image} name={row.label} />
      <span className="min-w-0 flex-1 text-start">
        <span className="line-clamp-2 block text-sm font-bold leading-snug text-ink">{row.label}</span>
        <span className={`mt-0.5 block text-xs font-semibold tabular-nums ${on ? "text-secondary" : "text-muted"}`}>
          {row.price > 0 ? `+ ${formatMoney(row.price, row.currency || currency)}` : t("orderBuilder.free")}
        </span>
      </span>
    </>
  );

  const cardClass = `flex w-full items-center gap-2.5 rounded-xl border-[1.5px] p-2.5 transition ${
    on ? "border-primary bg-primary-soft" : "border-line bg-surface"
  }`;

  if (!on) {
    return (
      <button
        type="button"
        disabled={blocked}
        onClick={() => onStep(1)}
        className={`${cardClass} cursor-pointer hover:border-primary disabled:cursor-not-allowed disabled:opacity-40`}
      >
        {body}
        <span className="grid size-6 shrink-0 place-items-center rounded-full border-[1.5px] border-line text-muted">
          <Plus className="size-3" aria-hidden />
        </span>
      </button>
    );
  }

  return (
    <div className={cardClass}>
      {body}
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border-[1.5px] border-primary bg-surface px-1">
        <button
          type="button"
          aria-label={t("createOrder.less")}
          onClick={() => onStep(-1)}
          className="grid size-6 cursor-pointer place-items-center text-secondary"
        >
          <Minus className="size-3.5" aria-hidden />
        </button>
        <span className="min-w-3.5 text-center text-sm font-bold tabular-nums text-ink">{qty}</span>
        <button
          type="button"
          aria-label={t("createOrder.more")}
          disabled={blocked}
          onClick={() => onStep(1)}
          className="grid size-6 cursor-pointer place-items-center text-secondary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
      </span>
    </div>
  );
}

/**
 * إضافات الصنف (Add-on): بطاقات بعدّادات، والحد على مجموع الكميات. الحد يظهر بجانب العنوان،
 * ومن بلغه تُعطَّل الزيادة فيعرف الكاشير أين وصل.
 */
function AddOnGroup({
  rows,
  quantities,
  count,
  limit,
  onStep,
  currency,
}: {
  rows: ChoiceRow[];
  quantities: Record<number, number>;
  count: number;
  limit: number;
  onStep: (id: number, delta: number) => void;
  currency: string;
}) {
  const { t } = useTranslation();
  const full = count >= limit;

  return (
    <section className="space-y-3 rounded-2xl border border-primary/50 bg-primary-soft/30 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">{t("orderBuilder.addOnsHeading")}</h3>
          <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-ink">Add-on</span>
        </div>
        <span className="text-xs font-semibold tabular-nums text-ink-soft">
          {t("orderBuilder.addOnsCounter", { count, max: limit })}
        </span>
      </header>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.id}>
            <OptionCard
              row={row}
              qty={quantities[row.id] ?? 0}
              currency={currency}
              blocked={full}
              onStep={(delta) => onStep(row.id, delta)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * الإضافات العامة (Extra): صلصات الفرع، لكل صلصة عدّادها بلا حد (السقف الوحيد حد السطر).
 * تُعرض بالبطاقة نفسها كما في الموقع، ويفصلها عن إضافات الصنف عنوانها وشارتها.
 */
function ExtraGroup({
  rows,
  quantities,
  onStep,
  currency,
}: {
  rows: ChoiceRow[];
  quantities: Record<number, number>;
  onStep: (id: number, delta: number) => void;
  currency: string;
}) {
  const { t } = useTranslation();

  return (
    <section className="space-y-3 rounded-2xl border border-secondary/40 bg-secondary-soft/30 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-ink">{t("orderBuilder.extrasHeading")}</h3>
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-surface">Extra</span>
        </div>
        <span className="text-xs text-muted">{t("orderBuilder.extrasNoLimit")}</span>
      </header>
      <ul className="grid gap-2.5 sm:grid-cols-2">
        {rows.map((row) => {
          const qty = quantities[row.id] ?? 0;
          return (
            <li key={row.id}>
              <OptionCard
                row={row}
                qty={qty}
                currency={currency}
                blocked={qty >= TILL_MAX_QUANTITY}
                onStep={(delta) => onStep(row.id, delta)}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
