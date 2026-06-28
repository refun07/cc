import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Wallet, CalendarCheck, Clock, CalendarDays, UtensilsCrossed, CheckCircle2,
  ArrowRight, Star, CalendarRange, Store, MapPin, TrendingUp,
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

  const KPIS = [
    { icon: Wallet, label: "Revenue collected", value: taka(s.revenue), accent: "from-emerald-500 to-brand-600" },
    { icon: CalendarCheck, label: "Total bookings", value: s.bookings, accent: "from-blue-500 to-indigo-600" },
    { icon: Clock, label: "Pending review", value: s.pending_review, accent: "from-amber-500 to-orange-600" },
    { icon: CalendarDays, label: "Upcoming events", value: s.upcoming, accent: "from-violet-500 to-purple-600" },
  ];

  const SECONDARY = [
    { icon: CheckCircle2, label: "Confirmed", value: s.confirmed },
    { icon: TrendingUp, label: "Completed", value: s.completed },
    { icon: UtensilsCrossed, label: "Food menus", value: s.menus },
    { icon: Wallet, label: "Outstanding due", value: taka(s.due_amount) },
  ];

  return (
    <div className="space-y-6">
      {/* ---- Venue header band ---- */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white">
        {c.cover_image && (
          <img src={c.cover_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-900/30" />
        <div className="relative flex flex-wrap items-center justify-between gap-4 p-6 sm:p-8">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-300">
              <Store className="h-3.5 w-3.5" /> Community Centre Panel
            </div>
            <h1 className="mt-1.5 font-display text-2xl font-bold sm:text-3xl">{c.name || "Your centre"}</h1>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-300">
              <MapPin className="h-4 w-4" /> {c.area}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold backdrop-blur">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {Number(c.rating || 0).toFixed(1)}
            </span>
            <Badge status={c.status} />
          </div>
        </div>
      </div>

      {/* ---- KPI row ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {KPIS.map((k) => (
          <div key={k.label} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
            <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${k.accent} opacity-10`} />
            <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${k.accent} text-white shadow-sm`}>
              <k.icon className="h-5 w-5" />
            </span>
            <div className="mt-3 text-2xl font-extrabold tabular-nums text-slate-900">{k.value}</div>
            <div className="text-sm text-slate-500">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ---- Main grid: bookings + side panel ---- */}
      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card title="Recent bookings" action={<Link to="/owner/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">View all <ArrowRight className="h-4 w-4" /></Link>}>
          {recent.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400">No bookings yet.</div>
          ) : (
            <Table head={["Booking", "Customer", "Date", "Total", "Status"]}>
              {recent.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="font-mono text-xs text-slate-500">{b.booking_no}</div>
                    <div className="text-xs text-slate-400">{b.date_count > 1 ? `${b.date_count} dates` : sessionLabel(b.session_type)}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{b.customer_name}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{b.event_date}{b.date_count > 1 && <div className="text-xs text-brand-600">+{b.date_count - 1} more</div>}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{taka(b.total_amount)}</td>
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
                <div key={x.label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="inline-flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-500"><x.icon className="h-4 w-4" /></span>
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
              <QuickLink to="/owner/menus" icon={UtensilsCrossed} label="Food menus" />
              <QuickLink to="/owner/profile" icon={Store} label="Venue profile" />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ to, icon: Icon, label }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 px-3 py-4 text-center text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700">
      <Icon className="h-5 w-5" /> {label}
    </Link>
  );
}
