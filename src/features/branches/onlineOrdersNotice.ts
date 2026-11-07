import type { TFunction } from "i18next";
import { toast } from "sonner";
import { onlineStopOf } from "./branchStatus";

/**
 * إشعار نجاح حفظ مفتاح توصيل أو استلام أو دفع. إن أوقف الحفظ الطلب الأونلاين (التوصيل والاستلام معاً، أو
 * الكاش والبطاقة معاً) يُنبَّه المشغّل أن الفرع ما زال مفتوحاً وأن الأونلاين وحده متوقف، مع السبب إن أرسله
 * الخادم. وإلا فهو إشعار نجاح عادي.
 */
export function notifySaved(result: unknown, savedText: string, t: TFunction): void {
  const { stopped, reason } = onlineStopOf(result);
  if (!stopped) {
    toast.success(savedText);
    return;
  }
  const why = reason ? t(`branchStatus.onlineReason.${reason}`, { defaultValue: "" }) : "";
  toast.warning(why ? `${t("onlineOrders.stopped")} (${why})` : t("onlineOrders.stopped"));
}
