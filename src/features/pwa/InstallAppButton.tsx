import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, Share, Smartphone, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { promptInstall, useInstallMode } from "./install";

const IOS_STEPS = [
  { key: "pwa.iosStep1", icon: Share },
  { key: "pwa.iosStep2", icon: SquarePlus },
  { key: "pwa.iosStep3", icon: Smartphone },
] as const;

/**
 * زر «تثبيت التطبيق» في القائمة الجانبية. على كروم وأندرويد يفتح نافذة التثبيت مباشرة، وعلى آيفون
 * يشرح خطوات الإضافة إلى الشاشة الرئيسية. يختفي حين يُفتح كتطبيق مثبت أو في متصفح لا يدعم التثبيت.
 */
export function InstallAppButton() {
  const { t } = useTranslation();
  const mode = useInstallMode();
  const [iosOpen, setIosOpen] = useState(false);
  const closeIos = useCallback(() => setIosOpen(false), []);

  if (!mode) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => (mode === "prompt" ? void promptInstall() : setIosOpen(true))}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-night-soft px-3 py-2.5 text-start text-surface transition hover:bg-night-line"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-ink" aria-hidden>
          <Download className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{t("pwa.install")}</span>
          <span className="block truncate text-xs text-surface/60">{t("pwa.installHint")}</span>
        </span>
      </button>

      <Dialog
        open={iosOpen}
        onClose={closeIos}
        title={t("pwa.iosTitle")}
        description={t("pwa.iosIntro")}
        footer={<Button onClick={closeIos}>{t("pwa.iosDone")}</Button>}
      >
        <ol className="space-y-3">
          {IOS_STEPS.map((step, index) => (
            <li key={step.key} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-ink tabular-nums">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm text-ink">{t(step.key)}</span>
              <step.icon className="size-5 shrink-0 text-ink-soft" aria-hidden />
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-primary-soft p-3 text-sm text-ink">{t("pwa.iosLoginNote")}</p>
      </Dialog>
    </>
  );
}
