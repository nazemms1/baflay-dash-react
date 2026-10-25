import type { TFunction } from "i18next";
import type { OptionSource } from "@/components/crud/types";
import { currentLanguage } from "@/i18n";
import { localizedRecord } from "@/lib/localized";
import { countries, listAll } from "@/services";
import { codeOf } from "./countryScope";

/** قيمة السوق للمحتوى المشترك بين كل الدول، كما يستقبلها الخادم. */
export const GENERAL_MARKET = "general";

/**
 * خيارات السوق: كل دولة لها رمز، قيمتها رمزها (`SY`) كما يستقبله الخادم. و«مشترك» يُضاف أولاً
 * إن طُلب، لأن المعارض تُشارك بين الدول بينما رسائل التواصل تخص دولة واحدة.
 */
export const marketOptions = (t: TFunction, { includeGeneral }: { includeGeneral: boolean }): OptionSource => ({
  cacheKey: includeGeneral ? "markets-with-general" : "markets",
  load: async (signal) => {
    const all = await listAll((query, requestSignal) => countries.list(query, requestSignal), signal);
    const language = currentLanguage();
    const coded = all
      .filter((country) => codeOf(country) !== "")
      .map((country) => ({
        value: codeOf(country),
        label: `${localizedRecord(country, language)} · ${codeOf(country)}`,
      }));
    return includeGeneral ? [{ value: GENERAL_MARKET, label: t("markets.general") }, ...coded] : coded;
  },
});
