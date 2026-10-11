import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Bars";
import { ErrorState } from "@/components/ui/States";
import { asArray, asRecord, toNumber } from "@/lib/coerce";
import { currentLanguage } from "@/i18n";
import { formatMoney } from "@/lib/format";
import { normalizeLinks } from "@/features/ingredients/model";
import { useIngredientDetails } from "@/features/ingredients/details";
import { itemAddOns, menuIngredients, orderExtras } from "@/services";
import { MAX_ADD_ONS_PER_ITEM, TILL_MAX_QUANTITY, type ItemDraft, type Variant } from "./buildOrderBody";

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
 * نافذة اختيار الصنف للكاشير: الساندويش أو الوجبة، والكمية حتى 50، والإضافات حتى 3،
 * والصلصات بلا حد، والاقتراحات تُضاف سطراً مستقلاً. النافذة لا ترسل شيئاً: تضيف السطر
 * إلى السلة، والطلب كله يُرسل مرة واحدة عند الدفع.
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
  const language = currentLanguage();

  const [variant, setVariant] = useState<Variant>("sandwich");
  const [quantity, setQuantity] = useState(1);
  const [addOnIds, setAddOnIds] = useState<number[]>([]);
  const [sauceIds, setSauceIds] = useState<number[]>([]);
  // عدد مرات إضافة كل اقتراح من هذه النافذة.
  const [addedSuggestions, setAddedSuggestions] = useState<Record<number, number>>({});
  const [note, setNote] = useState("");

  // الإضافات المعروضة: إضافات الصنف، ومسعّرة في هذه القائمة فقط.
  const addOnsOfItem = useQuery({
    queryKey: ["item-addons", item.id],
    queryFn: async () => asArray(asRecord(await itemAddOns.get(item.id)).ingredient_ids).map((value) => toNumber(value)),
  });
  // الصلصات: الإضافات العامة للبراند.
  const brandSauces = useQuery({
    queryKey: ["order-extras"],
    queryFn: async () => asArray(asRecord(await orderExtras.get()).ingredient_ids).map((value) => toNumber(value)),
  });
  // أسعار المكونات داخل هذه القائمة، وهي التي تحدد ما يُعرض للزبون وبأي سعر.
  const pricedHere = useQuery({
    queryKey: ["ingredients-page", "links", menuId],
    queryFn: async ({ signal }) => normalizeLinks(await menuIngredients.list(menuId, signal)),
  });
  // أسماء الإضافات وصورها تُطلب للمسعّر في هذه القائمة فقط، كلٌّ مرة واحدة وتبقى في الذاكرة المؤقتة.
  const pricedIds = new Set((pricedHere.data ?? []).map((link) => link.ingredientId));
  const shownIds = [...new Set([...(addOnsOfItem.data ?? []), ...(brandSauces.data ?? [])])].filter((id) =>
    pricedIds.has(id)
  );
  const details = useIngredientDetails(shownIds);

  const loading = addOnsOfItem.isPending || brandSauces.isPending || pricedHere.isPending;
  const failed = addOnsOfItem.isError || brandSauces.isError || pricedHere.isError;

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
  const addOnRows = useMemo(
    () => rowsFor(addOnsOfItem.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [addOnsOfItem.data, pricedHere.data, details, language]
  );
  const sauceRows = useMemo(
    () => rowsFor(brandSauces.data ?? []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [brandSauces.data, pricedHere.data, details, language]
  );

  const basePrice = variant === "meal" ? item.price + Number(comboPrice ?? 0) : item.price;
  const chosenAddOns = addOnRows.filter((row) => addOnIds.includes(row.id));
  const chosenSauces = sauceRows.filter((row) => sauceIds.includes(row.id));
  const addOnsTotal = chosenAddOns.reduce((sum, row) => sum + row.price, 0);
  const saucesTotal = chosenSauces.reduce((sum, row) => sum + row.price, 0);
  // السعر لكل وحدة: الأساس والإضافات والصلصات، والسطر كله يُضرب في الكمية.
  const unitTotal = basePrice + addOnsTotal + saucesTotal;
  const orderTotal = unitTotal * quantity;

  const toggle = (list: number[], id: number, max: number | null, set: (next: number[]) => void) => {
    if (list.includes(id)) return set(list.filter((value) => value !== id));
    if (max !== null && list.length >= max) return;
    set([...list, id]);
  };

  const submit = () => {
    onAdd({
      itemId: item.id,
      name: item.name,
      image: item.image,
      variant,
      addOns: chosenAddOns.map((row) => ({ id: row.id, name: row.label, price: row.price })),
      sauces: chosenSauces.map((row) => ({ id: row.id, name: row.label, price: row.price })),
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
      {failed && <ErrorState message={t("errors.unexpected")} onRetry={() => { void addOnsOfItem.refetch(); void brandSauces.refetch(); void pricedHere.refetch(); }} />}

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
            <OptionGroup
              title={t("orderBuilder.addOns", { max: MAX_ADD_ONS_PER_ITEM })}
              rows={addOnRows}
              selected={addOnIds}
              onToggle={(id) => toggle(addOnIds, id, MAX_ADD_ONS_PER_ITEM, setAddOnIds)}
              currency={currency}
            />
          )}

          {sauceRows.length > 0 && (
            <OptionGroup
              title={t("orderBuilder.sauces")}
              rows={sauceRows}
              selected={sauceIds}
              onToggle={(id) => toggle(sauceIds, id, null, setSauceIds)}
              currency={currency}
            />
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

function OptionGroup({
  title,
  rows,
  selected,
  onToggle,
  currency,
}: {
  title: string;
  rows: ChoiceRow[];
  selected: number[];
  onToggle: (id: number) => void;
  currency: string;
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
        {rows.map((row) => {
          const on = selected.includes(row.id);
          return (
            <li key={row.id}>
              <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${on ? "border-primary bg-primary-soft" : "border-line"}`}>
                <span className="flex min-w-0 items-center gap-3">
                  <input type="checkbox" checked={on} onChange={() => onToggle(row.id)} className="size-4 shrink-0 accent-secondary" />
                  <Thumb src={row.image} name={row.label} />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="shrink-0 text-xs text-muted tabular-nums">{formatMoney(row.price, row.currency || currency)}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
