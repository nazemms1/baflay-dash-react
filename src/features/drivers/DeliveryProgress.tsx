import clsx from "clsx";
import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toText } from "@/lib/coerce";
import type { Named } from "@/services";

type StepState = "done" | "current" | "upcoming" | "failed";

/** الحالات التي يكون فيها الطلب قد استُلم من الفرع. */
const PICKED_STATUSES = ["on_the_way", "completed", "delivery_failed"];

const STEP_CLASS: Record<StepState, string> = {
  done: "bg-ok text-white",
  current: "bg-primary text-ink ring-4 ring-primary/30",
  upcoming: "bg-canvas text-muted ring-1 ring-line",
  failed: "bg-danger text-white",
};

/**
 * خطوات الطلب الثلاث في كرت السائق: مُسنَد، ثم مُستلم من الفرع، ثم مُسلَّم أو متعذّر.
 * تُقرأ من الطلب نفسه، فيعرف السائق مكانه في المسار قبل أن يضغط.
 */
export function DeliveryProgress({ order }: { order: Named }) {
  const { t } = useTranslation();
  const status = toText(order.status);
  const picked = Boolean(toText(order.picked_up_at)) || PICKED_STATUSES.includes(status);
  const failed = status === "delivery_failed";
  const finished = status === "completed" || failed;

  const steps: { key: string; label: string; state: StepState }[] = [
    { key: "assigned", label: t("drivers.steps.assigned"), state: "done" },
    { key: "picked", label: t("drivers.steps.picked"), state: picked ? "done" : "current" },
    {
      key: "final",
      label: failed ? t("drivers.steps.failed") : t("drivers.steps.delivered"),
      state: failed ? "failed" : finished ? "done" : picked ? "current" : "upcoming",
    },
  ];

  return (
    <ol aria-label={t("drivers.steps.label")} className="relative grid grid-cols-3 gap-2">
      {/* الخط الذي يربط الخطوات، خلف الدوائر */}
      <span aria-hidden className="absolute start-[16.66%] end-[16.66%] top-3.5 h-0.5 bg-line" />
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex flex-col items-center gap-1.5 text-center">
          <span className={clsx("grid size-7 place-items-center rounded-full text-xs font-bold", STEP_CLASS[step.state])}>
            {step.state === "done" ? (
              <Check className="size-4" aria-hidden />
            ) : step.state === "failed" ? (
              <X className="size-4" aria-hidden />
            ) : (
              index + 1
            )}
          </span>
          <span
            className={clsx(
              "text-xs leading-tight",
              step.state === "upcoming" ? "text-muted" : "font-medium text-ink"
            )}
          >
            {step.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
