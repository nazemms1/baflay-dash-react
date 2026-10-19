import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { ChevronDown, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { currentLanguage } from "@/i18n";
import { asRecord, toNumber, toText } from "@/lib/coerce";
import type { Named } from "@/services";
import { canAssignDriver } from "./driverAssignment";
import { isFinalOrder, serverLabelOf } from "./orderStatus";
import { statusDotClass } from "./statusTone";
import type { OrderType } from "./orderRows";

/**
 * علامة الطلب المنتظر للقبول: نقطة نابضة وتسمية. تبقى حتى تتغير حالة الطلب، فيختفي الصوت وعلامته معاً.
 */
export function AwaitingBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-danger opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-danger" />
      </span>
      {t("ordersPage.awaitingBadge")}
    </span>
  );
}

/** نوع الطلب شارة ملونة: توصيل بلون الهوية، واستلام بلون ثانوي. */
export function TypeChip({ type }: { type: OrderType }) {
  const { t } = useTranslation();
  const tone = type === "delivery" ? "bg-primary text-ink" : "bg-secondary-soft text-secondary";
  const label = type === "delivery" ? t("orderInvoice.delivery") : t("orderInvoice.pickup");
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${tone}`}>{label}</span>;
}

export function RatingStars({ row }: { row: Named }) {
  const rating = Math.round(toNumber(row.rating));
  if (rating <= 0) return <span className="text-muted">—</span>;
  return (
    <span className="whitespace-nowrap text-warn" title={toText(row.rating_note) || undefined}>
      {"★".repeat(rating)}
      <span className="text-line">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

/**
 * عمود السائق: اسم السائق، أو تنبيه «بانتظار سائق» لتوصيل بلا سائق. زر الإسناد يظهر
 * لمن يملك صلاحيته، وللطلب الذي ما زال قبل الاستلام من الفرع.
 */
export function DriverCell({ row, canAssign, onAssign }: { row: Named; canAssign: boolean; onAssign: () => void }) {
  const { t } = useTranslation();
  if (toText(row.delivery_type) !== "delivery") return <span className="text-muted">—</span>;

  const name = toText(asRecord(row.driver).name);
  const editable = canAssign && canAssignDriver(row);

  return (
    <div className="space-y-1">
      {name ? (
        <p className="font-medium text-ink">{name}</p>
      ) : (
        <Badge tone="warn">{t("drivers.assign.needsDriver")}</Badge>
      )}
      {editable && (
        <button
          type="button"
          onClick={onAssign}
          className="cursor-pointer text-xs font-medium text-secondary hover:underline"
        >
          {name ? t("drivers.assign.change") : t("drivers.assign.assign")}
        </button>
      )}
    </div>
  );
}

/**
 * زر الحالة: نقطة اللون والتسمية الرسمية، ويفتح نافذة التغيير بنقرة واحدة.
 * `block` يجعله زراً بعرض كامل لكرت الهاتف، والافتراضي شارة صغيرة للجدول.
 */
export function StatusTrigger({
  row,
  canChange,
  onOpen,
  block = false,
}: {
  row: Named;
  canChange: boolean;
  onOpen: () => void;
  block?: boolean;
}) {
  const { t } = useTranslation();
  const language = currentLanguage();
  const current = toText(row.status);
  const final = isFinalOrder(row);
  const locked = !canChange || final;

  return (
    <button
      type="button"
      disabled={locked}
      onClick={onOpen}
      title={final ? t("ordersPage.finalLocked") : t("ordersPage.changeStatus")}
      className={clsx(
        "items-center gap-2 border border-line bg-surface font-medium text-ink transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-70",
        block ? "flex h-11 w-full cursor-pointer rounded-xl px-4 text-[15px]" : "inline-flex max-w-full cursor-pointer rounded-full px-3 py-1.5 text-sm"
      )}
    >
      <span className={`size-2.5 shrink-0 rounded-full ${statusDotClass(current)}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-start">
        {serverLabelOf(row, current, language) ?? t(`orders.status.${current}`, { defaultValue: current })}
      </span>
      {final ? (
        <Lock className="size-3.5 shrink-0 text-muted" aria-hidden />
      ) : (
        canChange && <ChevronDown className="size-3.5 shrink-0 text-muted" aria-hidden />
      )}
    </button>
  );
}
