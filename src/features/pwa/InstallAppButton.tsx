import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AppWindow,
  Download,
  Ellipsis,
  EllipsisVertical,
  MonitorDown,
  Share,
  Smartphone,
  SquarePlus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { installBrowser, isMobileDevice, promptInstall, useInstallMode, type InstallBrowser } from "./install";

interface Step {
  key: string;
  icon: LucideIcon;
}

const IOS_STEPS: Step[] = [
  { key: "pwa.iosStep1", icon: Share },
  { key: "pwa.iosStep2", icon: SquarePlus },
  { key: "pwa.iosStep3", icon: Smartphone },
];

/** خطوات التثبيت اليدوي لكل متصفح. فايرفوكس بلا خطوات: لا يدعم تثبيت التطبيقات على الكمبيوتر. */
const MANUAL_STEPS: Record<InstallBrowser, Step[]> = {
  chrome: [
    { key: "pwa.chromeStep1", icon: MonitorDown },
    { key: "pwa.chromeStep2", icon: EllipsisVertical },
    { key: "pwa.chromeStep3", icon: AppWindow },
  ],
  edge: [
    { key: "pwa.edgeStep1", icon: Ellipsis },
    { key: "pwa.edgeStep2", icon: AppWindow },
    { key: "pwa.edgeStep3", icon: MonitorDown },
  ],
  safari: [
    { key: "pwa.safariStep1", icon: Share },
    { key: "pwa.safariStep2", icon: SquarePlus },
    { key: "pwa.safariStep3", icon: AppWindow },
  ],
  firefox: [],
};

/**
 * زر «تثبيت التطبيق» في القائمة الجانبية، ويظهر للجميع على الكمبيوتر والهاتف:
 * - كروم وإيدج حين يرسل المتصفح حدث التثبيت: يفتح نافذة التثبيت مباشرة.
 * - آيفون: يشرح «إضافة إلى الشاشة الرئيسية».
 * - غير ذلك (التطبيق مثبت أصلاً، أو أُغلقت نافذة التثبيت من قبل، أو سفاري وفايرفوكس): يشرح خطوات
 *   التثبيت حسب المتصفح، فلا يختفي الزر دون أن يعرف المستخدم السبب.
 * يختفي فقط حين يُفتح كتطبيق مثبت.
 */
export function InstallAppButton() {
  const { t } = useTranslation();
  const mode = useInstallMode();
  const [guideOpen, setGuideOpen] = useState(false);
  const closeGuide = useCallback(() => setGuideOpen(false), []);

  if (!mode) return null;

  const browser = installBrowser();
  const steps = mode === "ios" ? IOS_STEPS : MANUAL_STEPS[browser];
  const guideTitle = mode === "ios" ? t("pwa.iosTitle") : t("pwa.manualTitle");
  const guideIntro =
    mode === "ios"
      ? t("pwa.iosIntro")
      : browser === "firefox"
        ? t("pwa.firefoxIntro")
        : t("pwa.manualIntro");

  return (
    <>
      <button
        type="button"
        onClick={() => (mode === "prompt" ? void promptInstall() : setGuideOpen(true))}
        className="flex w-full cursor-pointer items-center gap-3 rounded-xl bg-night-soft px-3 py-2.5 text-start text-surface transition hover:bg-night-line"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-ink" aria-hidden>
          <Download className="size-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">{t("pwa.install")}</span>
          <span className="block truncate text-xs text-surface/60">
            {isMobileDevice() ? t("pwa.installHint") : t("pwa.installHintDesktop")}
          </span>
        </span>
      </button>

      <Dialog
        open={guideOpen}
        onClose={closeGuide}
        title={guideTitle}
        description={guideIntro}
        footer={<Button onClick={closeGuide}>{t("pwa.iosDone")}</Button>}
      >
        {steps.length > 0 && (
          <ol className="space-y-3">
            {steps.map((step, index) => (
              <li key={step.key} className="flex items-center gap-3 rounded-xl border border-line p-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-ink tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm text-ink">{t(step.key)}</span>
                <step.icon className="size-5 shrink-0 text-ink-soft" aria-hidden />
              </li>
            ))}
          </ol>
        )}

        {mode === "ios" ? (
          <p className="mt-4 rounded-xl bg-primary-soft p-3 text-sm text-ink">{t("pwa.iosLoginNote")}</p>
        ) : (
          <>
            {browser !== "firefox" && (
              <p className="mt-4 rounded-xl bg-primary-soft p-3 text-sm text-ink">{t("pwa.alreadyInstalled")}</p>
            )}
            {!window.isSecureContext && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger-soft p-3 text-sm text-ink">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                {t("pwa.insecure")}
              </p>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
