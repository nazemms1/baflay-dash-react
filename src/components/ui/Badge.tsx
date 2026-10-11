import type { ReactNode } from "react";
import clsx from "clsx";

export type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

const TONES: Record<Tone, string> = {
  neutral: "bg-line/60 text-ink-soft",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[tone]
      )}
    >
      {children}
    </span>
  );
}
