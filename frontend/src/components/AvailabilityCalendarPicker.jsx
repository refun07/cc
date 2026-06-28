import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import api from "../services/api";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SESSION_LABELS = {
  full_day: "Full day",
  half_day_morning: "Morning",
  half_day_evening: "Evening",
};

const ymd = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export default function AvailabilityCalendarPicker({ slug, value, sessionType, selectedDates = [], onSelect }) {
  const [cursor, setCursor] = useState(() => {
    const date = value ? new Date(`${value}T00:00:00`) : new Date();
    return new Date(date.getFullYear(), date.getMonth(), 1);
  });
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!value) return;
    const date = new Date(`${value}T00:00:00`);
    setCursor(new Date(date.getFullYear(), date.getMonth(), 1));
  }, [value]);

  useEffect(() => {
    if (!slug) { setMap({}); return; }
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    setLoading(true);
    api.get(`/centres/${slug}/calendar`, { params: { from: ymd(start), to: ymd(end) } })
      .then((response) => setMap(Object.fromEntries(response.data.data.map((day) => [day.date, day]))))
      .catch(() => setMap({}))
      .finally(() => setLoading(false));
  }, [slug, cursor]);

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
  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });

  return <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Booking availability calendar">
    <div className="flex items-center justify-between gap-3">
      <div><div className="font-display text-base font-bold text-slate-900">{monthLabel}</div><div className="text-[11px] text-slate-500">Showing {SESSION_LABELS[sessionType] || "selected session"} availability</div></div>
      <div className="flex gap-1"><button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Previous month"><ChevronLeft className="h-5 w-5" /></button><button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="grid h-11 w-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label="Next month"><ChevronRight className="h-5 w-5" /></button></div>
    </div>

    <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">{WEEKDAYS.map((day) => <div key={day} className="py-1">{day}</div>)}</div>
    <div className={`mt-1 grid grid-cols-7 gap-1 transition-opacity ${loading ? "opacity-50" : "opacity-100"}`} aria-busy={loading}>
      {cells.map((date, index) => {
        if (!date) return <div key={`blank-${index}`} className="aspect-square" />;
        const dateString = ymd(date);
        const past = dateString < today;
        const info = map[dateString] || { full_day: true, half_day_morning: true, half_day_evening: true, any: true };
        const available = !past && info[sessionType] !== false;
        const chosenHere = value === dateString;
        const chosenElsewhere = selected.has(dateString) && !chosenHere;
        const partial = !available && !past && info.any;
        const disabled = past || !available || chosenElsewhere || !slug;
        const classes = chosenHere
          ? "bg-brand-600 text-white ring-2 ring-brand-200"
          : chosenElsewhere
            ? "bg-violet-100 text-violet-700 ring-1 ring-violet-200"
            : available
              ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              : partial
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-300";
        return <button type="button" key={dateString} disabled={disabled} onClick={() => onSelect(dateString)} title={chosenElsewhere ? "Already selected" : available ? `${SESSION_LABELS[sessionType]} available` : partial ? "Other sessions may be available" : "Unavailable"} className={`relative aspect-square min-h-10 rounded-xl text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:cursor-not-allowed ${classes}`} aria-label={`${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}: ${chosenElsewhere ? "already selected" : available ? "available" : "unavailable"}`} aria-pressed={chosenHere}>{date.getDate()}{chosenElsewhere && <span className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-violet-500" />}</button>;
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
