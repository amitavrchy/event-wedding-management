"use client";
import { usePublicLocale } from "@/lib/public-i18n";

export function LanguageSwitch() {
  const { locale, toggle } = usePublicLocale();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={locale === "en" ? "Switch to Bangla" : "Switch to English"}
    >
      {locale === "en" ? "বাংলা" : "English"}
    </button>
  );
}
