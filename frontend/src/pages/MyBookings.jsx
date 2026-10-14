import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays, MapPin, ArrowRight, CalendarCheck, Clock,
  Users, Sparkles, Search, CalendarClock, ReceiptText, Hourglass, Tickets,
} from "lucide-react";
import { fetchMyBookings } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { taka, sessionLabel } from "../lib/format";

const STATUS_STYLES = {
  confirmed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  payment_pending: "bg-amber-100 text-amber-700",
  pending_review: "bg-blue-100 text-blue-700",
  cancelled: "bg-rose-100 text-rose-700",
  completed: "bg-slate-200 text-slate-700",
  refunded: "bg-violet-100 text-violet-700",
};

const FILTERS = [
  ["all", "All"],
  ["upcoming", "Upcoming"],
  ["pending", "Pending"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
];

const today = new Date().toISOString().slice(0, 10);

export default function MyBookings() {
  const user = useAuthStore((s) => s.user);
  const [bookings, setBookings] = useState(null);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (user) fetchMyBookings().then(setBookings).catch(() => setBookings([]));
  }, [user]);

  const stats = useMemo(() => {
    const list = bookings || [];
    return {
      total: list.length,
      upcoming: list.filter((b) => b.event_date >= today && !["cancelled", "completed"].includes(b.status)).length,
      spent: list.reduce((sum, b) => sum + Number(b.paid_amount || 0), 0),
      due: list.reduce((sum, b) => sum + Number(b.due_amount || 0), 0),
    };
  }, [bookings]);

  const filtered = useMemo(() => {
    let list = bookings || [];
    if (filter === "upcoming") list = list.filter((b) => b.event_date >= today && !["cancelled", "completed"].includes(b.status));
    else if (filter === "pending") list = list.filter((b) => ["payment_pending", "pending_review"].includes(b.status));
    else if (filter === "completed") list = list.filter((b) => b.status === "completed");
    else if (filter === "cancelled") list = list.filter((b) => ["cancelled", "refunded"].includes(b.status));
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => b.centre.name.toLowerCase().includes(q) || b.booking_no.toLowerCase().includes(q) || (b.event_type || "").toLowerCase().includes(q));
    return list;
  }, [bookings, filter, query]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-500">
        Please sign in to view your bookings.
        <Link to="/centres" className="mt-4 block font-semibold text-brand-700">Browse centres →</Link>
      </div>
    );
  }

  const KPIS = [
    { icon: Tickets, label: "Total bookings", value: stats.total, accent: "from-blue-500 to-indigo-600", ring: "hover:ring-blue-100" },
    { icon: CalendarClock, label: "Upcoming events", value: stats.upcoming, accent: "from-emerald-500 to-teal-600", ring: "hover:ring-emerald-100" },
    { icon: ReceiptText, label: "Total paid", value: taka(stats.spent), accent: "from-violet-500 to-purple-600", ring: "hover:ring-violet-100" },
    { icon: Hourglass, label: "Outstanding due", value: taka(stats.due), accent: "from-amber-500 to-orange-600", ring: "hover:ring-amber-100" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl shadow-slate-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/10 text-xl font-bold backdrop-blur ring-1 ring-white/15">
              {user.name?.[0]?.toUpperCase() || "U"}
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-200 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> My account
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">Hi {user.name.split(" ")[0]} 👋</h1>
              <p className="mt-0.5 text-sm text-slate-300">Manage your event bookings and payments.</p>
            </div>
          </div>
          <Link to="/centres" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]">
            <CalendarCheck className="h-4 w-4" /> Book a centre
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-6 grid gap-3 sm:gap-4 grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${k.ring}`}>
            <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${k.accent} opacity-10`} />
            <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${k.accent} text-white shadow-sm`}>
              <k.icon className="h-5 w-5" />
            </span>
            <div className="mt-3 text-xl font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-2xl">{k.value}</div>
            <div className="text-xs font-medium text-slate-500 sm:text-sm">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                filter === key ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bookings…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {/* List */}
      {bookings === null ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 skeleton rounded-2xl bg-slate-200/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center sm:p-16">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
            <CalendarCheck className="h-7 w-7" />
          </div>
          <p className="mt-4 font-semibold text-slate-700">{bookings.length === 0 ? "No bookings yet" : "No bookings match this view"}</p>
          <p className="mt-1 text-sm text-slate-400">{bookings.length === 0 ? "Your confirmed events will appear here." : "Try a different filter or search term."}</p>
          {bookings.length === 0 && (
            <Link to="/centres" className="mt-5 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              Book a centre
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {filtered.map((b) => {
            const mixed = new Set((b.booking_dates || []).map((s) => s.session_type)).size > 1;
            return (
              <Link
                key={b.id}
                to={`/booking/${b.booking_no}`}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-slate-400">{b.booking_no}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLES[b.status] || "bg-slate-100 text-slate-600"}`}>
                    {b.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="mt-2 text-lg font-bold leading-tight text-slate-900">{b.centre.name}</div>
                <div className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" /> {b.centre.area}
                </div>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    {b.event_date}{b.date_count > 1 ? ` +${b.date_count - 1} more` : ""}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-slate-400" />
                    {mixed ? "Mixed sessions" : sessionLabel(b.session_type)}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-slate-400" /> {b.guest_count}
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
                  <div>
                    <div className="text-xl font-extrabold tabular-nums text-slate-900">{taka(b.total_amount)}</div>
                    {b.due_amount > 0 ? (
                      <div className="text-xs font-medium text-amber-600">Due {taka(b.due_amount)}</div>
                    ) : (
                      <div className="text-xs font-medium text-emerald-600">Fully paid</div>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
                    View <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
