/**
 * يسجّل `public/sw.js` في نسخة الإنتاج فقط: في التطوير يتعارض التخزين مع تحديث Vite الفوري.
 * فشل التسجيل لا يوقف شيئاً، فالتطبيق يعمل كاملاً بدونه.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // متصفح يمنع الـ service worker (وضع خاص مثلاً): نكمل بدونه.
    });
  });
}
