import type { GeoEntity } from "@/services";

/** الدولة كما تحتاجها شاشاتها: رمزها للمسارات، ورمز اتصالها لتحقق الأرقام. */
export interface CountryScope {
  code: string;
  dialCode: string | null;
}

/** رمز الدولة كما هو مخزّن (حروف كبيرة)، والفارغ يعني دولة بلا رمز بعد. */
export const codeOf = (country: GeoEntity): string =>
  typeof country.code === "string" ? country.code.trim().toUpperCase() : "";

/** رمز الاتصال كما أدخله المسؤول (`+963` أو `963`)، أو `null` إن غاب. */
const dialCodeOf = (country: GeoEntity): string | null =>
  typeof country.dial_code === "string" && country.dial_code.trim() !== "" ? country.dial_code.trim() : null;

export const scopeOf = (country: GeoEntity): CountryScope => ({
  code: codeOf(country),
  dialCode: dialCodeOf(country),
});
