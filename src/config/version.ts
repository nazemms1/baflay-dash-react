declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;

/**
 * معلومات الإصدار الظاهرة في التطبيق. الرقم من `package.json` ويُرفع يدوياً عند كل تسليم،
 * والـ commit وتاريخ البناء يُحقنان تلقائياً من `vite.config.ts`.
 */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;
