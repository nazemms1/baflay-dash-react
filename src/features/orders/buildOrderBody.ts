/**
 * طلب الكاشير داخل الداشبورد: الطلب كله في نداء واحد، `POST admin/orders`. السلة تبقى على
 * الجهاز حتى الدفع، والخادم هو من يسعّر ويحدد القناة (داخلي أو خارجي) ويعيد الطلب.
 */

export type Variant = "sandwich" | "meal";

/** صلاحية الطلب من الكاشير؛ من لا يملكها لا يرى شاشة البيع. */
export const COUNTER_ORDER_PERMISSION = "admin.orders.counter.store";

/** أقصى كمية لكل سطر على الشباك: صنف أو برغر أو صلصة. */
export const TILL_MAX_QUANTITY = 50;

/** أقصى عدد إضافات لكل صنف، كما في الموقع الرسمي. */
export const MAX_ADD_ONS_PER_ITEM = 3;

/** الضريبة كما في نقطة البيع القديمة: 10%. عرضها تقديري، والإيصال يأخذ أرقام الخادم حين يعيدها. */
export const TAX_RATE = 0.1;

export const round2 = (value: number) => Math.round(value * 100) / 100;

let lineSequence = 0;
/** مفتاح محلي لكل سطر في السلة، لا يُرسل إلى الخادم. */
export const newLineKey = () => `line-${++lineSequence}`;

export interface ChoiceLine {
  id: number;
  name: string;
  price: number;
}

/** صنف في السلة. السعر لكل وحدة يشمل الكومبو والإضافات والصلصات. */
export interface CartItemLine {
  kind: "item";
  key: string;
  itemId: number;
  name: string;
  image: string | null;
  variant: Variant;
  addOns: ChoiceLine[];
  sauces: ChoiceLine[];
  notes: string;
  quantity: number;
  unitPrice: number;
  currency: string;
}

export interface BurgerIngredientLine {
  id: number;
  name: string;
  price: number;
  quantity: number;
}

/** برغر مخصص في السلة، والكمية عدد البرغرات المتطابقة. */
export interface CartBurgerLine {
  kind: "burger";
  key: string;
  ingredients: BurgerIngredientLine[];
  quantity: number;
  unitPrice: number;
  currency: string;
}

export type CartLine = CartItemLine | CartBurgerLine;
export type ItemDraft = Omit<CartItemLine, "kind" | "key">;
export type BurgerDraft = Omit<CartBurgerLine, "kind" | "key">;

/** المجاميع من السلة: تقدير محلي، والخادم يعيد الأرقام الرسمية. */
export function cartTotals(lines: CartLine[]) {
  const subtotal = round2(lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0));
  const tax = round2(subtotal * TAX_RATE);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

/**
 * جسم الطلب كما يقبله الخادم: الأصناف بإضافاتها، وكل برغر مخصص مرة لكل برغر (مكوناته
 * وكمياتها متوازية)، والصلصات مجمّعة بكمياتها. لا تُرسل القناة ولا المبالغ.
 */
export function buildCounterOrderBody(input: {
  branchId: number;
  lines: CartLine[];
  customerName: string;
  customerPhone: string;
}) {
  const items = input.lines.flatMap((line) =>
    line.kind === "item"
      ? [
          {
            item_id: line.itemId,
            quantity: line.quantity,
            variant: line.variant,
            add_ons: line.addOns.map((addOn) => ({ id: addOn.id, quantity: 1 })),
            notes: line.notes.trim(),
          },
        ]
      : []
  );

  const customBurgers = input.lines.flatMap((line) =>
    line.kind === "burger"
      ? Array.from({ length: line.quantity }, () => ({
          ingredients: line.ingredients.map((ingredient) => ingredient.id),
          quantity: line.ingredients.map((ingredient) => ingredient.quantity),
        }))
      : []
  );

  const sauces = new Map<number, number>();
  for (const line of input.lines) {
    if (line.kind !== "item") continue;
    for (const sauce of line.sauces) sauces.set(sauce.id, (sauces.get(sauce.id) ?? 0) + line.quantity);
  }

  const name = input.customerName.trim();
  const phone = input.customerPhone.trim();
  return {
    branch_id: input.branchId,
    items,
    custom_burgers: customBurgers,
    extras: [...sauces].map(([id, quantity]) => ({ id, quantity })),
    ...(name ? { customer_name: name } : {}),
    ...(phone ? { customer_phone: phone } : {}),
    payment_method: "cash" as const,
  };
}
