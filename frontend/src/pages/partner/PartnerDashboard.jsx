import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Truck, PackageCheck, Leaf, Building2, ArrowRight, MapPin, CalendarClock } from "lucide-react";
import { partnerDashboard } from "../../services/api";
import { PageHead, StatCard, Card, Badge, Loading } from "../admin/ui";

const dateTime = (value) => value
  ? new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "Schedule pending";

export default function PartnerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    partnerDashboard().then(setData).catch(() => setError("Dashboard data could not be loaded. Refresh to try again."));
  }, []);

  if (error) return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{error}</div>;
  if (!data) return <Loading rows={8} />;

  const stats = data.stats;
  return (
    <div>
      <PageHead title="Collection dashboard" subtitle="Plan pickups, close processing loops, and track your verified diversion impact.">
        <Link to="/partner/pickups?scope=available" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-4 text-sm font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2">
          Find pickups <ArrowRight className="h-4 w-4" />
        </Link>
      </PageHead>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Truck} label="Available pickups" value={stats.available_pickups} accent="emerald" />
        <StatCard icon={CalendarClock} label="Active pickups" value={stats.active_pickups} accent="amber" />
        <StatCard icon={PackageCheck} label="Completed pickups" value={stats.completed_pickups} accent="blue" />
        <StatCard icon={Leaf} label="Waste diverted (kg)" value={stats.total_diverted} accent="emerald" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card title="Upcoming collections" action={<Link to="/partner/pickups" className="text-xs font-semibold text-teal-700 hover:text-teal-800">View all</Link>}>
          {data.upcoming.length === 0 ? (
            <Empty text="No scheduled collection yet." action="Browse available pickups" to="/partner/pickups?scope=available" />
          ) : (
            <div className="divide-y divide-stone-100">
              {data.upcoming.map((pickup) => (
                <div key={pickup.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700"><Truck className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-stone-900">{pickup.waste_type} · {pickup.quantity} {pickup.unit}</div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-500">
                      <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {pickup.centre?.name}</span>
                      <span className="inline-flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {dateTime(pickup.pickup_scheduled_for)}</span>
                    </div>
                  </div>
                  <Badge status={pickup.status} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl bg-teal-950 p-5 text-white">
            <div className="flex items-center justify-between">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10"><Building2 className="h-5 w-5" /></span>
              <span className="text-3xl font-extrabold tabular-nums">{stats.centres_served}</span>
            </div>
            <h2 className="mt-5 font-semibold">Community centres served</h2>
            <p className="mt-1 text-sm leading-6 text-teal-100/70">Each completed pickup contributes to DSCC’s verified circular-waste record.</p>
          </div>
          <Card title="Recent processing">
            {data.recent.length === 0 ? <Empty text="Completed work will appear here." /> : (
              <div className="divide-y divide-stone-100">
                {data.recent.slice(0, 4).map((pickup) => (
                  <div key={pickup.id} className="flex items-center gap-3 px-5 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><Leaf className="h-4 w-4" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-stone-800">{pickup.waste_type}</div>
                      <div className="text-xs text-stone-400">{pickup.quantity} {pickup.unit} · {pickup.centre?.area}</div>
                    </div>
                    <Badge status={pickup.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Empty({ text, action, to }) {
  return (
    <div className="p-10 text-center">
      <p className="text-sm text-stone-500">{text}</p>
      {action && <Link to={to} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-teal-700">{action} <ArrowRight className="ml-1 h-4 w-4" /></Link>}
    </div>
  );
}
