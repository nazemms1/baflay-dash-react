import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { EmptyState } from "@/components/ui/States";
import { Pagination } from "@/components/ui/Pagination";
import { PAGE_SIZE, pageOf } from "@/components/ui/paging";
import { DEFAULT_CURRENCY } from "@/features/ingredients/model";
import { usePermissions } from "@/features/auth/hooks";
import { useSession } from "@/features/auth/session-store";
import { currentLanguage } from "@/i18n";
import { asArray, asRecord, toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { formatMoney } from "@/lib/format";
import { localizedRecord } from "@/lib/localized";
import { counterOrders, menus, type Named } from "@/services";
import { orderRefusalMessage } from "./orderRefusal";
import {
  COUNTER_ORDER_PERMISSION,
  TILL_MAX_QUANTITY,
  buildCounterOrderBody,
  cartTotals,
  newLineKey,
  type BurgerDraft,
  type CartLine,
  type ItemDraft,
} from "./buildOrderBody";
import { CustomBurgerDialog } from "./CustomBurgerDialog";
import { ItemOptionsDialog, type MenuItemOption, type SuggestedItem } from "./ItemOptionsDialog";
import type { ReceiptData } from "./Receipt";

type Confirm = "pay" | "clear" | "discard";

interface Category {
  id: number;
  label: string;
  items: MenuItemOption[];
}

interface PosRegisterProps {
  branch: Named;
  menuId: number;
  onChangeBranch: () => void;
  onPaid: (receipt: ReceiptData) => void;
}

/**
 * شاشة البيع للكاشير: الأصناف مباشرة حسب التصنيف، والنقرة على الصنف تضيفه إلى السلة، وزر
 * الخيارات يفتح الساندويش أو الوجبة والإضافات والصلصات. السلة هنا على الجهاز، ولا يُنشأ
 * شيء في الخادم إلا عند الدفع، فيُرسل الطلب كله بنداء واحد، ويكون داخلياً بقرار الخادم.
 *
 * على الشاشات الواسعة السلة عمود جانبي ثابت. على الهاتف والتابلت شريط أسفل الشاشة يعرض
 * الإجمالي، ويفتح السلة نفسها في نافذة ملء الشاشة.
 */
export function PosRegister({ branch, menuId, onChangeBranch, onPaid }: PosRegisterProps) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const queryClient = useQueryClient();
  // الكاشير يحتاج صلاحية الطلب من الكاشير، ومن لا يملكها لا يُفعَّل أي زر.
  const canCreate = usePermissions().has(COUNTER_ORDER_PERMISSION);
  // اسم الكاشير المسجّل يظهر على الإيصال، فيُعرف من أصدر الفاتورة.
  const cashierName = useSession((state) => state.user?.name ?? "");

  const [active, setActive] = useState<number | "all" | null>(null);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<MenuItemOption | null>(null);
  const [burgerOpen, setBurgerOpen] = useState(false);
  const [tilePage, setTilePage] = useState(1);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  // السلة على الهاتف والتابلت نافذة تُفتح من الشريط السفلي.
  const [cartOpen, setCartOpen] = useState(false);

  const branchName = localizedRecord(branch, language) || `#${toNumber(branch.id)}`;
  const branchAddress = localizedRecord({ name: branch.address, name_ar: branch.address_ar }, language);

  const categories: Category[] = asArray(branch.categories).map((entry) => {
    const category = asRecord(entry);
    return {
      id: toNumber(category.id),
      label: localizedRecord(category, language) || `#${toNumber(category.id)}`,
      items: asArray(category.items).map((row) => {
        const item = asRecord(row);
        const id = toNumber(item.id);
        return {
          id,
          name: localizedRecord(item, language) || `#${id}`,
          image: typeof item.image === "string" && item.image ? item.image : null,
          price: toNumber(item.price),
          currency: toText(item.currency),
        };
      }),
    };
  });

  // الصنف قد يظهر في أكثر من تصنيف؛ البحث يعرضه مرة واحدة.
  const seen = new Map<number, MenuItemOption>();
  for (const category of categories) for (const item of category.items) seen.set(item.id, item);
  const allItems = [...seen.values()];

  const firstCategory = categories[0]?.id ?? "all";
  const current = active ?? firstCategory;
  const needle = search.trim().toLowerCase();
  const visible = needle
    ? allItems.filter((item) => item.name.toLowerCase().includes(needle))
    : current === "all"
      ? allItems
      : (categories.find((category) => category.id === current)?.items ?? []);

  // الأصناف تُعرض عشرين في الصفحة، فيُقسَم ما يطابق الفئة أو البحث.
  const tiles = pageOf(visible, tilePage);

  // سعر الكومبو والاقتراحات من القائمة نفسها، كما يفعل الموقع الرسمي.
  const menu = useQuery({
    queryKey: ["menu-detail", menuId],
    queryFn: ({ signal }) => menus.get(menuId, signal),
    staleTime: 5 * 60_000,
  });
  const menuOf = asRecord(menu.data);
  const comboPrice = toNullableNumber(menuOf.combo_price ?? asRecord(menuOf.combo).price);
  const comboName = localizedRecord(asRecord(menuOf.combo), language);
  const currency = toText(menuOf.currency) || allItems[0]?.currency || DEFAULT_CURRENCY;

  const suggestionsFor = (item: MenuItemOption): SuggestedItem[] => {
    const row = asArray(menuOf.items).map((entry) => asRecord(entry)).find((entry) => toNumber(entry.item_id ?? entry.id) === item.id);
    const ids = asArray(row?.suggested_item_ids ?? row?.suggestions).map((value) => toNumber(value));
    return ids.flatMap((id) => {
      const match = allItems.find((entry) => entry.id === id);
      return match ? [{ id, name: match.name, image: match.image, price: match.price, currency: match.currency || currency }] : [];
    });
  };

  const totals = cartTotals(lines);

  // كم قطعة من الصنف في السلة الآن، لتظهر على بطاقته فيعرف الكاشير أنه أُضيف.
  const countInCart = (itemId: number) =>
    lines.reduce((sum, line) => (line.kind === "item" && line.itemId === itemId ? sum + line.quantity : sum), 0);

  // السطر البسيط: صنف بلا خيارات، بالتعريف نفسه في addPlain. زر «−» على البطاقة ينقص منه وحده.
  const isPlainLine = (line: CartLine, itemId: number) =>
    line.kind === "item" &&
    line.itemId === itemId &&
    line.variant === "sandwich" &&
    line.addOns.length === 0 &&
    line.sauces.length === 0 &&
    line.notes === "";
  const hasPlain = (itemId: number) => lines.some((line) => isPlainLine(line, itemId));
  const removeOne = (itemId: number) =>
    setLines((current) => {
      const index = current.findIndex((line) => isPlainLine(line, itemId));
      if (index < 0) return current;
      const match = current[index];
      if (match.kind === "item" && match.quantity > 1) {
        return current.map((line, position) =>
          position === index && line.kind === "item" ? { ...line, quantity: line.quantity - 1 } : line
        );
      }
      return current.filter((_, position) => position !== index);
    });

  const lineName = (line: CartLine): string =>
    line.kind === "burger"
      ? t("createOrder.customBurgerName", {
          list: line.ingredients.map((ingredient) => `${ingredient.name} (${ingredient.quantity}x)`).join(" + "),
        })
      : line.name;

  const lineDetail = (line: CartLine): string => {
    if (line.kind === "burger") return "";
    const variantText =
      line.variant === "meal" ? [t("orderBuilder.meal"), comboName].filter(Boolean).join(" · ") : t("orderBuilder.sandwich");
    return [
      variantText,
      ...line.addOns.map((addOn) => `+ ${addOn.name}${addOn.quantity > 1 ? ` ×${addOn.quantity}` : ""}`),
      ...line.sauces.map((sauce) => `+ ${sauce.name}${sauce.quantity > 1 ? ` ×${sauce.quantity}` : ""}`),
      line.notes,
    ]
      .filter(Boolean)
      .join(" · ");
  };

  const addItem = (draft: ItemDraft) => {
    setLines((current) => [...current, { kind: "item", key: newLineKey(), ...draft }]);
    toast.success(t("orderBuilder.itemAdded"));
  };

  const addBurger = (draft: BurgerDraft) => {
    setLines((current) => [...current, { kind: "burger", key: newLineKey(), ...draft }]);
    toast.success(t("createOrder.burgerAdded"));
  };

  // صنف بلا خيارات يزيد كمية سطره إن وُجد، وإلا يُضاف سطر جديد. الاقتراحات تمر من هنا أيضاً.
  const addPlain = (item: MenuItemOption | SuggestedItem) => {
    setLines((current) => {
      const index = current.findIndex(
        (line) =>
          line.kind === "item" &&
          line.itemId === item.id &&
          line.variant === "sandwich" &&
          line.addOns.length === 0 &&
          line.sauces.length === 0 &&
          line.notes === ""
      );
      const match = index >= 0 ? current[index] : null;
      if (match && match.kind === "item" && match.quantity < TILL_MAX_QUANTITY) {
        return current.map((line, position) =>
          position === index && line.kind === "item" ? { ...line, quantity: line.quantity + 1 } : line
        );
      }
      return [
        ...current,
        {
          kind: "item",
          key: newLineKey(),
          itemId: item.id,
          name: item.name,
          image: item.image,
          variant: "sandwich",
          addOns: [],
          sauces: [],
          notes: "",
          quantity: 1,
          unitPrice: item.price,
          currency: item.currency || currency,
        },
      ];
    });
    toast.success(t("orderBuilder.itemAdded"));
  };

  const setQuantity = (key: string, quantity: number) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, quantity: Math.min(TILL_MAX_QUANTITY, Math.max(1, quantity)) } : line))
    );

  const removeLine = (key: string) => setLines((current) => current.filter((line) => line.key !== key));

  const clearCart = () => {
    setLines([]);
    setConfirm(null);
    toast.success(t("createOrder.cleared"));
  };

  // الطلب يُرسل مرة واحدة بنداء واحد. الخادم يعيد الطلب بعد قبوله؛ أرقامه الرسمية تُعرض في الإيصال.
  const pay = useMutation({
    mutationFn: () =>
      counterOrders.create(buildCounterOrderBody({ branchId: toNumber(branch.id), lines, customerName, customerPhone })),
    onSuccess: (result) => {
      const record = asRecord(result);
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onPaid({
        branchName,
        branchAddress,
        branchPhone: toText(branch.phone_number),
        cashierName,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        orderId: toNumber(record.id ?? record.order_id),
        status: toText(record.status) || "submitted",
        orderNumber: toText(record.order_number) || toText(record.id) || "—",
        time: new Date(),
        lines: lines.map((line) => ({
          name: lineName(line),
          detail: lineDetail(line),
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.unitPrice * line.quantity,
        })),
        subtotal: toNullableNumber(record.subtotal) ?? totals.subtotal,
        tax: toNullableNumber(record.tax ?? record.tax_amount) ?? totals.tax,
        total: toNullableNumber(record.total ?? record.final_price) ?? totals.total,
        currency,
      });
    },
    onError: (caught) => toast.error(orderRefusalMessage(caught, t, t("errors.unexpected"))),
  });

  const confirmCopy: Record<Confirm, { title: string; body: string; action: string; danger: boolean; run: () => void; busy: boolean }> = {
    pay: {
      title: t("createOrder.confirmPayment"),
      body: t("createOrder.confirmPaymentMessage", { total: formatMoney(totals.total, currency) }),
      action: t("createOrder.pay"),
      danger: false,
      run: () => pay.mutate(),
      busy: pay.isPending,
    },
    clear: {
      title: t("createOrder.clearCart"),
      body: t("createOrder.confirmClear"),
      action: t("createOrder.clearCart"),
      danger: true,
      run: clearCart,
      busy: false,
    },
    discard: {
      title: t("createOrder.discardCart"),
      body: t("createOrder.confirmDiscard"),
      action: t("createOrder.discardCart"),
      danger: true,
      run: onChangeBranch,
      busy: false,
    },
  };
  const activeConfirm = confirm ? confirmCopy[confirm] : null;

  const chips: { id: number | "all"; label: string }[] = [
    { id: "all", label: t("createOrder.all") },
    ...categories.map((category) => ({ id: category.id, label: category.label })),
  ];

  // محتوى السلة الواحد يُعرض في العمود الجانبي على الشاشات الواسعة، وفي النافذة على غيرها.
  const cartContent = (
    <>
      {lines.length === 0 ? (
        <EmptyState>{t("createOrder.emptyCart")}</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {lines.map((line) => (
            <li key={line.key} className="space-y-2 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{lineName(line)}</p>
                  {lineDetail(line) && <p className="text-xs text-muted">{lineDetail(line)}</p>}
                </div>
                <button
                  type="button"
                  aria-label={t("crud.delete")}
                  disabled={pay.isPending}
                  onClick={() => removeLine(line.key)}
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-lg text-secondary hover:bg-secondary-soft sm:size-8"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={t("createOrder.less")}
                    disabled={line.quantity <= 1 || pay.isPending}
                    onClick={() => setQuantity(line.key, line.quantity - 1)}
                    className="grid size-11 cursor-pointer place-items-center rounded-lg ring-1 ring-line disabled:opacity-40 sm:size-7"
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={t("createOrder.more")}
                    disabled={line.quantity >= TILL_MAX_QUANTITY || pay.isPending}
                    onClick={() => setQuantity(line.key, line.quantity + 1)}
                    className="grid size-11 cursor-pointer place-items-center rounded-lg ring-1 ring-line disabled:opacity-40 sm:size-7"
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </button>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatMoney(line.unitPrice * line.quantity, line.currency)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <dl className="mt-4 space-y-1 border-t border-line pt-4 text-sm">
          <div className="flex justify-between text-ink-soft">
            <dt>{t("createOrder.subtotal")}</dt>
            <dd className="tabular-nums">{formatMoney(totals.subtotal, currency)}</dd>
          </div>
          <div className="flex justify-between text-ink-soft">
            <dt>{t("createOrder.tax")}</dt>
            <dd className="tabular-nums">{formatMoney(totals.tax, currency)}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>{t("createOrder.total")}</dt>
            <dd className="tabular-nums">{formatMoney(totals.total, currency)}</dd>
          </div>
        </dl>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
        <Input
          label={t("createOrder.customerName")}
          value={customerName}
          maxLength={100}
          onChange={(event) => setCustomerName(event.target.value)}
        />
        <Input
          label={t("createOrder.customerPhone")}
          value={customerPhone}
          dir="ltr"
          inputMode="tel"
          maxLength={20}
          onChange={(event) => setCustomerPhone(event.target.value)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Button
          disabled={!canCreate || lines.length === 0 || pay.isPending}
          onClick={() => setConfirm("pay")}
          className="w-full bg-primary text-ink hover:bg-primary/90"
        >
          {t("createOrder.pay")}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="ghost" disabled={lines.length === 0 || pay.isPending} onClick={() => setConfirm("clear")}>
            {t("createOrder.clearCart")}
          </Button>
          <Button variant="danger" disabled={pay.isPending} onClick={() => setConfirm("discard")}>
            {t("createOrder.discardCart")}
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="grid gap-6 pb-28 lg:grid-cols-12 lg:pb-0">
      <section className="min-w-0 space-y-4 lg:col-span-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("createOrder.branchLabel")}</p>
            <h2 className="truncate text-lg font-bold text-ink">{branchName}</h2>
          </div>
          <Button variant="ghost" onClick={() => (lines.length > 0 ? setConfirm("discard") : onChangeBranch())}>
            {t("createOrder.changeBranch")}
          </Button>
        </header>

        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setTilePage(1);
            }}
            placeholder={t("crud.searchPlaceholder")}
            aria-label={t("crud.searchPlaceholder")}
            className="h-11 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/20"
          />
        </div>

        <Button disabled={!canCreate} onClick={() => setBurgerOpen(true)} className="w-full bg-primary text-ink hover:bg-primary/90">
          {t("createOrder.makeYourBurger")}
        </Button>

        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {chips.map((chip) => {
            const on = current === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setActive(chip.id);
                  setTilePage(1);
                }}
                className={`shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-sm font-medium transition sm:py-2 ${on ? "bg-primary text-ink" : "ring-1 ring-line hover:bg-primary-soft"}`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        {visible.length === 0 ? (
          <EmptyState>{t("createOrder.noItems")}</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {tiles.items.map((item) => (
              <li
                key={item.id}
                className={`relative flex flex-col overflow-hidden rounded-2xl border bg-surface transition hover:border-primary ${
                  countInCart(item.id) > 0 ? "border-primary ring-2 ring-primary/40" : "border-line"
                }`}
              >
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={() => addPlain(item)}
                  className="flex flex-1 cursor-pointer flex-col text-start disabled:opacity-60"
                >
                  {item.image ? (
                    <img src={item.image} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="grid aspect-square w-full place-items-center bg-canvas text-2xl font-bold text-muted">
                      {item.name.charAt(0)}
                    </span>
                  )}
                  <span className="space-y-1 p-3">
                    <span className="line-clamp-2 block text-sm font-medium">{item.name}</span>
                    <span className="block text-xs font-semibold tabular-nums text-ok">
                      {formatMoney(item.price, item.currency || currency)}
                    </span>
                  </span>
                </button>
                <div className="flex items-center justify-between border-t border-line">
                  <button
                    type="button"
                    aria-label={t("createOrder.less")}
                    disabled={!canCreate || !hasPlain(item.id)}
                    onClick={() => removeOne(item.id)}
                    className="grid size-11 cursor-pointer place-items-center rounded-lg text-secondary hover:bg-secondary-soft disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                  >
                    <Minus className="size-4" aria-hidden />
                  </button>
                  <span className="text-sm font-semibold tabular-nums">{countInCart(item.id)}</span>
                  <button
                    type="button"
                    aria-label={t("createOrder.more")}
                    disabled={!canCreate}
                    onClick={() => addPlain(item)}
                    className="grid size-11 cursor-pointer place-items-center rounded-lg text-ok hover:bg-ok-soft disabled:cursor-not-allowed disabled:opacity-40 sm:size-8"
                  >
                    <Plus className="size-4" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={!canCreate}
                  onClick={() => setPicked(item)}
                  className="min-h-11 cursor-pointer border-t border-line px-3 py-2 text-xs font-medium text-ink-soft hover:bg-primary-soft disabled:opacity-60 sm:min-h-0"
                >
                  {t("createOrder.options")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {visible.length > PAGE_SIZE && <Pagination meta={tiles.meta} onPageChange={setTilePage} />}
      </section>

      <aside className="hidden lg:sticky lg:top-4 lg:col-span-4 lg:block lg:self-start">
        <Panel title={t("createOrder.cart")}>{cartContent}</Panel>
      </aside>

      {/* على الهاتف والتابلت: الإجمالي وزر فتح السلة في شريط ثابت أسفل الشاشة. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">{t("createOrder.total")}</p>
            <p className="text-lg font-bold tabular-nums text-ink">{formatMoney(totals.total, currency)}</p>
          </div>
          <Button onClick={() => setCartOpen(true)} className="bg-primary text-ink hover:bg-primary/90">
            <ShoppingCart className="size-4" aria-hidden />
            {t("createOrder.openCart")}
          </Button>
        </div>
      </div>

      {cartOpen && (
        <Dialog open onClose={() => setCartOpen(false)} size="md" fullOnMobile title={t("createOrder.cart")}>
          {cartContent}
        </Dialog>
      )}

      <Dialog
        open={activeConfirm !== null}
        onClose={() => setConfirm(null)}
        size="md"
        title={activeConfirm?.title ?? ""}
        description={activeConfirm?.body}
        footer={
          activeConfirm && (
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)} disabled={activeConfirm.busy}>
                {t("common.cancel")}
              </Button>
              <Button
                onClick={activeConfirm.run}
                disabled={activeConfirm.busy}
                variant={activeConfirm.danger ? "danger" : "primary"}
                className={activeConfirm.danger ? undefined : "bg-primary text-ink hover:bg-primary/90"}
              >
                {activeConfirm.busy ? t("crud.saving") : activeConfirm.action}
              </Button>
            </>
          )
        }
      >
        {null}
      </Dialog>

      {burgerOpen && (
        <CustomBurgerDialog menuId={menuId} currency={currency} onAdd={addBurger} onClose={() => setBurgerOpen(false)} />
      )}

      {picked && (
        <ItemOptionsDialog
          menuId={menuId}
          item={picked}
          comboName={comboName}
          comboPrice={comboPrice}
          suggestions={suggestionsFor(picked)}
          currency={currency}
          onAdd={addItem}
          onAddSuggestion={(suggestion) => addPlain(suggestion)}
          onClose={() => setPicked(null)}
        />
      )}
    </div>
  );
}
