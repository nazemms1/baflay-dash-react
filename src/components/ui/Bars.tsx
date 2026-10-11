import clsx from "clsx";

/**
 * شريط نسبي بسيط. القيمة تُقسَم على الأكبر في القائمة، فيبقى الأطول ممتلئاً
 * والبقية نسبةً إليه.
 */
export function ShareBar({
  value,
  max,
  tone = "primary",
  className,
}: {
  value: number;
  max: number;
  tone?: "primary" | "ok" | "danger" | "info";
  className?: string;
}) {
  const percent = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fill = {
    primary: "bg-primary",
    ok: "bg-ok",
    danger: "bg-danger",
    info: "bg-info",
  }[tone];

  return (
    <div className={clsx("h-2 w-full overflow-hidden rounded-full bg-line/60", className)}>
      <div
        className={clsx("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={clsx("skeleton-block rounded-xl", className)} />;
}
