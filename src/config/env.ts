const rawApiUrl = import.meta.env.VITE_API_URL?.trim();

if (!rawApiUrl) {
  throw new Error(
    "VITE_API_URL غير مضبوط. انسخ .env.example إلى .env ثم أكمل القيمة."
  );
}

export const env = {
  /** بلا / في النهاية، لأن المسارات النسبية تُلحَق به مباشرة. */
  apiUrl: rawApiUrl.replace(/\/+$/, ""),
} as const;
