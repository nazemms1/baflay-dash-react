import { createElement } from "react";
import { toast } from "sonner";
import { NewOrdersToast } from "./NewOrdersToast";

/** يعرض بطاقة التنبيه ثماني ثوانٍ. الزر الأول ينقل القائمة إلى أحدث الطلبات. */
export function showNewOrdersToast(count: number, onView?: () => void) {
  toast.custom((id) => createElement(NewOrdersToast, { id, count, onView }), { duration: 8000 });
}
