import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/Badge";
import { formatPercent } from "@/lib/format";

/** نسبة التغيير مع لونها: موجبة خضراء، سالبة حمراء، وغيابها يعني «لا مقارنة». */
export function ChangeChip({ value }: { value: number | null }) {
  const { t } = useTranslation();
  if (value === null) {
    return <span className="text-xs text-muted">{t("dashboard.noComparison")}</span>;
  }
  const tone: Tone = value > 0 ? "ok" : value < 0 ? "danger" : "neutral";
  return <Badge tone={tone}>{formatPercent(value)}</Badge>;
}

/** بطاقة مؤشر: العنوان مع أيقونة في مربع ملوّن، ثم الرقم الكبير، ثم شرح صغير. */
export function KpiTile({
  label,
  value,
  hint,
  tone,
  icon: Icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "danger";
  icon?: LucideIcon;
}) {
  const danger = tone === "danger";
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_0_rgba(23,25,31,0.04)] transition hover:border-primary/60 sm:gap-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink-soft">{label}</p>
        {Icon && (
          <span
            className={clsx(
              "grid size-9 shrink-0 place-items-center rounded-xl",
              danger ? "bg-danger-soft text-danger" : "bg-primary-soft text-ink"
            )}
          >
            <Icon className="size-4" aria-hidden />
          </span>
        )}
      </div>
      <div>
        <p className={clsx("text-2xl font-bold tracking-tight tabular-nums sm:text-3xl", danger ? "text-danger" : "text-ink")}>
          {value}
        </p>
        {hint && <div className="mt-1.5 text-xs text-muted">{hint}</div>}
      </div>
    </div>
  );
}

/** حالة الطلب كما يعيدها الخادم، مع ترجمة إن وُجدت وإلا النص كما هو. */
export function OrderStatus({ status }: { status: string }) {
  const { t } = useTranslation();
  return (
    <Badge>
      {t(`dashboard.orderStatus.${status}`, { defaultValue: status || "—" })}
    </Badge>
  );
}
