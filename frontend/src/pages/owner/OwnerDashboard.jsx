import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, CalendarCheck, Clock, CalendarDays, CheckCircle2,
  ArrowRight, ArrowUpRight, Star, CalendarRange, Store, MapPin, TrendingUp, Receipt, Percent,
} from "lucide-react";
import { ownerDashboard } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { Card, Table, Badge, Loading } from "../admin/ui";

export default function OwnerDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { ownerDashboard().then(setData).catch(() => setData(null)); }, []);
  if (!data) return <Loading rows={4} />;
  const s = data.stats;
  const c = data.centre || {};
  const recent = data.recent_bookings?.data || [];

  const billed = Number(s.revenue || 0) + Number(s.due_amount || 0);
  const collectedPct = billed > 0 ? Math.round((Number(s.revenue || 0) / billed) * 100) : 0;

  const KPIS = [
    { icon: Wallet, label: "Revenue collected", value: taka(s.revenue), accent: "from-emerald-500 to-teal-600", ring: "ring-emerald-100" },
    { icon: CalendarCheck, label: "Total bookings", value: s.bookings, accent: "from-blue-500 to-indigo-600", ring: "ring-blue-100" },
    { icon: Clock, label: "Pending review", value: s.pending_review, accent: "from-amber-500 to-orange-600", ring: "ring-amber-100" },
    { icon: CalendarDays, label: "Upcoming events", value: s.upcoming, accent: "from-violet-500 to-purple-600", ring: "ring-violet-100" },
  ];

  const SECONDARY = [
    { icon: CheckCircle2, label: "Confirmed", value: s.confirmed, tint: "bg-emerald-50 text-emerald-600" },
    { icon: TrendingUp, label: "Completed", value: s.completed, tint: "bg-blue-50 text-blue-600" },
    { icon: Receipt, label: "VAT collected", value: taka(s.vat), tint: "bg-indigo-50 text-indigo-600" },
    { icon: Percent, label: "Service charge (tax)", value: taka(s.service_charge), tint: "bg-violet-50 text-violet-600" },
    { icon: Wallet, label: "Outstanding due", value: taka(s.due_amount), tint: "bg-rose-50 text-rose-600" },
  ];

  return (
    <div className="space-y-6">
      {/* ---- Venue header band ---- */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white shadow-xl shadow-slate-900/10">
        {c.cover_image && (
          <img src={c.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900/85 to-slate-800/40" />
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4 p-6 sm:p-8">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-300 backdrop-blur">
              <Store className="h-3.5 w-3.5" /> Community Centre Panel
            </div>
            <h1 className="mt-3 font-display text-2xl font-bold sm:text-3xl">{c.name || "Your centre"}</h1>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-slate-300">
              <MapPin className="h-4 w-4" /> {c.area}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur ring-1 ring-white/10">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {Number(c.rating || 0).toFixed(1)}
            </span>
            <Badge status={c.status} />
          </div>
        </div>

        {/* collection progress strip */}
        <div className="relative border-t border-white/10 bg-white/[0.03] px-6 py-4 sm:px-8 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
            <span className="font-medium text-slate-300">Payment collection</span>
            <span className="tabular-nums text-slate-400">
              <span className="font-semibold text-white">{taka(s.revenue)}</span> collected of {taka(billed)} billed
            </span>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all" style={{ width: `${collectedPct}%` }} />
            </div>
            <span className="w-10 text-right text-xs font-bold tabular-nums text-emerald-300">{collectedPct}%</span>
          </div>
        </div>
      </div>

      {/* ---- KPI row ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <div
            key={k.label}
            className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${k.ring}`}
          >
            <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${k.accent} opacity-10 transition-transform group-hover:scale-125`} />
            <div className="flex items-start justify-between">
              <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${k.accent} text-white shadow-sm shadow-slate-900/10`}>
                <k.icon className="h-5 w-5" />
              </span>
            </div>
            <div className="mt-4 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">{k.value}</div>
            <div className="mt-0.5 text-sm font-medium text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ---- Main grid: bookings + side panel ---- */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Recent bookings" action={<Link to="/owner/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:gap-1.5 transition-all">View all <ArrowRight className="h-4 w-4" /></Link>}>
          {recent.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">No bookings yet.</div>
          ) : (
            <Table head={["Customer", "Booking", "Date", "Total", "Status"]}>
              {recent.map((b) => (
                <tr key={b.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-indigo-500 text-xs font-bold text-white">
                        {initials(b.customer_name)}
                      </span>
                      <span className="font-medium text-slate-800">{b.customer_name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-mono text-xs text-slate-500">{b.booking_no}</div>
                    <div className="text-xs text-slate-400">{b.date_count > 1 ? `${b.date_count} dates` : sessionLabel(b.session_type)}</div>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{b.event_date}{b.date_count > 1 && <div className="text-xs text-brand-600">+{b.date_count - 1} more</div>}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums text-slate-900">{taka(b.total_amount)}</td>
                  <td className="px-5 py-3"><Badge status={b.status} /></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="At a glance">
            <div className="divide-y divide-slate-50">
              {SECONDARY.map((x) => (
                <div key={x.label} className="flex items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50/60">
                  <span className="inline-flex items-center gap-2.5 text-sm text-slate-600">
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${x.tint}`}><x.icon className="h-4 w-4" /></span>
                    {x.label}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">{x.value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Quick actions">
            <div className="grid grid-cols-2 gap-3 p-4">
              <QuickLink to="/owner/bookings" icon={CalendarCheck} label="Bookings" />
              <QuickLink to="/owner/availability" icon={CalendarRange} label="Availability" />
              <QuickLink to="/owner/reports" icon={TrendingUp} label="Reports" />
              <QuickLink to="/owner/profile" icon={Store} label="Venue profile" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?";
}

function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="group flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
      <span className="inline-flex items-center gap-2.5">
        <Icon className="h-5 w-5 text-slate-400 transition-colors group-hover:text-brand-600" /> {label}
      </span>
      <ArrowUpRight className="h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}
