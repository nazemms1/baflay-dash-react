import { asRecord, toNumber, toText } from "@/lib/coerce";
import { formatMoney } from "@/lib/format";
import type { Named } from "@/services";

/** رقم الطلب كما يظهر للسائق والإدارة. */
export const refOf = (order: Named): string => toText(order.order_number) || `#${toNumber(order.id)}`;

export const customerOf = (order: Named) => asRecord(order.customer);

/** الدفع ببطاقة يعني ألا يُحصَّل كاش من الزبون، والباقي نقداً. */
export const isCardPayment = (order: Named): boolean => toText(order.payment_method) === "card";

export const amountOf = (order: Named): string =>
  formatMoney(toNumber(order.final_price), toText(order.currency));
