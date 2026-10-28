import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CountryScopedPage } from "@/features/markets/CountryScopedPage";
import type { CountryScope } from "@/features/markets/countryScope";
import { marketOffersModule } from "./marketOffersModule";

/** ثابتة على مستوى الملف، فالوحدة لا تُعاد بناؤها مع كل رسم. */
const buildOffersModule = (t: TFunction, scope: CountryScope) => marketOffersModule(t, scope);

/** عروض كل دولة: صورة ورابط لكل عرض، تظهر في الواجهة بالترتيب الذي تحدده هنا. */
export function MarketOffersPage() {
  const { t } = useTranslation();
  return (
    <CountryScopedPage
      build={buildOffersModule}
      countryLabel={t("marketOffers.country")}
      emptyText={t("marketOffers.noCountries")}
    />
  );
}
