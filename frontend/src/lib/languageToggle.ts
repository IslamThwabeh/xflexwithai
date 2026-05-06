export type SupportedLanguage = "ar" | "en";

export function getLanguageSwitchLabel(language: SupportedLanguage): string {
  return language === "ar" ? "English" : "العربية";
}