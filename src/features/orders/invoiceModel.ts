import type { currentLanguage } from "@/i18n";
import { asRecord, toNullableNumber, toNumber, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import type { Named } from "@/services";
import { POS_ORDER_NOTE } from "./posNote";

type Language = ReturnType<typeof currentLanguage>;
type Rec = Record<string, unknown>;

export interface InvoiceAddOn {
  name: string;
  quantity: number;
  amount: number;
}

export interface InvoiceLine {
  key: string;
  name: string;
  /** صورة الصنف، أو `null` إن لم تُرسَل. */
  image: string | null;
  variant: "sandwich" | "meal" | "custom";
  quantity: number;
  unitPrice: number;
  total: number;
  addOns: InvoiceAddOn[];
  notes: string;
}

export interface InvoiceSauce {
  key: string;
  name: string;
  quantity: number;
  amount: number;
}

export interface InvoiceModel {
  orderNumber: string;
  status: string;
  createdAt: string;
  branch: string;
  customer: string;
  orderType: "delivery" | "pickup";
  address: string;
  paymentMethod: string;
  currency: string;
  notes: string;
  lines: InvoiceLine[];
  sauces: InvoiceSauce[];
  itemsSubtotal: number;
  saucesTotal: number;
  deliveryFee: number;
  discount: number;
  totalDue: number;
}

/** أول قائمة غير فارغة من المرشّحين، كما كانت الفاتورة القديمة تبحث في أكثر من اسم. */
const rowsOf = (...candidates: unknown[]): unknown[] => {
  const found = candidates.find((value) => Array.isArray(value) && value.length > 0);
  return Array.isArray(found) ? found : [];
};

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** الرقم إن كان موجباً، وإلا `null` فيُستعمل الحساب المحلي. */
const positiveOr = (value: unknown): number | null => {
  const parsed = toNullableNumber(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const imageOf = (value: Rec): string | null => (typeof value.image === "string" && value.image ? value.image : null);

function toLine(row: Rec, index: number, language: Language): InvoiceLine {
  const item = asRecord(row.item);
  const quantity = toNumber(row.quantity) || 1;
  const unitPrice = toNumber(row.price) || toNumber(row.unit_price);
  const addOns = rowsOf(row.add_ons, row.extras).map((entry) => {
    const addOn = asRecord(entry);
    const addOnQuantity = toNumber(addOn.quantity) || 1;
    return {
      name: localizedRecord(addOn, language) || toText(addOn.name),
      quantity: addOnQuantity,
      amount: toNumber(addOn.price) * addOnQuantity,
    };
  });
  // إجمالي السطر من الخادم إن وُجد، وإلا (سعر الصنف + إضافاته) × الكمية كما في الموقع الرسمي.
  const computed = (unitPrice + sum(addOns.map((addOn) => addOn.amount))) * quantity;
  const serverTotal = toNumber(row.total_price);

  return {
    key: `${index}-${String(row.id ?? index)}`,
    // الاسم بلغة الواجهة: من البند، ثم من الصنف (فيه الاسم العربي)، ثم الاسم الإنجليزي المرسل.
    name:
      localizedRecord(row, language) ||
      localizedRecord(item, language) ||
      toText(row.item_name) ||
      `#${String(row.id ?? index)}`,
    // صورة الصنف من البند، وإلا من الصنف نفسه.
    image: imageOf(item) ?? imageOf(row),
    variant: row.is_custom_burger === true ? "custom" : toText(row.variant) === "meal" ? "meal" : "sandwich",
    quantity,
    unitPrice,
    total: serverTotal > 0 ? serverTotal : computed,
    addOns,
    notes: toText(row.notes),
  };
}

function toSauce(row: Rec, index: number, language: Language): InvoiceSauce {
  const quantity = toNumber(row.quantity) || 1;
  return {
    key: `sauce-${index}-${String(row.id ?? index)}`,
    name: localizedRecord(row, language) || toText(row.name),
    quantity,
    amount: toNumber(row.total) || toNumber(row.price) * quantity,
  };
}

/**
 * تحويل استجابة الفاتورة إلى نموذج عرض واحد. الحقول الناقصة تُكمَل من قائمة الطلبات،
 * والمجاميع من الخادم أولاً، ثم من الحساب المحلي إن لم يرسلها.
 */
export function toInvoiceModel(invoice: unknown, record: Named, language: Language): InvoiceModel {
  const inv = asRecord(invoice);
  // استجابة الفاتورة تسمّي البنود `lines`، وقائمة الطلبات تسمّيها `order_items`.
  const lines = rowsOf(inv.lines, inv.order_items, inv.items, record.order_items, record.items).map((entry, index) =>
    toLine(asRecord(entry), index, language)
  );
  const sauces = rowsOf(inv.extras, record.extras).map((entry, index) => toSauce(asRecord(entry), index, language));

  const itemsSubtotal = positiveOr(inv.items_subtotal) ?? positiveOr(inv.subtotal) ?? sum(lines.map((line) => line.total));
  const saucesTotal = positiveOr(inv.extras_total) ?? sum(sauces.map((sauce) => sauce.amount));
  const deliveryFee = toNumber(inv.delivery_fee);
  const discount = toNumber(inv.discount);
  const totalDue =
    positiveOr(inv.final_price) ?? positiveOr(inv.total) ?? itemsSubtotal + saucesTotal + deliveryFee - discount;

  const deliveryType = toText(inv.delivery_type) || toText(record.delivery_type);
  const rawNotes = toText(inv.notes) || toText(record.notes);

  return {
    orderNumber: toText(inv.order_number) || toText(record.order_number) || `#${String(record.id)}`,
    status: toText(inv.status) || toText(record.status),
    createdAt: toText(inv.placed_at) || toText(inv.created_at) || toText(record.created_at),
    branch:
      typeof inv.branch === "string"
        ? inv.branch
        : localizedRecord(asRecord(inv.branch), language) || localizedRecord(asRecord(record.branch), language) || toText(record.branch),
    customer:
      toText(asRecord(inv.customer).name) ||
      toText(inv.customer_name) ||
      toText(asRecord(record.customer).name) ||
      toText(record.customer_name),
    orderType: deliveryType === "delivery" ? "delivery" : "pickup",
    address: toText(inv.delivery_address) || toText(inv.address_details),
    paymentMethod: toText(inv.payment_method) || "cash",
    currency: toText(inv.currency) || toText(record.currency),
    // ملاحظة نقطة البيع تعني «داخل الصالة» وليست ملاحظة من الزبون، فلا تُعرض كملاحظة.
    notes: rawNotes === POS_ORDER_NOTE ? "" : rawNotes,
    lines,
    sauces,
    itemsSubtotal,
    saucesTotal,
    deliveryFee,
    discount,
    totalDue,
  };
}
