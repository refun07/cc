import { useEffect, useRef, useState } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { LANGUAGES } from "../i18n";
import { useT } from "../store/langStore";

/**
 * Globe dropdown to switch between English and বাংলা.
 * `tone="light"` for dark backgrounds (e.g. hero), default for light headers.
 */
export default function LanguageSwitcher({ tone = "dark" }) {
  const { lang, setLang } = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find((l) => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const btnCls = tone === "light"
    ? "text-white/90 hover:bg-white/10"
    : "text-slate-600 hover:bg-slate-100";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold transition ${btnCls}`}
        aria-label="Change language"
        aria-expanded={open}
      >
        <Globe className="h-4 w-4" />
        <span>{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => { setLang(l.code); setOpen(false); }}
              className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 ${l.code === lang ? "font-semibold text-brand-700" : "text-slate-700"}`}
            >
              {l.label}
              {l.code === lang && <Check className="h-4 w-4 text-brand-600" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
