import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../services/api";
import { useT } from "../store/langStore";
import { calendarDate as ymd } from "../lib/bookingDates";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
const SESSION_LABELS = {
  full_day: "Full day",
  half_day_morning: "Morning",
  half_day_evening: "Evening",
};
const SESSION_LABELS_BN = {
  full_day: "পুরো দিন",
  half_day_morning: "সকাল",
  half_day_evening: "সন্ধ্যা",
};

export default function AvailabilityCalendarPicker({ slug, floorId, value, sessionType, selectedDates = [], onSelect }) {
  const { lang } = useT();
  const [cursor, setCursor] = useState(() => {
    const date = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState(null);
  const requestKey = JSON.stringify([slug, floorId, cursor.getTime(), retry]);
  const ready = result?.key === requestKey && result.status === "ready";
  const failed = result?.key === requestKey && result.status === "error";
  const loading = Boolean(slug) && !ready && !failed;
  const map = ready ? result.map : {};

  useEffect(() => {
    if (!value) return;
    const date = new Date(`${value}T00:00:00`);
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    api.get(`/centres/${slug}/calendar`, { params: { from: ymd(start), to: ymd(end), floor_id: floorId || undefined } })
      .then((response) => { if (active) setResult({ key: requestKey, status: "ready", map: Object.fromEntries(response.data.data.map((day) => [day.date, day])) }); })
      .catch(() => { if (active) setResult({ key: requestKey, status: "error" }); });
    return () => { active = false; };
  }, [slug, floorId, cursor, requestKey]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const count = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const rows = Array.from({ length: first.getDay() }, () => null);
    for (let day = 1; day <= count; day += 1) rows.push(new Date(cursor.getFullYear(), cursor.getMonth(), day));
    while (rows.length % 7) rows.push(null);
    return rows;
  }, [cursor]);

  const today = ymd(new Date());
  const selected = new Set(selectedDates.filter(Boolean));
  const locale = lang === "bn" ? "bn-BD" : "en-US";
  const sessionLabels = lang === "bn" ? SESSION_LABELS_BN : SESSION_LABELS;
  const monthLabel = cursor.toLocaleString(locale, { month: "long", year: "numeric" });

  return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Booking availability calendar">
    <div className="flex items-center justify-between gap-3">
      <div><div className="font-display text-base font-bold text-slate-900">{monthLabel}</div><div className="text-[11px] text-slate-500">{lang === "bn" ? "সবুজ তারিখে খালি আছে: " : "Green dates are open for "}<span className="font-semibold text-slate-600">{sessionLabels[sessionType] || (lang === "bn" ? "আপনার সেশন" : "your session")}</span></div></div>
      <div className="flex gap-1"><button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Next month"><ChevronRight className="h-5 w-5" /></button></div>
    </div>

    {failed && <div role="alert" className="mt-3 text-sm text-red-700">Could not load availability. <button type="button" onClick={() => setRetry((value) => value + 1)} className="min-h-11 px-2 font-semibold underline">Retry</button></div>}
    {loading && <p role="status" className="mt-3 text-sm text-slate-500">Loading availability...</p>}
    <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{WEEKDAYS.map((day, index) => <div key={day} className="py-1">{lang === "bn" ? WEEKDAYS_BN[index] : day}</div>)}</div>
    <div className={`mt-1 grid grid-cols-7 gap-1 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`} aria-busy={loading}>
      {cells.map((date, index) => {
        if (!date) return <div key={`blank-${index}`} className="h-11" />;
        const dateString = ymd(date);
        const past = dateString < today;
        const info = map[dateString] || { full_day: true, half_day_morning: true, half_day_evening: true, any: true };
        const available = ready && !past && info[sessionType] !== false;
        const chosenHere = value === dateString;
        const chosenElsewhere = selected.has(dateString) && !chosenHere;
        const partial = ready && !available && !past && info.any;
        const disabled = !ready || past || !available || chosenElsewhere || !slug;
        const classes = chosenHere
          ? "bg-brand-600 text-white ring-2 ring-brand-200"
          : chosenElsewhere
            ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200"
            : available
              ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : partial
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-300";
        const stateLabel = chosenElsewhere ? (lang === "bn" ? "আগেই নির্বাচিত" : "already selected") : available ? (lang === "bn" ? "খালি আছে" : "available") : (lang === "bn" ? "খালি নেই" : "unavailable");
        const title = chosenElsewhere ? (lang === "bn" ? "আগেই নির্বাচিত" : "Already selected")
          : available ? (lang === "bn" ? `${sessionLabels[sessionType] || "অন্তত একটি সেশন"} খালি আছে` : `${sessionLabels[sessionType] || "At least one session"} available`)
          : partial ? (lang === "bn" ? "অন্য সেশন খালি থাকতে পারে" : "Other sessions may be available")
          : (lang === "bn" ? "খালি নেই" : "Unavailable");
        return <button type="button" key={dateString} disabled={disabled} onClick={() => onSelect(dateString)} title={title} className={`relative h-11 rounded-lg text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed ${classes}`} aria-label={`${date.toLocaleDateString(locale, { month: "long", day: "numeric" })}: ${stateLabel}`} aria-pressed={chosenHere}>{lang === "bn" ? new Intl.NumberFormat("bn-BD", { useGrouping: false }).format(date.getDate()) : date.getDate()}{chosenElsewhere && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-500" />}</button>;
      })}
    </div>

    <div className="mt-4 flex flex-wrap gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500">
      <Legend color="bg-emerald-100 ring-1 ring-emerald-200" label="Available" />
      <Legend color="bg-amber-100 ring-1 ring-amber-200" label="Other session open" />
      <Legend color="bg-slate-200" label="Unavailable" />
      <Legend color="bg-violet-100 ring-1 ring-violet-200" label="Already selected" />
    </div>
  </div>;
}

function Legend({ color, label }) { return <span className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded ${color}`} />{label}</span>; }
