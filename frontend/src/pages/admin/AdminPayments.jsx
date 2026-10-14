import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown, RotateCcw } from "lucide-react";
import { adminPayments } from "../../services/api";
import { taka } from "../../lib/format";
import { CENTRE_TYPES } from "../../lib/centreTypes";
import { PageHead, Card, Table, Badge, Loading } from "./ui";

const COLUMNS = [
  ["transaction_id", "Transaction"], ["booking_no", "Booking"], ["centre", "Centre"],
  ["method", "Method"], ["amount", "Amount"], ["vat_amount", "Tax / VAT"],
  ["commission", "Commission"], ["refunded_amount", "Refunded"],
  ["status", "Status"], ["paid_at", "Paid at"],
];
const EMPTY_FILTERS = { from: "", to: "", centre_type: "", centre_id: "" };

export default function AdminPayments() {
  const [draft, setDraft] = useState(EMPTY_FILTERS);
  const [query, setQuery] = useState({ ...EMPTY_FILTERS, sort: "paid_at", dir: "desc", page: 1 });
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    adminPayments(Object.fromEntries(Object.entries(query).filter(([, value]) => value !== "")))
      .then((result) => { if (active) { setReport(result); setError(""); } })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || "Could not load payments."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [query]);

  const apply = (event) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      setError("From date must be on or before To date.");
      return;
    }
    setLoading(true);
    setQuery((current) => ({ ...current, ...draft, page: 1 }));
  };
  const reset = () => {
    setDraft(EMPTY_FILTERS);
    setLoading(true);
    setQuery((current) => ({ ...current, ...EMPTY_FILTERS, page: 1 }));
  };
  const toggleSort = (key) => {
    setLoading(true);
    setQuery((current) => ({ ...current, sort: key, dir: current.sort === key && current.dir === "asc" ? "desc" : "asc", page: 1 }));
  };
  const changePage = (page) => {
    setLoading(true);
    setQuery((current) => ({ ...current, page }));
  };

  const centres = report?.centres || [];
  const rows = report?.data || [];
  const meta = report?.meta;
  const totals = report?.totals || { amount: 0, vat: 0, commission: 0 };
  const head = COLUMNS.map(([key, label]) => (
    <button key={key} type="button" onClick={() => toggleSort(key)} aria-label={`Sort by ${label}`}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition hover:text-brand-700 ${query.sort === key ? "text-brand-700" : ""}`}>
      {label}
      {query.sort === key
        ? (query.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ChevronsUpDown className="h-3 w-3 text-slate-300" />}
    </button>
  ));

  return (
    <div>
      <PageHead title="Payments" subtitle="Transactions, tax and platform commission." />
      {report?.history?.legacy_aggregate_count > 0 && <p role="status" className="my-3 border-l-4 border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">Legacy payment totals are included. Earlier installment dates are unavailable; these records use the last recorded payment date.</p>}
      <form onSubmit={apply} className="mb-4 flex flex-wrap items-end gap-3 border-y border-slate-200 py-4">
        <FilterField label="From date"><input type="date" value={draft.from} max={draft.to || undefined} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} className="input min-h-10 w-40" /></FilterField>
        <FilterField label="To date"><input type="date" value={draft.to} min={draft.from || undefined} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} className="input min-h-10 w-40" /></FilterField>
        <FilterField label="Centre type">
          <select value={draft.centre_type} onChange={(event) => setDraft((current) => ({ ...current, centre_type: event.target.value, centre_id: "" }))} className="input min-h-10 min-w-44">
            <option value="">All types</option>
            {CENTRE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
          </select>
        </FilterField>
        <FilterField label="Centre">
          <select value={draft.centre_id} onChange={(event) => setDraft((current) => ({ ...current, centre_id: event.target.value }))} className="input min-h-10 min-w-48 max-w-64">
            <option value="">All centres</option>
            {centres.filter((centre) => !draft.centre_type || centre.centre_type === draft.centre_type).map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}
          </select>
        </FilterField>
        <button type="submit" className="min-h-10 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Apply</button>
        <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-600 hover:bg-slate-100"><RotateCcw className="h-4 w-4" /> Reset</button>
      </form>
      {error && <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-rose-700"><p role="alert">{error}</p><button type="button" onClick={() => setQuery((current) => ({ ...current }))} className="min-h-11 rounded-lg border border-rose-200 bg-white px-3 font-semibold">Retry</button></div>}

      {report && !loading && !error && <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <MiniStat label="Total collected" value={taka(totals.amount)} accent="from-emerald-500 to-teal-600" />
        <MiniStat label="Tax / VAT" value={taka(totals.vat)} accent="from-blue-500 to-indigo-600" />
        <MiniStat label="Platform commission" value={taka(totals.commission)} accent="from-violet-500 to-purple-600" />
      </div>}

      <Card>
        {loading ? <Loading /> : error || !report ? null : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">No payments match these filters.</div>
        ) : (
          <Table head={head}>
            {rows.map((payment) => (
              <tr key={payment.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{payment.transaction_id || "—"}{payment.source === "legacy_aggregate" && <span className="mt-1 block font-sans text-amber-800">Legacy aggregate</span>}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{payment.booking_no}</td>
                <td className="px-5 py-3 text-slate-600">{payment.centre}</td>
                <td className="px-5 py-3 text-slate-600">{payment.method}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{taka(payment.amount)}</td>
                <td className="px-5 py-3 tabular-nums text-blue-700">{taka(payment.vat_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-violet-700">{taka(payment.commission)}</td>
                <td className="px-5 py-3 tabular-nums text-rose-600">{payment.refunded_amount > 0 ? taka(payment.refunded_amount) : "—"}</td>
                <td className="px-5 py-3"><Badge status={payment.status} /></td>
                <td className="px-5 py-3 text-xs tabular-nums text-slate-500">{payment.paid_at || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
        {meta && !loading && !error && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
          <span>{meta.total} transaction{meta.total === 1 ? "" : "s"}{loading ? " · Updating…" : ""}</span>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => changePage(meta.current_page - 1)} disabled={loading || meta.current_page <= 1} className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40">Previous</button>
            <span>Page {meta.current_page} of {meta.last_page}</span>
            <button type="button" onClick={() => changePage(meta.current_page + 1)} disabled={loading || meta.current_page >= meta.last_page} className="rounded border border-slate-200 px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>}
      </Card>
    </div>
  );
}

function FilterField({ label, children }) {
  return <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600"><span>{label}</span>{children}</label>;
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${accent} opacity-10`} />
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
