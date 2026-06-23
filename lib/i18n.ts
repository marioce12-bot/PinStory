import fr from "@/dictionaries/fr.json";
import en from "@/dictionaries/en.json";
import ar from "@/dictionaries/ar.json";

export const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getDictionary(locale: string) {
  if (locale === "ar") return ar;
  if (locale === "fr") return fr;
  return en;
}

export function getDirection(locale: string) {
  return locale === "ar" ? "rtl" : "ltr";
}
