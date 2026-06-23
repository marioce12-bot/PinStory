import fr from "@/dictionaries/fr.json";
import en from "@/dictionaries/en.json";

export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getDictionary(locale: string) {
  return locale === "en" ? en : fr;
}
