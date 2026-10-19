declare const __APP_VERSION__: string;
declare const __APP_COMMIT__: string;
declare const __APP_BUILD_DATE__: string;
declare const __APP_BUILD_ID__: string;

/**
 * معلومات الإصدار الظاهرة في التطبيق. الرقم من `package.json` ويُرفع يدوياً عند كل تسليم،
 * والـ commit وتاريخ البناء ورقم البناء تُحقن تلقائياً من `vite.config.ts`.
 */
export const APP_VERSION = __APP_VERSION__;
export const APP_COMMIT = __APP_COMMIT__;
export const APP_BUILD_DATE = __APP_BUILD_DATE__;
/** فريد لكل بناء، ويُقارن بـ `version.json` المنشور لمعرفة توفر إصدار أحدث. */
export const APP_BUILD_ID = __APP_BUILD_ID__;
