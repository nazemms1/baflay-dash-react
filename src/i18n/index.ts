import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ar from "./locales/ar.json";
import en from "./locales/en.json";

export const LANGUAGES = {
  ar: { label: "العربية", dir: "rtl", intl: "ar-EG-u-nu-latn" },
  en: { label: "English", dir: "ltr", intl: "en-US" },
} as const;

export type Language = keyof typeof LANGUAGES;

const DEFAULT_LANGUAGE: Language = "ar";
const STORAGE_KEY = "bafly.dash.lang";

function isLanguage(value: string | null): value is Language {
  return value !== null && value in LANGUAGES;
}

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    // التخزين محجوب (وضع خاص مثلاً): نكتفي باللغة الافتراضية.
    return DEFAULT_LANGUAGE;
  }
}

/** اتجاه الصفحة ولغتها يتبعان اللغة المختارة، فيُكتبان على <html> مباشرة. */
function applyDocumentLanguage(language: Language) {
  document.documentElement.lang = language;
  document.documentElement.dir = LANGUAGES[language].dir;
}

export function setLanguage(language: Language) {
  void i18n.changeLanguage(language);
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // لا نفشل التبديل بسبب التخزين؛ يعود للافتراضي في الزيارة القادمة.
  }
}

void i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
  },
  lng: readStoredLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: { escapeValue: false },
});

applyDocumentLanguage(i18n.language as Language);
i18n.on("languageChanged", (language) =>
  applyDocumentLanguage(language as Language)
);

export function currentLanguage(): Language {
  return isLanguage(i18n.language) ? i18n.language : DEFAULT_LANGUAGE;
}

export default i18n;
