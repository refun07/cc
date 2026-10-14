import { useEffect, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Wallet, Percent, Receipt, RotateCcw, CalendarCheck, TrendingUp, Download, Search, MapPin, SlidersHorizontal } from "lucide-react";
import { adminReports, adminExport, adminCentres } from "../../services/api";
import { taka } from "../../lib/format";
import { CENTRE_TYPES } from "../../lib/centreTypes";
import { PageHead, StatCard, Card, Loading } from "./ui";
import { toast } from "../../store/toastStore";

const COLORS = ["#059669", "#2563eb", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6", "#64748b"];
const BOOKING_STATUSES = ["draft", "pending_review", "payment_pending", "paid", "confirmed", "cancelled", "completed", "refunded"];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"];
const dateString = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const currentMonth = () => {
  const now = new Date();
  return { from: dateString(new Date(now.getFullYear(), now.getMonth(), 1)), to: dateString(now), centre_name: "", area: "", centre_type: "", booking_status: "", payment_status: "" };
};
const queryParams = (filters, type) => Object.fromEntries(Object.entries(filters)
  .filter(([key, value]) => value && (type === "bookings" ? key !== "payment_status" : type === "payments" ? key !== "booking_status" : key !== "payment_status")));

export default function AdminReports() {
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState("");
  const [centres, setCentres] = useState([]);
  const [filters, setFilters] = useState(currentMonth);
  const [applied, setApplied] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setD(null);
    setError("");
    adminReports(queryParams(applied))
      .then((result) => { if (active) setD(result); })
      .catch(() => { if (active) setError("Could not load reports. Please try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [applied]);
  useEffect(() => { adminCentres().then(setCentres).catch(() => setCentres([])); }, []);
  const t = d?.totals;

  const retry = () => {
    setLoading(true);
    setApplied((current) => ({ ...current }));
  };

  const validDates = () => {
    if (filters.from && filters.to && filters.from > filters.to) {
      toast.error("From date must be on or before To date.");
      return false;
    }
    return true;
  };
  const apply = (event) => {
    event.preventDefault();
    if (!validDates()) return;
    setLoading(true);
    setApplied({ ...filters });
  };
  const exportCsv = async (type) => {
    if (!validDates()) return;
    setLoading(true);
    setApplied({ ...filters });
    setBusy(type);
    const params = queryParams(filters, type);
    try {
      const count = await adminExport(type, params);
      toast.success(`${count} ${type} exported.`);
    }
    catch { toast.error("Export failed."); }
    finally { setBusy(""); }
  };

  return (
    <div>
      <PageHead title="DSCC reports" subtitle="GMV, commission, VAT and growth analytics.">
        <div className="flex gap-2">
          <button onClick={() => exportCsv("bookings")} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> Bookings CSV
          </button>
          <button onClick={() => exportCsv("payments")} disabled={Boolean(busy)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-4 w-4" /> Payments CSV
          </button>
        </div>
      </PageHead>

      <form onSubmit={apply} className="mb-5 border-y border-slate-200 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-h-10 items-center gap-1.5 pr-1 text-sm font-semibold text-slate-800"><SlidersHorizontal className="h-4 w-4 text-brand-600" /> Filters</div>
          <FilterField label="Centre name" icon={Search}><input list="report-centres" className="input min-h-10 w-52" placeholder="Search centre name" value={filters.centre_name} onChange={(event) => setFilters((current) => ({ ...current, centre_name: event.target.value }))} /></FilterField>
          <datalist id="report-centres">{centres.map((centre) => <option key={centre.id} value={centre.name} />)}</datalist>
          <FilterField label="Area" icon={MapPin}><input list="report-areas" className="input min-h-10 w-44" placeholder="Search area" value={filters.area} onChange={(event) => setFilters((current) => ({ ...current, area: event.target.value }))} /></FilterField>
          <datalist id="report-areas">{[...new Set(centres.map((centre) => centre.area).filter(Boolean))].map((area) => <option key={area} value={area} />)}</datalist>
          <FilterField label="From date"><input type="date" className="input min-h-10 w-40" title="Booking created date or payment paid date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))} /></FilterField>
          <FilterField label="To date"><input type="date" className="input min-h-10 w-40" title="Booking created date or payment paid date" value={filters.to} min={filters.from || undefined} onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))} /></FilterField>
          <button type="submit" disabled={loading} className="min-h-10 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">Apply</button>
          <button type="button" onClick={() => { const cleared = { from: "", to: "", centre_name: "", area: "", centre_type: "", booking_status: "", payment_status: "" }; setFilters(cleared); setLoading(true); setApplied(cleared); }} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><RotateCcw className="h-4 w-4" /> Reset</button>
        </div>
        <details className="mt-3 text-sm text-slate-600">
          <summary className="w-fit cursor-pointer font-medium hover:text-brand-700">More filters</summary>
          <div className="mt-3 flex flex-wrap gap-3">
            <FilterField label="Centre type"><select className="input min-h-10 min-w-44" value={filters.centre_type} onChange={(event) => setFilters((current) => ({ ...current, centre_type: event.target.value }))}><option value="">All types</option>{CENTRE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></FilterField>
            <FilterField label="Booking status"><select className="input min-h-10 min-w-40" value={filters.booking_status} onChange={(event) => setFilters((current) => ({ ...current, booking_status: event.target.value }))}><option value="">All statuses</option>{BOOKING_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></FilterField>
            <FilterField label="Payment status"><select className="input min-h-10 min-w-40" value={filters.payment_status} onChange={(event) => setFilters((current) => ({ ...current, payment_status: event.target.value }))}><option value="">All statuses</option>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</select></FilterField>
          </div>
        </details>
      </form>

      {loading ? <div role="status" aria-label="Loading reports"><Loading rows={4} /></div> : error ? (
        <div className="flex flex-wrap items-center gap-3 border-l-4 border-rose-500 bg-rose-50 p-4">
          <p role="alert" className="text-sm text-rose-800">{error}</p>
          <button type="button" onClick={retry} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-800 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500">
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
        </div>
      ) : d && <>
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

        <Card title="Booking volume">
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.booking_growth} margin={{ left: -8, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="bookings" name="Bookings" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
      </>}
    </div>
  );
}

function FilterField({ label, icon: Icon, children }) {
  return <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600"><span className="inline-flex items-center gap-1">{Icon && <Icon className="h-3.5 w-3.5" />}{label}</span>{children}</label>;
}
