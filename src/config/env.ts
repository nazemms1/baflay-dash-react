const rawApiUrl = import.meta.env.VITE_API_URL?.trim() ?? "";

/**
 * لا يرمي الملف عند غياب الإعداد، فالتطبيق يبقى قابلاً للتحميل ويعرض شاشة مهذبة بدل صفحة بيضاء.
 * ما يقرره هنا يتولاه `main.tsx`.
 */
export const isConfigMissing = rawApiUrl === "";

const rawGoogleMapsKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? "";
const rawGoogleMapId = import.meta.env.VITE_GOOGLE_MAP_ID?.trim() ?? "";

export const env = {
  /** بلا / في النهاية، لأن المسارات النسبية تُلحَق به مباشرة. */
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
  /** فارغ يعني أن الخريطة لن تُحمَّل، ولا يوقف باقي التطبيق. */
  googleMapsApiKey: rawGoogleMapsKey,
  /** معرّف الخريطة المطلوب للعلامات المتقدّمة. */
  googleMapId: rawGoogleMapId,
} as const;
