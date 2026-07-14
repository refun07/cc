import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2, CalendarCheck, Wallet, Receipt, Users, Clock, Percent, ArrowRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { adminDashboard } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, StatCard, Card, Table, Badge, Loading } from "./ui";

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  useEffect(() => { adminDashboard().then(setData).catch(() => setData({ stats: {}, trend: [], recent_bookings: { data: [] } })); }, []);

  if (!data) return <Loading rows={4} />;
  const s = data.stats || {};
  const recent = data.recent_bookings?.data || data.recent_bookings || [];

  return (
    <div>
      <PageHead title="Marketplace overview" subtitle="Live snapshot of the DSCC community-centre marketplace." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Community centres" value={s.centres} accent="brand" />
        <StatCard icon={CalendarCheck} label="Total bookings" value={s.bookings} accent="blue" />
        <StatCard icon={Wallet} label="GMV" value={s.gmv} money accent="emerald" />
        <StatCard icon={Percent} label="Commission" value={s.commission} money accent="violet" />
        <StatCard icon={Receipt} label="VAT collected" value={s.vat} money accent="amber" />
        <StatCard icon={Users} label="Customers" value={s.customers} accent="blue" />
        <StatCard icon={Clock} label="Pending review" value={s.pending_review} accent="amber" />
        <StatCard icon={Building2} label="Active centres" value={s.active_centres} accent="emerald" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card title="Booking revenue trend">
          <div className="h-64 p-4">
            {data.trend?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ left: -10, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#059669" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={50}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} />
                  <Tooltip formatter={(v) => taka(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2.5} fill="url(#rev)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-sm text-slate-400">No revenue data yet.</div>
            )}
          </div>
        </Card>

        <Card title="Recent bookings" action={<Link to="/admin/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">All <ArrowRight className="h-4 w-4" /></Link>}>
          <Table head={["Booking", "Centre", "Amount", "Status"]}>
            {recent.slice(0, 6).map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-mono text-xs text-slate-500">{b.booking_no}</div>
                  <div className="text-xs text-slate-400">{b.date_count > 1 ? `${b.date_count} dates` : sessionLabel(b.session_type)}</div>
                </td>
                <td className="px-5 py-3 text-slate-700">{b.centre?.name}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{taka(b.total_amount)}</td>
                <td className="px-5 py-3"><Badge status={b.status} /></td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-400">No bookings yet.</td></tr>
            )}
          </Table>
        </Card>
      </div>
    </div>
  );
}
