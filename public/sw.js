/*
 * Service worker لوحة بافلاي.
 *
 * يخزّن واجهة التطبيق فقط ليفتح بسرعة من الشاشة الرئيسية:
 * - ملفات البناء في /assets/ أسماؤها تتغير مع كل بناء، فتُقرأ من التخزين أولاً.
 * - ملفات الخطوط من Google ثابتة، فتُقرأ من التخزين أولاً.
 * - الصفحة نفسها (index.html) تُجلب من الشبكة دائماً، ولا تُقرأ من التخزين إلا إن انقطع الاتصال،
 *   فكل فتح للتطبيق يحمل آخر إصدار منشور.
 *
 * ردود الـ API والصور وملف version.json لا تمر من هنا أبداً: بيانات الطلبات تُعرض كما هي في الخادم الآن.
 *
 * أي تعديل على منطق هذا الملف يرفع رقم CACHE، فيحذف التخزين القديم عند التفعيل.
 */
const CACHE = "bafly-shell-v1";
const SHELL_KEY = "/";
// ملفات البناء القديمة تتراكم مع كل نشر، فنبقي الأحدث منها فقط.
const MAX_ENTRIES = 120;
const FONT_FILES_HOST = "fonts.gstatic.com";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith("bafly-") && key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin && request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if ((sameOrigin && url.pathname.startsWith("/assets/")) || url.hostname === FONT_FILES_HOST) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirstPage(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && (response.headers.get("content-type") || "").includes("text/html")) {
      await cache.put(SHELL_KEY, response.clone());
    }
    return response;
  } catch (error) {
    // كل مسارات التطبيق تعرض الصفحة نفسها، فنسخة واحدة محفوظة تكفي لأي مسار.
    const cached = await cache.match(SHELL_KEY);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    await trim(cache);
  }
  return response;
}

async function trim(cache) {
  const shellUrl = new URL(SHELL_KEY, self.location.origin).href;
  const keys = await cache.keys();
  // المفاتيح بترتيب الإضافة، فالأقدم أولاً. الصفحة المحفوظة لا تُحذف.
  const removable = keys.filter((key) => key.url !== shellUrl);
  const excess = removable.length - MAX_ENTRIES;
  for (let i = 0; i < excess; i++) {
    await cache.delete(removable[i]);
  }
}
