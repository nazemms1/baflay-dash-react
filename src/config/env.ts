const rawApiUrl = import.meta.env.VITE_API_URL?.trim() ?? "";

/**
 * لا يرمي الملف عند غياب الإعداد، فالتطبيق يبقى قابلاً للتحميل ويعرض شاشة مهذبة بدل صفحة بيضاء.
 * ما يقرره هنا يتولاه `main.tsx`.
 */
export const isConfigMissing = rawApiUrl === "";

export const env = {
  /** بلا / في النهاية، لأن المسارات النسبية تُلحَق به مباشرة. */
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
} as const;
