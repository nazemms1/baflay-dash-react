import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { LANGUAGES, setLanguage, type Language } from "@/i18n";

/** يعرض اللغة التي سيتحوّل إليها الزر، لا الحالية، فالنقرة تعني ما يُقرأ. */
export function LanguageSwitch() {
  const { i18n, t } = useTranslation();
  const current = (i18n.language in LANGUAGES ? i18n.language : "ar") as Language;
  const next: Language = current === "ar" ? "en" : "ar";

  return (
    <button
      type="button"
      onClick={() => setLanguage(next)}
      className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-ink-soft transition hover:text-ink"
      aria-label={t("common.switchLanguage")}
    >
      <Languages className="size-4" aria-hidden />
      {LANGUAGES[next].label}
    </button>
  );
}
