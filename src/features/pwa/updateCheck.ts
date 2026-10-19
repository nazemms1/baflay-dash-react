import { useEffect, useState } from "react";
import { APP_BUILD_ID } from "@/config/version";

// اللوحة تبقى مفتوحة ساعات على أجهزة الفروع، فنسأل كل خمس دقائق وعند كل عودة إلى التطبيق.
const CHECK_INTERVAL_MS = 5 * 60_000;

/** رقم البناء المنشور الآن على الخادم، أو null إن تعذرت قراءته (لا اتصال، أو نشر قديم بلا الملف). */
async function fetchPublishedBuild(): Promise<string | null> {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { buildId?: unknown } | null;
    return typeof data?.buildId === "string" ? data.buildId : null;
  } catch {
    return null;
  }
}

/**
 * يعيد رقم البناء المنشور إن اختلف عن البناء المفتوح الآن، أي أن على الخادم إصداراً أحدث.
 * يعمل في نسخة الإنتاج فقط، فـ `version.json` لا يُكتب في التطوير.
 */
export function usePublishedUpdate(): string | null {
  const [published, setPublished] = useState<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;
    let cancelled = false;

    const check = async () => {
      if (document.visibilityState !== "visible") return;
      const buildId = await fetchPublishedBuild();
      if (!cancelled && buildId && buildId !== APP_BUILD_ID) setPublished(buildId);
    };

    void check();
    const timer = window.setInterval(() => void check(), CHECK_INTERVAL_MS);
    const onVisibility = () => void check();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return published;
}
