import { create } from "zustand";
import { persist } from "zustand/middleware";
import { translations } from "../i18n";

/**
 * Global language state (English / Bangla), persisted to localStorage.
 * Components read `lang` and call `t(key)` to translate.
 */
export const useLangStore = create(
  persist(
    (set, get) => ({
      lang: "en",
      setLang: (lang) => {
        set({ lang });
        if (typeof document !== "undefined") document.documentElement.lang = lang;
      },
      /** Translate a dotted key; falls back to the English string, then the key itself. */
      t: (key) => {
        const { lang } = get();
        return translations[lang]?.[key] ?? translations.en?.[key] ?? key;
      },
    }),
    { name: "dscc-lang" }
  )
);

/** Convenience hook: returns { t, lang, setLang } and re-renders on language change. */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  const setLang = useLangStore((s) => s.setLang);
  const t = (key) => translations[lang]?.[key] ?? translations.en?.[key] ?? key;
  return { t, lang, setLang };
}
