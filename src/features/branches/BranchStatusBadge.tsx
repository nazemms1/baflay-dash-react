import { useTranslation } from "react-i18next";
import { Badge, type Tone } from "@/components/ui/Badge";
import type { Named } from "@/services";
import { branchStatusOf, localClock, type BranchStatus } from "./branchStatus";

const TONE: Record<BranchStatus, Tone> = {
  open: "ok",
  closedByBranch: "danger",
  outsideHours: "warn",
  hidden: "neutral",
  unknown: "neutral",
};

/**
 * حالة الفرع الآن: مفتوح، أو مغلق يدوياً، أو برّا الدوام مع وقت الفتح بتوقيت الفرع نفسه.
 * الحالة من الخادم وحده، فالواجهة لا تحسب الدوام بنفسها.
 */
export function BranchStatusBadge({ row }: { row: Named }) {
  const { t } = useTranslation();
  const status = branchStatusOf(row);

  if (status === "outsideHours") {
    const opens = localClock(row.opens_at, row.timezone);
    return <Badge tone={TONE[status]}>{opens ? t("branchStatus.opensAt", { time: opens }) : t("branchStatus.outsideHours")}</Badge>;
  }

  if (status === "unknown") return <span className="text-muted">—</span>;

  return <Badge tone={TONE[status]}>{t(`branchStatus.${status}`)}</Badge>;
}
