import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { usePublishedUpdate } from "./updateCheck";

const TOAST_ID = "app-update";

/**
 * يعرض تنبيه «يتوفر إصدار جديد» حين يُنشر بناء أحدث من المفتوح. يبقى حتى يُضغط «تحديث» أو يُخفى،
 * ولا يعود للبناء نفسه بعد إخفائه. التحديث إعادة تحميل عادية: الصفحة تُجلب من الشبكة دائماً.
 */
export function UpdatePrompt() {
  const published = usePublishedUpdate();

  useEffect(() => {
    if (!published) return;
    toast.custom((id) => <UpdateToast id={id} />, { id: TOAST_ID, duration: Infinity });
  }, [published]);

  return null;
}

function UpdateToast({ id }: { id: number | string }) {
  const { t } = useTranslation();

  return (
    <div className="flex w-[min(92vw,24rem)] items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_16px_40px_-16px_rgba(63,62,60,0.4)]">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-ink" aria-hidden>
        <RefreshCw className="size-5" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{t("pwa.updateTitle")}</p>
        <p className="mt-0.5 text-xs text-muted">{t("pwa.updateHint")}</p>
      </div>

      <button
        type="button"
        onClick={() => window.location.reload()}
        className="h-8 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-secondary transition hover:bg-secondary-soft"
      >
        {t("pwa.updateNow")}
      </button>

      <button
        type="button"
        aria-label={t("pwa.updateDismiss")}
        onClick={() => toast.dismiss(id)}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
