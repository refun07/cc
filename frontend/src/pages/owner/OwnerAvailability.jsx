import { useEffect, useMemo, useState } from "react";
import { Lock, LockOpen, ChevronLeft, ChevronRight, CalendarRange } from "lucide-react";
import { ownerAvailability, ownerToggleBlock } from "../../services/api";
import { PageHead, Card, Loading } from "../admin/ui";
import { toast } from "../../store/toastStore";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SESSIONS = [
  ["full_day", "Full Day"],
  ["half_day_morning", "Morning"],
  ["half_day_evening", "Evening"],
];

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function OwnerAvailability() {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(null);

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const todayStr = ymd(new Date());

  const load = () => {
    setMap(null);
    ownerAvailability({ from: ymd(monthStart), to: ymd(monthEnd) }).then(setMap).catch(() => setMap({}));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor]);

  const cells = useMemo(() => {
    const lead = monthStart.getDay();
    const arr = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= monthEnd.getDate(); d++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return arr;
    // eslint-disable-next-line
  }, [cursor]);

  const statusOf = (date, s) => map?.[date]?.[s] || "available";
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
    await ownerToggleBlock({ date, session_type: s, block });
    setMap((m) => ({ ...m, [date]: { ...(m?.[date] || {}), [s]: block ? "blocked" : "available" } }));
  };

  const toggle = async (date, s) => {
    if (statusOf(date, s) === "booked") return;
    const key = `${date}-${s}`;
    setBusy(key);
    try { await setSession(date, s, statusOf(date, s) !== "blocked"); }
    catch (e) { toast.error(e.response?.data?.message || "Could not update."); }
    finally { setBusy(null); }
  };

  const toggleDay = async (date) => {
    const open = SESSIONS.map(([s]) => s).filter((s) => statusOf(date, s) !== "booked");
    if (!open.length) return;
    const block = open.some((s) => statusOf(date, s) !== "blocked");
    setBusy(`day-${date}`);
    try { for (const s of open) await setSession(date, s, block); }
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

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Calendar */}
        <Card>
          <div className="flex items-center justify-between px-5 py-3.5">
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
            <div className="font-display text-lg font-bold text-slate-900">{cursor.toLocaleString("en-US", { month: "long", year: "numeric" })}</div>
            <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
          </div>

          {!map ? <Loading rows={5} /> : (
            <div className="px-4 pb-4">
              <div className="mb-1 grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-slate-400">
                {WD.map((w) => <div key={w}>{w}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
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
                      className={`relative flex h-24 flex-col rounded-xl border p-1.5 text-left text-sm transition ${CELL_TINT[st]} ${isSel ? "ring-2 ring-brand-500" : ""}`}
                    >
                      <div className="flex items-center justify-between px-0.5">
                        <span className={`font-bold ${weekend && !isPast ? "text-brand-700" : "text-slate-700"}`}>{d.getDate()}</span>
                        {isToday && <span className="rounded bg-brand-600 px-1 text-[9px] font-bold uppercase text-white">Today</span>}
                        {!isToday && weekend && !isPast && <span className="text-[9px] font-semibold uppercase text-brand-400">Wknd</span>}
                      </div>
                      {!isPast && (
                        <div className="mt-auto space-y-0.5">
                          {SESSIONS.map(([s]) => {
                            const ss = statusOf(ds, s);
                            return (
                              <div key={s} className={`flex items-center justify-between rounded px-1 py-px text-[9px] font-semibold ${CHIP[ss] || "bg-slate-100 text-slate-400"}`}>
                                <span>{SHORT[s]}</span>
                                <span className="capitalize opacity-80">{ss === "available" ? "open" : ss === "booked" ? "booked" : "blocked"}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-slate-500">
                <Legend dot="bg-emerald-500" label="Available" />
                <Legend dot="bg-rose-500" label="Blocked" />
                <Legend dot="bg-blue-500" label="Booked (locked)" />
                <span className="text-slate-300">·</span>
                <span><b className="text-slate-600">FD</b> Full Day · <b className="text-slate-600">AM</b> Morning · <b className="text-slate-600">PM</b> Evening</span>
              </div>
            </div>
          )}
        </Card>

        {/* Selected day panel */}
        <Card title={selected ? new Date(selected).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }) : "Select a date"}>
          {!selected ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center text-sm text-slate-400">
              <CalendarRange className="h-8 w-8 text-slate-300" />
              Pick a date on the calendar to manage its sessions.
            </div>
          ) : (
            <div className="space-y-3 p-5">
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
          )}
        </Card>
      </div>
    </div>
  );
}

function Legend({ dot, label }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${dot}`} /> {label}</span>;
}
