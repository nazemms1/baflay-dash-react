import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Bars";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { currentLanguage } from "@/i18n";
import { asArray, asRecord, toNumber, toText } from "@/lib/coerce";
import { formatMoney } from "@/lib/format";
import { localizedRecord } from "@/lib/localized";
import { menuIngredients } from "@/services";
import { TILL_MAX_QUANTITY, type BurgerDraft } from "./buildOrderBody";

type Language = ReturnType<typeof currentLanguage>;

interface BurgerIngredient {
  id: number;
  name: string;
  price: number;
  currency: string;
}

/**
 * مكونات القائمة الفعّالة فقط، كما تُعرض في نافذة البرغر القديمة. الحالة تأتي إما
 * مصفوفة مباشرة أو `{ data }` أو `{ ingredients }`.
 */
function activeIngredients(body: unknown, language: Language): BurgerIngredient[] {
  const root = asRecord(body);
  const rows = Array.isArray(body) ? body : Array.isArray(root.data) ? root.data : asArray(root.ingredients);

  return rows
    .map((entry) => asRecord(entry))
    .filter((row) => row.status === "active" || row.is_active === true)
    .map((row) => {
      const id = toNumber(row.ingredient_id ?? row.id);
      return {
        id,
        name: localizedRecord(row, language) || `#${id}`,
        price: toNumber(row.price),
        currency: toText(row.currency),
      };
    });
}

/**
 * صمّم برغر على ذوقك (MYB): يختار الكاشير مكونات البرغر وكمية كل مكون من مكونات
 * قائمة الفرع المسعّرة، ثم يُضاف البرغر إلى السلة. الكمية حتى 50 لكل مكوّن.
 */
export function CustomBurgerDialog({
  menuId,
  currency,
  onAdd,
  onClose,
}: {
  menuId: number;
  currency: string;
  onAdd: (draft: BurgerDraft) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const links = useQuery({
    queryKey: ["menu-ingredients", menuId],
    queryFn: ({ signal }) => menuIngredients.list(menuId, signal),
  });
  const ingredients = activeIngredients(links.data, language);

  const picked = ingredients.filter((row) => (quantities[row.id] ?? 0) > 0);
  const total = picked.reduce((sum, row) => sum + row.price * (quantities[row.id] ?? 0), 0);

  const submit = () => {
    onAdd({
      ingredients: picked.map((row) => ({
        id: row.id,
        name: row.name,
        price: row.price,
        quantity: quantities[row.id] ?? 0,
      })),
      quantity: 1,
      unitPrice: total,
      currency,
    });
    onClose();
  };

  const setQuantity = (id: number, quantity: number) =>
    setQuantities((current) => ({ ...current, [id]: Math.min(TILL_MAX_QUANTITY, Math.max(0, quantity)) }));

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={t("createOrder.burgerTitle")}
      description={t("createOrder.burgerHint")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={submit} disabled={picked.length === 0} className="bg-primary text-ink hover:bg-primary/90">
            {`${t("createOrder.addBurger")} · ${formatMoney(total, currency)}`}
          </Button>
        </>
      }
    >
      {links.isPending ? (
        <Skeleton className="h-64" />
      ) : links.isError ? (
        <ErrorState message={t("errors.unexpected")} onRetry={() => void links.refetch()} />
      ) : ingredients.length === 0 ? (
        <EmptyState>{t("createOrder.burgerEmpty")}</EmptyState>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {ingredients.map((row) => {
            const quantity = quantities[row.id] ?? 0;
            return (
              <li
                key={row.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${quantity > 0 ? "border-primary bg-primary-soft" : "border-line"}`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{row.name}</span>
                  <span className="block text-xs text-muted tabular-nums">{formatMoney(row.price, row.currency || currency)}</span>
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label={t("createOrder.less")}
                    disabled={quantity === 0}
                    onClick={() => setQuantity(row.id, quantity - 1)}
                    className="grid size-8 cursor-pointer place-items-center rounded-lg ring-1 ring-line disabled:opacity-40"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    aria-label={t("createOrder.more")}
                    disabled={quantity >= TILL_MAX_QUANTITY}
                    onClick={() => setQuantity(row.id, quantity + 1)}
                    className="grid size-8 cursor-pointer place-items-center rounded-lg ring-1 ring-line disabled:opacity-40"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Dialog>
  );
}
