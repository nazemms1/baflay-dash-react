import { toText } from "@/lib/coerce";
import type { Named } from "@/services";
import { isFinalOrder } from "./orderStatus";

/** مراحل تمنع تغيير السائق: بعد الاستلام من الفرع لا يُسحب الطلب من سائقه. */
const LOCKED_STATUSES = ["on_the_way", "completed", "delivery_failed"];

/** الإسناد والسحب للتوصيل قبل الاستلام من الفرع فقط، والخادم يفرض القاعدة نفسها. */
export const canAssignDriver = (row: Named): boolean =>
  toText(row.delivery_type) === "delivery" &&
  !isFinalOrder(row) &&
  !toText(row.picked_up_at) &&
  !LOCKED_STATUSES.includes(toText(row.status));
