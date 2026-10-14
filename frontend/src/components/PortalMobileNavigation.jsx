import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useT } from "../store/langStore";

const TONES = {
  emerald: { header: "bg-emerald-950", active: "bg-brand-600", text: "text-emerald-100" },
  slate: { header: "bg-slate-900", active: "bg-brand-600", text: "text-slate-100" },
  teal: { header: "bg-teal-950", active: "bg-teal-600", text: "text-teal-100" },
};

export default function PortalMobileNavigation({ items, title, tone = "slate" }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const closeRef = useRef(null);
  const triggerRef = useRef(null);
  const dialogRef = useRef(null);
  const { lang } = useT();
  const colors = TONES[tone];
  const current = [...items].reverse().find(([to, , , end]) =>
    end ? location.pathname === to : location.pathname === to || location.pathname.startsWith(`${to}/`)
  );

  useEffect(() => { setOpen(false); }, [location.pathname]);
  useEffect(() => {
    if (!open) return undefined;
    const oldOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onBreakpoint = () => { if (desktop.matches) setOpen(false); };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const controls = [...dialogRef.current.querySelectorAll('button, a[href]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    };
    desktop.addEventListener("change", onBreakpoint);
    onBreakpoint();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      window.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onBreakpoint);
      if (!desktop.matches) trigger?.focus();
    };
  }, [open]);

  return <>
    <button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-label={lang === "bn" ? "প্যানেল মেনু খুলুন" : "Open panel menu"} aria-expanded={open}
      className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 lg:hidden">
      <Menu className="h-5 w-5" />
    </button>
    <span className="min-w-0 truncate text-sm font-semibold text-slate-900 lg:hidden">{current?.[1] || title}</span>
    {open && createPortal(<div className="fixed inset-0 z-[100] lg:hidden">
      <button type="button" tabIndex={-1} onClick={() => setOpen(false)} aria-label={lang === "bn" ? "মেনু বন্ধ করুন" : "Close menu"} className="absolute inset-0 bg-slate-950/60" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label={lang === "bn" ? "প্যানেল নেভিগেশন" : "Panel navigation"}
        className={`relative flex h-dvh w-[min(82vw,320px)] flex-col shadow-xl ${colors.header} ${colors.text}`}>
        <div className="flex min-h-16 items-center justify-between gap-2 border-b border-white/10 px-4">
          <span className="min-w-0 truncate text-sm font-bold text-white">{title}</span>
          <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label={lang === "bn" ? "মেনু বন্ধ করুন" : "Close menu"}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav aria-label={lang === "bn" ? "প্যানেল বিভাগ" : "Panel sections"} className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
          {items.map(([to, label, Icon, end]) => <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
            className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${isActive ? `${colors.active} text-white` : "hover:bg-white/10"}`}>
            <Icon className="h-5 w-5 shrink-0" /> <span>{label}</span>
          </NavLink>)}
        </nav>
      </div>
    </div>, document.body)}
  </>;
}
