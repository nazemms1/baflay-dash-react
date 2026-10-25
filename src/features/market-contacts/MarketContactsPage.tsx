import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { CountryScopedPage } from "@/features/markets/CountryScopedPage";
import type { CountryScope } from "@/features/markets/countryScope";
import { marketContactsModule } from "./marketContactsModule";

/** ثابتة على مستوى الملف، فالوحدة لا تُعاد بناؤها مع كل رسم. */
const buildContactsModule = (t: TFunction, scope: CountryScope) => marketContactsModule(t, scope);

/** وسائل التواصل لكل دولة: الهاتف والبريد والعنوان وساعات العمل ومواقع التواصل، تظهر للزائر مرتبة. */
export function MarketContactsPage() {
  const { t } = useTranslation();
  return (
    <CountryScopedPage
      build={buildContactsModule}
      countryLabel={t("marketContacts.country")}
      emptyText={t("marketContacts.noCountries")}
    />
  );
}
