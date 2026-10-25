import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CountryScopedPage } from "@/features/markets/CountryScopedPage";
import type { CountryScope } from "@/features/markets/countryScope";
import { heroSlidesModule } from "./heroSlidesModule";

/** ثابتة على مستوى الملف، فالوحدة لا تُعاد بناؤها مع كل رسم. */
const buildHeroModule = (t: TFunction, scope: CountryScope) => heroSlidesModule(t, scope.code);

/**
 * شاشة الواجهة الرئيسية حسب الدولة: تختار الدولة من القائمة، فتظهر شرائحها وحدها.
 * اختيار الدولة مشترك مع شاشات الدول الأخرى.
 */
export function HeroSlidesPage() {
  const { t } = useTranslation();
  return (
    <CountryScopedPage
      build={buildHeroModule}
      countryLabel={t("heroSlides.country")}
      emptyText={t("heroSlides.noCountries")}
    />
  );
}
