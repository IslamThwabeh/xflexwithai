import { ACADEMY_COUNTRY_AR, ACADEMY_COUNTRY_EN } from "./academyLocale";

// ISO region identifiers, not a list of cities. Historical text is never rewritten.
export const CUSTOMER_COUNTRY_CODES =
  "AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW".split(
    " "
  );
const codes = new Set(CUSTOMER_COUNTRY_CODES);
const names = {
  en: new Intl.DisplayNames(["en"], { type: "region" }),
  ar: new Intl.DisplayNames(["ar"], { type: "region" }),
};
export function customerCountryName(code: string, language: string) {
  if (code === "PS")
    return language === "ar" ? ACADEMY_COUNTRY_AR : ACADEMY_COUNTRY_EN;
  return names[language === "ar" ? "ar" : "en"].of(code) ?? code;
}
const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
const aliases = new Map<string, string>();
for (const code of CUSTOMER_COUNTRY_CODES) {
  for (const value of [
    code,
    customerCountryName(code, "en"),
    customerCountryName(code, "ar"),
  ])
    aliases.set(normalize(value), code);
}
for (const [alias, code] of Object.entries({
  palestine: "PS",
  فلسطين: "PS",
  "دولة فلسطين": "PS",
  "palestinian territories": "PS",
  "palestinian territory": "PS",
  "فلسطين المحتلة": "PS",
  "united states of america": "US",
  usa: "US",
  uk: "GB",
  uae: "AE",
  الأردن: "JO",
  الاردن: "JO",
  الامارات: "AE",
  "الامارات العربية المتحدة": "AE",
  السعودية: "SA",
}))
  aliases.set(normalize(alias), code);

/** Only exact country names/known aliases; a city such as Nablus stays unknown. */
export function customerCountryCode(
  value: string | null | undefined
): string | null {
  return value ? (aliases.get(normalize(value)) ?? null) : null;
}
export function customerCountryDisplay(
  value: string | null | undefined,
  language: string
) {
  const code = customerCountryCode(value);
  return {
    code,
    label: code ? customerCountryName(code, language) : value?.trim() || "—",
    needsReview: !!value?.trim() && !code,
  };
}
export function isCustomerCountryCode(value: string) {
  return codes.has(value);
}
export function isValidCustomerCity(value: string) {
  const trimmed = value.trim();
  return (
    trimmed.length >= 1 &&
    trimmed.length <= 100 &&
    /\p{L}/u.test(trimmed) &&
    !/[\u0000-\u001f\u007f<>@/:\\]/u.test(trimmed)
  );
}
