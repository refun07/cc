import { useEffect, useMemo, useState } from "react";
import { Lock, LockOpen, ChevronLeft, ChevronRight, CalendarRange, X, Users, Clock, PartyPopper } from "lucide-react";
import { ownerAvailability, ownerToggleBlock, ownerBookings, ownerFloors } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, Card, Badge, Loading } from "../admin/ui";
import { toast } from "../../store/toastStore";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SESSIONS = [
  ["full_day", "Full Day"],
  ["half_day_morning", "Morning"],
  ["half_day_evening", "Evening"],
];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const startOfWeek = (d) => { const x = new Date(d); x.setDate(x.getDate() - x.getDay()); x.setHours(0, 0, 0, 0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export default function OwnerAvailability() {
  const [view, setView] = useState("month"); // month | week | custom
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(new Date()));
  const [customFrom, setCustomFrom] = useState(() => ymd(new Date()));
  const [customTo, setCustomTo] = useState(() => ymd(addDays(new Date(), 13)));
  const [map, setMap] = useState(null);
  const [floors, setFloors] = useState([]);
  const [floorId, setFloorId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);

  const todayStr = ymd(new Date());

  // Visible date range depends on the active view.
  const [rangeStart, rangeEnd] = useMemo(() => {
    if (view === "week") return [weekAnchor, addDays(weekAnchor, 6)];
    if (view === "custom") {
      const f = new Date(`${customFrom}T00:00:00`);
      let t = new Date(`${customTo}T00:00:00`);
      if (t < f) t = f;
      return [f, t];
    }
    return [new Date(cursor.getFullYear(), cursor.getMonth(), 1), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0)];
  }, [view, cursor, weekAnchor, customFrom, customTo]);

  const load = () => {
    setMap(null);
    ownerAvailability({ from: ymd(rangeStart), to: ymd(rangeEnd), floor_id: floorId || undefined }).then(setMap).catch(() => setMap({}));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [rangeStart, rangeEnd, floorId]);
  useEffect(() => { ownerBookings({}).then(setBookings).catch(() => setBookings([])); }, []);
  useEffect(() => {
    ownerFloors()
      .then((rows) => { const active = rows.filter((f) => f.status === "active"); setFloors(active); setFloorId(active[0]?.id ?? null); })
      .catch(() => setFloors([]));
  }, []);

  // Index bookings by each reserved date so events surface on the grid.
  const bookingsByDate = useMemo(() => {
    const idx = {};
    for (const b of bookings) {
      if (["cancelled", "refunded"].includes(b.status)) continue;
      const slots = b.booking_dates?.length ? b.booking_dates : [{ date: b.event_date, session_type: b.session_type }];
      for (const slot of slots) {
        (idx[slot.date] ||= []).push({ ...b, slot_session: slot.session_type });
      }
    }
    return idx;
  }, [bookings]);
  const bookingsFor = (date) => bookingsByDate[date] || [];

  const startStr = ymd(rangeStart);
  const endStr = ymd(rangeEnd);

  const eventsThisMonth = useMemo(() => {
    return Object.keys(bookingsByDate).filter((d) => d >= startStr && d <= endStr && d >= todayStr)
      .reduce((n, d) => n + bookingsByDate[d].length, 0);
    // eslint-disable-next-line
  }, [bookingsByDate, startStr, endStr]);

  // Build aligned calendar cells across the visible range (leading blanks to the weekday).
  const cells = useMemo(() => {
    const lead = rangeStart.getDay();
    const arr = Array.from({ length: lead }, () => null);
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) arr.push(new Date(d));
    return arr;
    // eslint-disable-next-line
  }, [startStr, endStr]);

  const statusOf = (date, s) => map?.[date]?.[s] || "available";

  // month-wide session counts for the summary strip (upcoming days only)
  const summary = useMemo(() => {
    const acc = { available: 0, blocked: 0, booked: 0 };
    if (!map) return acc;
    for (let d = new Date(rangeStart); d <= rangeEnd; d = addDays(d, 1)) {
      const ds = ymd(d);
      if (ds < todayStr) continue;
      for (const [s] of SESSIONS) {
        const st = map?.[ds]?.[s] || "available";
        if (acc[st] !== undefined) acc[st]++;
      }
    }
    return acc;
    // eslint-disable-next-line
  }, [map, startStr, endStr]);
  // overall day state for cell tint
  const dayState = (date) => {
    if (date < todayStr) return "past";
    const states = SESSIONS.map(([s]) => statusOf(date, s));
    if (states.includes("booked")) return "booked";
    if (states.every((x) => x === "blocked")) return "blocked";
    if (states.includes("blocked")) return "partial";
    return "available";
  };

  const setSession = async (date, s, block) => {
    await ownerToggleBlock({ date, session_type: s, block, floor_id: floorId || undefined });
    setMap((m) => ({ ...m, [date]: { ...(m?.[date] || {}), [s]: block ? "blocked" : "available" } }));
  };

  const toggle = async (date, s) => {
    if (statusOf(date, s) === "booked") return;
    const key = `${date}-${s}`;
    setBusy(key);
    const willBlock = statusOf(date, s) !== "blocked";
    try { await setSession(date, s, willBlock); toast.success(`${SHORT[s]} on ${date} ${willBlock ? "blocked" : "opened"}.`); }
    catch (e) { toast.error(e.response?.data?.message || "Could not update."); }
    finally { setBusy(null); }
  };

  const toggleDay = async (date) => {
    const open = SESSIONS.map(([s]) => s).filter((s) => statusOf(date, s) !== "booked");
    if (!open.length) return;
    const block = open.some((s) => statusOf(date, s) !== "blocked");
    setBusy(`day-${date}`);
    try { for (const s of open) await setSession(date, s, block); toast.success(`${date} ${block ? "blocked" : "opened"} for all sessions.`); }
    catch (e) { toast.error(e.response?.data?.message || "Could not update."); }
    finally { setBusy(null); }
  };

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
  const SHORT = { full_day: "FD", half_day_morning: "AM", half_day_evening: "PM" };

  return (
    <div>
      <PageHead title="Booking dates & availability" subtitle="Tap a date to open or block its sessions. Booked sessions are locked." />

      {floors.length > 0 && (
        <div className="mb-5">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Floor</div>
          <div className="flex flex-wrap gap-2">
            {floors.map((f) => (
              <button
                key={f.id}
                onClick={() => setFloorId(f.id)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${floorId === f.id ? "bg-emerald-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {f.name}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${floorId === f.id ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>{f.capacity}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-400">Each floor has its own calendar — blocking a date here affects only <span className="font-medium text-slate-600">{floors.find((f) => f.id === floorId)?.name}</span>.</p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryStat icon={PartyPopper} label="Events this month" value={eventsThisMonth} tint="bg-violet-50 text-violet-600" ring="ring-violet-100" sub="upcoming bookings" />
        <SummaryStat icon={LockOpen} label="Open sessions" value={summary.available} tint="bg-emerald-50 text-emerald-600" ring="ring-emerald-100" sub="this month, upcoming" />
        <SummaryStat icon={CalendarRange} label="Booked sessions" value={summary.booked} tint="bg-blue-50 text-blue-600" ring="ring-blue-100" sub="locked" />
        <SummaryStat icon={Lock} label="Blocked sessions" value={summary.blocked} tint="bg-rose-50 text-rose-600" ring="ring-rose-100" sub="unavailable" />
      </div>

      {/* Full-width calendar */}
      <Card>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="font-display text-xl font-bold text-slate-900">
            {view === "month" && cursor.toLocaleString("en-US", { month: "long", year: "numeric" })}
            {view === "week" && `${rangeStart.toLocaleDateString("en-US", { day: "numeric", month: "short" })} – ${rangeEnd.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}`}
            {view === "custom" && "Custom range"}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* view switcher */}
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
              {[["month", "Month"], ["week", "Week"], ["custom", "Custom"]].map(([v, label]) => (
                <button key={v} onClick={() => setView(v)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${view === v ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>
                  {label}
                </button>
              ))}
            </div>

            {view === "custom" ? (
              <div className="flex items-center gap-2">
                <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="input min-h-9 py-1 text-xs" />
                <span className="text-slate-400">→</span>
                <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="input min-h-9 py-1 text-xs" />
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={() => { setCursor(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }); setWeekAnchor(startOfWeek(new Date())); }} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Today</button>
                <button onClick={() => view === "week" ? setWeekAnchor(addDays(weekAnchor, -7)) : setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => view === "week" ? setWeekAnchor(addDays(weekAnchor, 7)) : setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
              </div>
            )}
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
                const isSel = selected === ds;
                const weekend = [5, 6].includes(d.getDay());
                const isToday = ds === todayStr;
                return (
                  <button
                    key={ds}
                    disabled={isPast}
                    onClick={() => setSelected(ds)}
                    title={isPast ? "Past date" : `${SESSIONS.filter(([s]) => statusOf(ds, s) === "available").length} of 3 sessions open`}
                    className={`relative flex h-28 flex-col rounded-xl border p-2 text-left transition sm:h-32 ${CELL_TINT[st]} ${isSel ? "ring-2 ring-brand-500" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-base font-bold ${weekend && !isPast ? "text-brand-700" : "text-slate-700"}`}>{d.getDate()}</span>
                      {isToday && <span className="rounded bg-brand-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">Today</span>}
                      {!isToday && weekend && !isPast && <span className="text-[9px] font-semibold uppercase text-brand-400">Wknd</span>}
                    </div>
                    {!isPast && (() => {
                      const dayBookings = bookingsFor(ds);
                      if (dayBookings.length) {
                        return (
                          <div className="mt-auto space-y-1">
                            {dayBookings.slice(0, 2).map((b) => (
                              <div key={b.id + b.slot_session} className="flex items-center gap-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                <PartyPopper className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{b.customer_name}</span>
                              </div>
                            ))}
                            {dayBookings.length > 2 && <div className="px-1 text-[9px] font-semibold text-blue-600">+{dayBookings.length - 2} more</div>}
                          </div>
                        );
                      }
                      return (
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
                      );
                    })()}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
              <Legend dot="bg-emerald-500" label="Available" />
              <Legend dot="bg-rose-500" label="Blocked" />
              <Legend dot="bg-blue-500" label="Booked (locked)" />
              <span className="text-slate-300">·</span>
              <span><b className="text-slate-600">FD</b> Full Day · <b className="text-slate-600">AM</b> Morning · <b className="text-slate-600">PM</b> Evening</span>
            </div>
          </div>
        )}
      </Card>

      {/* Day management modal */}
      {selected && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSelected(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">{new Date(selected).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}</h2>
                <p className="text-xs text-slate-500">Manage session availability</p>
              </div>
              <button onClick={() => setSelected(null)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
              {/* Events on this day */}
              {bookingsFor(selected).length > 0 && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3">
                  <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-700">
                    <PartyPopper className="h-3.5 w-3.5" /> {bookingsFor(selected).length} event{bookingsFor(selected).length > 1 ? "s" : ""} booked
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
                const locked = st === "booked";
                return (
                  <div key={s} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                    <div>
                      <div className="font-semibold text-slate-800">{label}</div>
                      <div className={`text-xs capitalize ${st === "available" ? "text-emerald-600" : st === "blocked" ? "text-rose-600" : "text-blue-600"}`}>{st}</div>
                    </div>
                    <button
                      disabled={locked || busy === `${selected}-${s}`}
                      onClick={() => toggle(selected, s)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
                        locked ? "bg-blue-100 text-blue-700" : st === "blocked" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                      }`}
                    >
                      {locked ? <><CalendarRange className="h-3.5 w-3.5" /> Booked</> : st === "blocked" ? <><LockOpen className="h-3.5 w-3.5" /> Open</> : <><Lock className="h-3.5 w-3.5" /> Block</>}
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => toggleDay(selected)}
                disabled={busy === `day-${selected}`}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                <Lock className="h-4 w-4" /> Block / open whole day
              </button>
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

function SummaryStat({ icon: Icon, label, value, tint, ring, sub }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${ring}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tint}`}><Icon className="h-5 w-5" /></span>
      <div>
        <div className="text-2xl font-extrabold tabular-nums leading-none tracking-tight text-slate-900">{value}</div>
        <div className="mt-1 text-sm font-medium text-slate-600">{label}</div>
        <div className="text-[11px] text-slate-400">{sub}</div>
      </div>
    </div>
  );
}
