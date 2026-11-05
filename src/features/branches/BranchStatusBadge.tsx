import { useTranslation } from "react-i18next";
import { Badge, type Tone } from "@/components/ui/Badge";
import { toText } from "@/lib/coerce";
import type { Named } from "@/services";
import { branchStatusOf, localClock, type BranchStatus } from "./branchStatus";

const TONE: Record<BranchStatus, Tone> = {
  open: "ok",
  closedByBranch: "danger",
  outsideHours: "warn",
  noOrderTypes: "danger",
  noPaymentMethods: "danger",
  hidden: "neutral",
  unknown: "neutral",
};

/**
 * شارة حالة الفرع من حالته وحدها، فتصلح حيث لا تتوفر بقية بيانات الفرع، كلوحة العمليات.
 * `detail` نص إضافي يظهر عند المرور، مثل سبب الإغلاق اليدوي.
 */
export function BranchStatusPill({
  status,
  label,
  detail,
}: {
  status: BranchStatus;
  /** نص يحلّ محل النص الافتراضي للحالة، كـ«يفتح 10:00». */
  label?: string;
  detail?: string;
}) {
  const { t } = useTranslation();
  if (status === "unknown") return <span className="text-muted">—</span>;

  const badge = <Badge tone={TONE[status]}>{label ?? t(`branchStatus.${status}`)}</Badge>;
  return detail ? <span title={detail}>{badge}</span> : badge;
}

/**
 * حالة الفرع الآن: مفتوح، أو مغلق مع سببه. برّا الدوام يُذكر وقت الفتح بتوقيت الفرع نفسه،
 * والمفتوح بجدول يُذكر وقت إغلاقه. الحالة من الخادم وحده، فالواجهة لا تحسب الدوام بنفسها.
 */
export function BranchStatusBadge({ row }: { row: Named }) {
  const { t } = useTranslation();
  const status = branchStatusOf(row);

  if (status === "outsideHours") {
    const opens = localClock(row.opens_at, row.timezone);
    return <BranchStatusPill status={status} label={opens ? t("branchStatus.opensAt", { time: opens }) : undefined} />;
  }

  if (status === "open") {
    const closes = localClock(row.closes_at, row.timezone);
    return <BranchStatusPill status={status} label={closes ? t("branchStatus.openUntil", { time: closes }) : undefined} />;
  }

  // سبب الإغلاق اليدوي يكتبه الفرع نفسه، فيُعرض لمن يمرّ على الشارة.
  const reason = status === "closedByBranch" ? toText(row.unavailable_reason).trim() : "";
  return <BranchStatusPill status={status} detail={reason || undefined} />;
}
