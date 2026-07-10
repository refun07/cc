import { taka } from "../../lib/format";

export function PageHead({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, money, accent = "brand" }) {
  const colors = {
    brand: "bg-brand-50 text-brand-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  const rings = {
    brand: "hover:ring-brand-100",
    blue: "hover:ring-blue-100",
    amber: "hover:ring-amber-100",
    violet: "hover:ring-violet-100",
    rose: "hover:ring-rose-100",
    emerald: "hover:ring-emerald-100",
  };
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${rings[accent]}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <span className={`grid h-9 w-9 place-items-center rounded-lg ${colors[accent]}`}><Icon className="h-5 w-5" /></span>}
      </div>
      <div className="mt-3 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">
        {money ? taka(value) : (typeof value === "string" && /[^\d.,-]/.test(value) ? value : Number(value).toLocaleString())}
      </div>
    </div>
  );
}

export function Card({ title, action, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      {title && (
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function Table({ head, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-5 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">{children}</tbody>
      </table>
    </div>
  );
}

const STATUS = {
  active: "bg-emerald-100 text-emerald-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  approved: "bg-blue-100 text-blue-700",
  held: "bg-rose-100 text-rose-700",
  completed: "bg-slate-200 text-slate-700",
  pending: "bg-amber-100 text-amber-700",
  pending_review: "bg-blue-100 text-blue-700",
  payment_pending: "bg-amber-100 text-amber-700",
  suspended: "bg-rose-100 text-rose-700",
  cancelled: "bg-rose-100 text-rose-700",
  refunded: "bg-violet-100 text-violet-700",
  draft: "bg-slate-100 text-slate-500",
  inactive: "bg-slate-100 text-slate-500",
  ordered: "bg-blue-100 text-blue-700",
  partially_received: "bg-amber-100 text-amber-700",
  received: "bg-emerald-100 text-emerald-700",
  quarantine: "bg-amber-100 text-amber-800",
  expired: "bg-rose-100 text-rose-700",
  recorded: "bg-rose-100 text-rose-700",
  disposed: "bg-slate-200 text-slate-700",
  recovered: "bg-emerald-100 text-emerald-700",
  sorting_required: "bg-amber-100 text-amber-700",
  compost_pending: "bg-lime-100 text-lime-800",
  recycling_assigned: "bg-blue-100 text-blue-700",
  pickup_assigned: "bg-cyan-100 text-cyan-800",
  collected: "bg-indigo-100 text-indigo-700",
  recycled: "bg-blue-100 text-blue-700",
  composted: "bg-emerald-100 text-emerald-700",
  returned_to_inventory: "bg-teal-100 text-teal-700",
  disposed_safely: "bg-stone-200 text-stone-700",
};

export function Badge({ status }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS[status] || "bg-slate-100 text-slate-600"}`}>
      {String(status).replaceAll("_", " ")}
    </span>
  );
}

export function Loading({ rows = 6 }) {
  return (
    <div className="space-y-2 p-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 skeleton rounded-lg bg-slate-100" />
      ))}
    </div>
  );
}
