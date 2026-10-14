import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X, Users, Clock, PartyPopper, Lock, LockOpen, CalendarRange, Building2 } from "lucide-react";
import api, { adminCentres, adminBookings } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, Card, Badge, Loading } from "./ui";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SESSIONS = [
  ["full_day", "Full Day"],
  ["half_day_morning", "Morning"],
  ["half_day_evening", "Evening"],
];
const SHORT = { full_day: "FD", half_day_morning: "AM", half_day_evening: "PM" };
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function AdminCalendar() {
  const [centres, setCentres] = useState(null);
  const [slug, setSlug] = useState("");
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [map, setMap] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const todayStr = ymd(new Date());

  useEffect(() => {
    adminCentres().then((list) => { setCentres(list); if (list[0]) setSlug(list[0].slug); }).catch(() => setCentres([]));
    adminBookings({}).then(setBookings).catch(() => setBookings([]));
  }, []);

  useEffect(() => {
    if (!slug) return;
    setMap(null);
    api.get(`/centres/${slug}/availability`, { params: { from: ymd(monthStart), to: ymd(monthEnd) } })
      .then((r) => {
        const m = {};
        for (const s of r.data.data) { (m[s.date] ||= {})[s.session_type] = s.status; }
        setMap(m);
      })
      .catch(() => setMap({}));
    // eslint-disable-next-line
  }, [slug, cursor]);

  const selectedCentre = centres?.find((c) => c.slug === slug);

  const bookingsByDate = useMemo(() => {
    const idx = {};
    for (const b of bookings) {
      if (b.centre?.slug !== slug || ["cancelled", "refunded"].includes(b.status)) continue;
      const slots = b.booking_dates?.length ? b.booking_dates : [{ date: b.event_date, session_type: b.session_type }];
      for (const slot of slots) (idx[slot.date] ||= []).push({ ...b, slot_session: slot.session_type });
    }
    return idx;
  }, [bookings, slug]);
  const bookingsFor = (date) => bookingsByDate[date] || [];

  const cells = useMemo(() => {
    const lead = monthStart.getDay();
    const arr = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= monthEnd.getDate(); d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return arr;
    // eslint-disable-next-line
  }, [cursor]);

  const statusOf = (date, s) => map?.[date]?.[s] || "available";
  const dayState = (date) => {
    if (date < todayStr) return "past";
    const states = SESSIONS.map(([s]) => statusOf(date, s));
    if (bookingsFor(date).length || states.includes("booked")) return "booked";
    if (states.every((x) => x === "blocked")) return "blocked";
    if (states.includes("blocked")) return "partial";
    return "available";
  };

  const eventsThisMonth = useMemo(() => {
    const prefix = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    return Object.keys(bookingsByDate).filter((d) => d.startsWith(prefix)).reduce((n, d) => n + bookingsByDate[d].length, 0);
  }, [bookingsByDate, cursor]);

  const CELL_TINT = {
    available: "bg-emerald-50 hover:bg-emerald-100 border-emerald-100",
    partial: "bg-amber-50 hover:bg-amber-100 border-amber-200",
    blocked: "bg-rose-50 hover:bg-rose-100 border-rose-200",
    booked: "bg-blue-50 hover:bg-blue-100 border-blue-200",
    past: "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed",
  };
  const CHIP = {
    available: "bg-emerald-100 text-emerald-700",
    blocked: "bg-rose-100 text-rose-700",
    booked: "bg-blue-100 text-blue-700",
  };

  return (
    <div>
      <PageHead title="Booking calendar" subtitle="Every centre's availability and events on one calendar." >
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="input min-h-11 min-w-[220px]">
          {(centres || []).map((c) => <option key={c.id} value={c.slug}>{c.name} · {c.area}</option>)}
        </select>
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <MiniStat icon={PartyPopper} label="Events this month" value={eventsThisMonth} accent="from-violet-500 to-purple-600" />
        <MiniStat icon={Building2} label="Centre" value={selectedCentre?.name || "—"} accent="from-blue-500 to-indigo-600" text />
        <MiniStat icon={CalendarRange} label="Capacity" value={selectedCentre ? `${Number(selectedCentre.capacity).toLocaleString()} guests` : "—"} accent="from-emerald-500 to-teal-600" text />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="font-display text-xl font-bold text-slate-900">{cursor.toLocaleString("en-US", { month: "long", year: "numeric" })}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => setCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); })} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Today</button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>

        {!map ? <Loading rows={6} /> : (
          <div className="p-4 sm:p-6">
            <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
              {WD.map((w) => <div key={w}>{w}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {cells.map((d, i) => {
                if (!d) return <div key={i} />;
                const ds = ymd(d);
                const st = dayState(ds);
                const isPast = st === "past";
                const weekend = [5, 6].includes(d.getDay());
                const isToday = ds === todayStr;
                const dayBookings = bookingsFor(ds);
                return (
                  <button key={ds} disabled={isPast} onClick={() => setSelected(ds)}
                    className={`relative flex h-28 flex-col rounded-xl border p-2 text-left transition sm:h-32 ${CELL_TINT[st]} ${selected === ds ? "ring-2 ring-brand-500" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-bold ${weekend && !isPast ? "text-brand-700" : "text-slate-700"}`}>{d.getDate()}</span>
                      {isToday && <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Today</span>}
                      {!isToday && weekend && !isPast && <span className="text-[9px] font-semibold uppercase text-brand-400">Wknd</span>}
                    </div>
                    {!isPast && (dayBookings.length ? (
                      <div className="mt-auto space-y-1">
                        {dayBookings.slice(0, 2).map((b) => (
                          <div key={b.id + b.slot_session} className="flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                            <PartyPopper className="h-2.5 w-2.5 shrink-0" /><span className="truncate">{b.customer_name}</span>
                          </div>
                        ))}
                        {dayBookings.length > 2 && <div className="px-1 text-[9px] font-semibold text-blue-600">+{dayBookings.length - 2} more</div>}
                      </div>
                    ) : (
                      <div className="mt-auto space-y-1">
                        {SESSIONS.map(([s]) => {
                          const ss = statusOf(ds, s);
                          return (
                            <div key={s} className={`flex items-center justify-between rounded px-1.5 py-0.5 text-[10px] font-semibold ${CHIP[ss] || "bg-slate-100 text-slate-400"}`}>
                              <span>{SHORT[s]}</span>
                              <span className="capitalize opacity-80">{ss === "available" ? "open" : ss === "booked" ? "booked" : "blocked"}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              <Legend dot="bg-emerald-500" label="Available" />
              <Legend dot="bg-rose-500" label="Blocked" />
              <Legend dot="bg-blue-500" label="Booked event" />
              <span className="text-slate-300">·</span>
              <span><b className="text-slate-600">FD</b> Full Day · <b className="text-slate-600">AM</b> Morning · <b className="text-slate-600">PM</b> Evening</span>
            </div>
          </div>
        )}
      </Card>

      {/* Day detail modal (read-only) */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">{new Date(selected).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</h2>
                <p className="text-xs text-slate-500">{selectedCentre?.name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              {bookingsFor(selected).length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                  <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    <PartyPopper className="h-3.5 w-3.5" /> {bookingsFor(selected).length} event{bookingsFor(selected).length > 1 ? "s" : ""}
                  </div>
                  <div className="space-y-2">
                    {bookingsFor(selected).map((b) => (
                      <div key={b.id + b.slot_session} className="rounded-lg bg-white p-3 shadow-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-semibold text-slate-900">{b.customer_name}</div>
                          <Badge status={b.status} />
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {sessionLabel(b.slot_session)}</span>
                          <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {b.guest_count}</span>
                          {b.event_type && <span className="rounded bg-brand-50 px-1.5 font-semibold text-brand-700">{b.event_type}</span>}
                          <span className="font-mono">{b.booking_no}</span>
                        </div>
                        <div className="mt-1 text-sm font-bold text-slate-900">{taka(b.total_amount)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Session availability</div>
              {SESSIONS.map(([s, label]) => {
                const st = statusOf(selected, s);
                return (
                  <div key={s} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div className="font-semibold text-slate-800">{label}</div>
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${st === "available" ? "bg-emerald-50 text-emerald-700" : st === "booked" ? "bg-blue-100 text-blue-700" : "bg-rose-50 text-rose-700"}`}>
                      {st === "available" ? <><LockOpen className="h-3.5 w-3.5" /> Open</> : st === "booked" ? <><CalendarRange className="h-3.5 w-3.5" /> Booked</> : <><Lock className="h-3.5 w-3.5" /> Blocked</>}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Legend({ dot, label }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${dot}`} /> {label}</span>;
}
function MiniStat({ icon: Icon, label, value, accent, text }) {
  return (
    <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${accent} text-white`}><Icon className="h-5 w-5" /></span>
      <div className="min-w-0">
        <div className={`truncate font-extrabold tracking-tight text-slate-900 ${text ? "text-base" : "text-2xl tabular-nums"}`}>{value}</div>
        <div className="text-xs font-medium text-slate-500">{label}</div>
      </div>
    </div>
  );
}
