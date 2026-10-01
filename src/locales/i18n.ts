import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import id from "./id.json";
import th from "./th.json";
import zh from "./zh.json";

export const supportedLanguages = ["en", "id", "zh", "th"] as const;
export type LanguageCode = (typeof supportedLanguages)[number];
export const languageOptions: { code: LanguageCode; label: string; flag: string }[] = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "id", label: "Bahasa Indonesia", flag: "🇮🇩" },
  { code: "zh", label: "中文（简体）", flag: "🇨🇳" },
  { code: "th", label: "ภาษาไทย", flag: "🇹🇭" },
];

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, id: { translation: id }, zh: { translation: zh }, th: { translation: th } },
  lng: "id", fallbackLng: "en", supportedLngs: [...supportedLanguages], interpolation: { escapeValue: false },
  returnNull: false,
});
export default i18n;
