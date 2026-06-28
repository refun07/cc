import { useEffect, useMemo, useState } from "react";
import api from "../services/api";

const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Availability-aware month calendar.
 * Calls onSelect(dateStr, dayAvailability) when an open date is clicked.
 */
export default function BookingCalendar({ slug, value, onSelect }) {
  const [cursor, setCursor] = useState(() => {
    const d = value ? new Date(value) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [map, setMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    setLoading(true);
    api
      .get(`/centres/${slug}/calendar`, { params: { from: ymd(start), to: ymd(end) } })
      .then((r) => {
        const m = {};
        r.data.data.forEach((d) => (m[d.date] = d));
        setMap(m);
      })
      .finally(() => setLoading(false));
  }, [slug, cursor]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysIn = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const lead = first.getDay();
    const arr = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= daysIn; d++) {
      arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    }
    return arr;
  }, [cursor]);

  const today = ymd(new Date());
  const monthLabel = cursor.toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
          className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          ‹
        </button>
        <div className="text-sm font-semibold text-slate-800">
          {monthLabel} {loading && <span className="text-slate-300">…</span>}
        </div>
        <button
          type="button"
          onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
          className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-500"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-slate-400 mb-1">
        {WD.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const ds = ymd(d);
          const past = ds <= today;
          const info = map[ds];
          // No slot record => treat as fully available (seed covers 45 days only).
          const available = past ? false : info ? info.any : true;
          const selected = value === ds;

          return (
            <button
              type="button"
              key={ds}
              disabled={!available}
              onClick={() => onSelect(ds, info || { full_day: true, half_day_morning: true, half_day_evening: true })}
              className={`h-9 rounded-lg text-sm transition ${
                selected
                  ? "bg-brand-600 text-white font-semibold"
                  : available
                  ? "hover:bg-brand-50 text-slate-700"
                  : "text-slate-300 line-through cursor-not-allowed"
              }`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-400">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-brand-500" /> Selected
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-slate-200" /> Booked / unavailable
        </span>
      </div>
    </div>
  );
}
