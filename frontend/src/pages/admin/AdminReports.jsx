import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Wallet, Percent, Receipt, RotateCcw, CalendarCheck, TrendingUp, Download } from "lucide-react";
import { adminReports, adminExport } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, StatCard, Card, Loading } from "./ui";
import { toast } from "../../store/toastStore";

const COLORS = ["#059669", "#2563eb", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6", "#64748b"];

export default function AdminReports() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  useEffect(() => { adminReports().then(setD).catch(() => setD(null)); }, []);
  if (!d) return <Loading rows={4} />;
  const t = d.totals;

  const exportCsv = async (type) => {
    setBusy(type);
    try { await adminExport(type); toast.success(`${type} exported.`); }
    catch { toast.error("Export failed."); }
    finally { setBusy(""); }
  };

  return (
    <div>
      <PageHead title="Marketplace reports" subtitle="GMV, commission, VAT and growth analytics.">
        <div className="flex gap-2">
          <button onClick={() => exportCsv("bookings")} disabled={busy === "bookings"} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> Bookings CSV
          </button>
          <button onClick={() => exportCsv("payments")} disabled={busy === "payments"} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> Payments CSV
          </button>
        </div>
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Wallet} label="Total GMV" value={t.gmv} money accent="emerald" />
        <StatCard icon={Percent} label="Commission" value={t.commission} money accent="violet" />
        <StatCard icon={Receipt} label="VAT collected" value={t.vat} money accent="amber" />
        <StatCard icon={RotateCcw} label="Refunds" value={t.refunds} money accent="rose" />
        <StatCard icon={CalendarCheck} label="Total bookings" value={t.bookings} accent="blue" />
        <StatCard icon={TrendingUp} label="Avg booking value" value={t.avg_booking} money accent="brand" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card title="GMV & commission trend">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={d.trend} margin={{ left: -8, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.35} /><stop offset="100%" stopColor="#059669" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <Tooltip formatter={(v) => taka(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="gmv" name="GMV" stroke="#059669" strokeWidth={2.5} fill="url(#g1)" />
                <Area type="monotone" dataKey="commission" name="Commission" stroke="#8b5cf6" strokeWidth={2} fillOpacity={0} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Bookings by status">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={d.by_status} dataKey="count" nameKey="status" innerRadius={45} outerRadius={85} paddingAngle={2}>
                  {d.by_status.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Top centres by revenue">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.top_centres} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `${Math.round(v / 1000)}k` : v} />
                <YAxis type="category" dataKey="centre" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={130} />
                <Tooltip formatter={(v) => taka(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="revenue" fill="#059669" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="User growth">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.user_growth} margin={{ left: -8, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="users" name="New users" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
