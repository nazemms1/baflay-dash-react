import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import i18n from "@/i18n";

/** حدث كروم وأندرويد الذي يسمح بفتح نافذة التثبيت من زر داخل الصفحة. لا يوجد في أنواع TypeScript. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * - `prompt`: المتصفح جاهز لعرض نافذة التثبيت (كروم وأندرويد وإيدج).
 * - `ios`: آيفون وآيباد لا يعرضان نافذة تثبيت، فنشرح خطوات «إضافة إلى الشاشة الرئيسية».
 * - `manual`: المتصفح لم يرسل حدث التثبيت (التطبيق مثبت أصلاً، أو أُغلقت نافذة التثبيت من قبل،
 *   أو المتصفح لا يدعمه كفايرفوكس). الزر يبقى ظاهراً ويشرح الخطوات حسب المتصفح، فلا يختفي بصمت.
 * - `null`: التطبيق مفتوح كتطبيق مثبت، فلا حاجة للزر.
 */
export type InstallMode = "prompt" | "ios" | "manual" | null;

/** المتصفحات التي تختلف خطوات التثبيت فيها. أي متصفح مبني على كروميوم (أوبرا مثلاً) يُعامل كـ chrome. */
export type InstallBrowser = "chrome" | "edge" | "safari" | "firefox";

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let mode: InstallMode = null;
const listeners = new Set<() => void>();

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  // آيباد الحديث يعرّف نفسه كماك، ويُميّز بشاشة اللمس.
  return /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
}

/** هاتف أو تابلت، لاختيار صياغة «الشاشة الرئيسية» بدل «هذا الجهاز». */
export function isMobileDevice(): boolean {
  return isIos() || /android|mobile/i.test(navigator.userAgent);
}

/** أوبرا وبريف وغيرهما يحملان «Chrome/» في هويتهما، وإيدج يضيف «Edg/»، فيُفحص إيدج وفايرفوكس أولاً. */
export function installBrowser(): InstallBrowser {
  const ua = navigator.userAgent;
  if (/edg(e|a|ios)?\//i.test(ua)) return "edge";
  if (/firefox\/|fxios\//i.test(ua)) return "firefox";
  if (/chrome\/|chromium\/|crios\//i.test(ua)) return "chrome";
  if (/safari\//i.test(ua)) return "safari";
  return "chrome";
}

function update() {
  if (isStandalone()) mode = null;
  else if (deferredPrompt) mode = "prompt";
  else if (isIos()) mode = "ios";
  else mode = "manual";
  listeners.forEach((listener) => listener());
}

/**
 * يُستدعى مرة واحدة عند بدء التطبيق، قبل رسم أي شاشة: حدث `beforeinstallprompt` يصل مرة واحدة
 * بعد تحميل الصفحة، فلو انتظرنا ظهور القائمة الجانبية (بعد الدخول) لفاتنا.
 */
export function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    deferredPrompt = event as BeforeInstallPromptEvent;
    update();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    update();
    toast.success(i18n.t("pwa.installed"));
  });
  // فتح التطبيق المثبت أو إغلاقه يغيّر وضع العرض دون إعادة تحميل الصفحة.
  window.matchMedia("(display-mode: standalone)").addEventListener("change", update);
  update();
}

/**
 * يفتح نافذة التثبيت. الحدث يُستعمل مرة واحدة، فيُنسى بعدها وينتظر المتصفح أن يرسل غيره.
 * إن أُغلقت النافذة دون تثبيت يعود الزر بوضع الشرح اليدوي بدل أن يختفي.
 */
export async function promptInstall() {
  const event = deferredPrompt;
  if (!event) return;
  deferredPrompt = null;
  try {
    await event.prompt();
    await event.userChoice;
  } finally {
    update();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstallMode(): InstallMode {
  return useSyncExternalStore(subscribe, () => mode);
}
