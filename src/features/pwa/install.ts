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
 * - `null`: التطبيق مثبت ومفتوح كتطبيق، أو المتصفح لا يدعم التثبيت.
 */
export type InstallMode = "prompt" | "ios" | null;

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

function update() {
  if (isStandalone()) mode = null;
  else if (deferredPrompt) mode = "prompt";
  else if (isIos()) mode = "ios";
  else mode = null;
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
  update();
}

/** يفتح نافذة التثبيت. الحدث يُستعمل مرة واحدة، فيُنسى بعدها وينتظر المتصفح أن يرسل غيره. */
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
