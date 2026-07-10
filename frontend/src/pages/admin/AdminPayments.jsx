import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ChevronsUpDown } from "lucide-react";
import { adminPayments } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading } from "./ui";

// Sortable column definitions: [key, label, numeric?]
const COLUMNS = [
  ["transaction_id", "Transaction", false],
  ["booking_no", "Booking", false],
  ["centre", "Centre", false],
  ["method", "Method", false],
  ["amount", "Amount", true],
  ["vat_amount", "Tax / VAT", true],
  ["commission", "Commission", true],
  ["refunded_amount", "Refunded", true],
  ["status", "Status", false],
  ["paid_at", "Paid at", false],
];

export default function AdminPayments() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState({ key: "paid_at", dir: "desc" });
  useEffect(() => { adminPayments().then(setRows).catch(() => setRows([])); }, []);

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const sorted = useMemo(() => {
    if (!rows) return rows;
    const numeric = COLUMNS.find(([k]) => k === sort.key)?.[2];
    return [...rows].sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (numeric) { av = Number(av) || 0; bv = Number(bv) || 0; }
      else { av = (av ?? "").toString().toLowerCase(); bv = (bv ?? "").toString().toLowerCase(); }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, sort]);

  const totals = useMemo(() => {
    const list = rows || [];
    return {
      amount: list.reduce((s, p) => s + Number(p.amount || 0), 0),
      vat: list.reduce((s, p) => s + Number(p.vat_amount || 0), 0),
      commission: list.reduce((s, p) => s + Number(p.commission || 0), 0),
    };
  }, [rows]);

  const head = COLUMNS.map(([key, label, numeric]) => (
    <button
      key={key}
      onClick={() => toggleSort(key)}
      className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition hover:text-brand-700 ${sort.key === key ? "text-brand-700" : ""} ${numeric ? "" : ""}`}
    >
      {label}
      {sort.key === key
        ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)
        : <ChevronsUpDown className="h-3 w-3 text-slate-300" />}
    </button>
  ));

  return (
    <div>
      <PageHead title="Payments" subtitle="All transactions, tax and platform commission." />

      {rows && rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Total collected" value={taka(totals.amount)} accent="from-emerald-500 to-teal-600" />
          <MiniStat label="Tax / VAT" value={taka(totals.vat)} accent="from-blue-500 to-indigo-600" />
          <MiniStat label="Platform commission" value={taka(totals.commission)} accent="from-violet-500 to-purple-600" />
        </div>
      )}

      <Card>
        {!rows ? <Loading /> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No payments recorded yet.</div>
        ) : (
          <Table head={head}>
            {sorted.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.transaction_id || "—"}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{p.booking_no}</td>
                <td className="px-5 py-3 text-slate-600">{p.centre}</td>
                <td className="px-5 py-3 text-slate-600">{p.method}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{taka(p.amount)}</td>
                <td className="px-5 py-3 tabular-nums text-blue-700">{taka(p.vat_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-violet-700">{taka(p.commission)}</td>
                <td className="px-5 py-3 tabular-nums text-rose-600">{p.refunded_amount > 0 ? taka(p.refunded_amount) : "—"}</td>
                <td className="px-5 py-3"><Badge status={p.status} /></td>
                <td className="px-5 py-3 text-xs tabular-nums text-slate-500">{p.paid_at || "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${accent} opacity-10`} />
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
