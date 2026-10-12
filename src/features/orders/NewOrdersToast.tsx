import { BellRing, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

interface NewOrdersToastProps {
  id: number | string;
  count: number;
  onView?: () => void;
}

/** بطاقة تنبيه الطلبات الجديدة، بألوان الهوية. العنوان يتبع الجمع في كل لغة. */
export function NewOrdersToast({ id, count, onView }: NewOrdersToastProps) {
  const { t } = useTranslation();

  return (
    <div className="flex w-[min(92vw,24rem)] items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-[0_16px_40px_-16px_rgba(63,62,60,0.4)]">
      <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-ink" aria-hidden>
        <BellRing className="size-5" />
        <span className="absolute -end-1 -top-1 size-3 rounded-full bg-secondary ring-2 ring-surface" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-ink">{t("ordersPage.newOrdersTitle", { count })}</p>
        <p className="mt-0.5 text-xs text-muted">{t("ordersPage.newOrdersHint")}</p>
      </div>

      {onView && (
        <button
          type="button"
          onClick={() => {
            onView();
            toast.dismiss(id);
          }}
          className="h-8 shrink-0 cursor-pointer rounded-lg px-3 text-sm font-semibold text-secondary transition hover:bg-secondary-soft"
        >
          {t("ordersPage.newOrdersView")}
        </button>
      )}

      <button
        type="button"
        aria-label={t("ordersPage.newOrdersDismiss")}
        onClick={() => toast.dismiss(id)}
        className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
