import { currentLanguage } from "@/i18n";
import { asRecord, toText } from "@/lib/coerce";
import { localizedRecord } from "@/lib/localized";
import type { Named } from "@/services";

export type OrderType = "delivery" | "pickup";

/** نوع الطلب كما يعرفه الخادم: توصيل، أو استلام من الفرع (ومنه طلبات نقطة البيع). */
export const typeOf = (row: Named): OrderType => (toText(row.delivery_type) === "delivery" ? "delivery" : "pickup");

export const refOf = (row: Named) => toText(row.order_number) || `#${String(row.id)}`;

export const customerOf = (row: Named) => {
  const customer = asRecord(row.customer);
  return {
    name: toText(customer.name) || toText(row.customer_name) || "—",
    phone: toText(customer.phone),
  };
};

/** اسم الفرع: كما يرسله الخادم نصاً، أو من بيانات الفرع، أو من القائمة. */
export const branchOf = (row: Named, language: ReturnType<typeof currentLanguage>) =>
  typeof row.branch === "string"
    ? row.branch
    : localizedRecord(asRecord(row.branch), language) || localizedRecord(asRecord(row.menu), language) || "—";
