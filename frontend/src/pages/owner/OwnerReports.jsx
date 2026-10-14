import { useEffect, useState } from "react";
import { Wallet, Receipt, Users, Boxes, Recycle, TrendingUp, AlertTriangle, Leaf } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ownerReports } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, StatCard, Card, Loading } from "../admin/ui";

export default function OwnerReports() {
  const [r, setR] = useState(null);
  useEffect(() => { ownerReports().then(setR).catch(() => setR(null)); }, []);
  if (!r) return <Loading rows={4} />;

  const net = r.revenue - r.expenses_paid;

  return (
    <div>
      <PageHead title="Reports" subtitle="Financial, staffing, inventory and zero-waste summary for your centre." />

      {r.monthly?.length > 0 && (
        <Card title="Revenue vs expense" action={<span className="text-xs text-slate-400">Last 6 months</span>}>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={r.monthly} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#059669" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => taka(v)} />
                <Tooltip formatter={(v, n) => [taka(v), n === "revenue" ? "Revenue" : "Expense"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fill="url(#gRev)" />
                <Area type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={2} fill="url(#gExp)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-slate-400">Financial</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Revenue collected" value={r.revenue} money accent="emerald" />
        <StatCard icon={Receipt} label="Expenses paid" value={r.expenses_paid} money accent="rose" />
        <StatCard icon={TrendingUp} label="Net (rev − exp)" value={net} money accent={net >= 0 ? "brand" : "rose"} />
        <StatCard icon={Receipt} label="Expenses pending" value={r.expenses_pending} money accent="amber" />
      </div>

      <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-slate-400">Staff & inventory</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Total staff" value={r.staff} accent="blue" />
        <StatCard icon={Wallet} label="Monthly payroll" value={r.payroll} money accent="violet" />
        <StatCard icon={Boxes} label="Inventory items" value={r.inventory_items} accent="brand" />
        <StatCard icon={AlertTriangle} label="Low-stock items" value={r.low_stock} accent="amber" />
      </div>

      <h2 className="mb-3 mt-7 text-sm font-semibold uppercase tracking-wide text-slate-400">Zero waste impact</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Recycle} label="Total waste logged" value={`${r.waste_total} kg`} accent="blue" />
        <StatCard icon={Leaf} label="Diverted (recycled/composted)" value={`${r.waste_diverted} kg`} accent="emerald" />
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Diversion rate</span><span className="font-bold text-emerald-600">{r.diversion_rate}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-brand-600" style={{ width: `${r.diversion_rate}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-400">Share of event waste kept out of landfill.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
