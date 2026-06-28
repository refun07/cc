import { useEffect, useMemo, useState } from "react";
import { Building2, Leaf, PackageCheck, Recycle, Sprout, Trash2 } from "lucide-react";
import { partnerDashboard, partnerPickups } from "../../services/api";
import { PageHead, StatCard, Card, Badge, Loading } from "../admin/ui";

const OUTCOMES = {
  recycled: { label: "Recycled", icon: Recycle, color: "bg-blue-500" },
  composted: { label: "Composted", icon: Sprout, color: "bg-emerald-500" },
  returned_to_inventory: { label: "Returned to inventory", icon: PackageCheck, color: "bg-teal-500" },
  disposed_safely: { label: "Disposed safely", icon: Trash2, color: "bg-amber-500" },
};

export default function PartnerImpact() {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([partnerDashboard(), partnerPickups("completed")])
      .then(([dashboard, pickups]) => { setData(dashboard); setRows(pickups); })
      .catch(() => setError("Impact data could not be loaded. Refresh to try again."));
  }, []);

  const outcomes = useMemo(() => {
    if (!rows) return [];
    const totals = rows.filter((row) => row.unit === "kg").reduce((result, row) => {
      result[row.status] = (result[row.status] || 0) + Number(row.quantity);
      return result;
    }, {});
    const grandTotal = Object.values(totals).reduce((sum, value) => sum + value, 0);
    return Object.entries(OUTCOMES).map(([status, config]) => ({
      status,
      ...config,
      quantity: totals[status] || 0,
      percent: grandTotal ? Math.round((totals[status] || 0) / grandTotal * 100) : 0,
    }));
  }, [rows]);

  if (error) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  if (!data || !rows) return <Loading rows={8} />;

  return (
    <div>
      <PageHead title="Verified impact" subtitle="A transparent summary of material collected and moved away from landfill." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Leaf} label="Total diverted (kg)" value={data.stats.total_diverted} accent="emerald" />
        <StatCard icon={Recycle} label="Items recovered (pcs)" value={data.stats.items_recovered} accent="emerald" />
        <StatCard icon={PackageCheck} label="Completed pickups" value={data.stats.completed_pickups} accent="blue" />
        <StatCard icon={Building2} label="Centres served" value={data.stats.centres_served} accent="violet" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.25fr]">
        <Card title="Diversion by outcome">
          <div className="space-y-5 p-5">
            {outcomes.map(({ status, label, icon: Icon, color, quantity, percent }) => (
              <div key={status}>
                <div className="mb-2 flex items-center gap-2 text-sm">
                  <Icon className="h-4 w-4 text-stone-500" />
                  <span className="flex-1 font-medium text-stone-700">{label}</span>
                  <span className="font-bold tabular-nums text-stone-900">{quantity.toLocaleString()} kg</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-stone-100" role="progressbar" aria-label={label} aria-valuenow={percent} aria-valuemin="0" aria-valuemax="100">
                  <div className={`h-full rounded-full ${color}`} style={{ width: `${percent}%` }} />
                </div>
                <div className="mt-1 text-right text-[11px] font-medium text-stone-400">{percent}%</div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Processing history">
          {rows.length === 0 ? (
            <div className="p-12 text-center text-sm text-stone-500">Complete a pickup to start building a verified impact record.</div>
          ) : (
            <div className="divide-y divide-stone-100">
              {rows.map((row) => (
                <div key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Leaf className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900">{row.waste_type}</div>
                    <div className="mt-0.5 text-xs text-stone-500">{row.centre?.name} · {row.centre?.area}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:block sm:text-right">
                    <div className="font-bold tabular-nums text-stone-900">{row.quantity} {row.unit}</div>
                    <div className="mt-1"><Badge status={row.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
