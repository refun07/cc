import { useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown, Wallet, Percent, ArrowDownLeft, ArrowUpRight, Clock3, HandCoins, ArrowUp, ArrowDown, ChevronsUpDown, Search, Plus, ScanLine, Trash2, X, Sparkles, Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ownerAccounting, ownerAddLedgerEntry, ownerAddLedgerEntries, ownerDeleteLedgerEntry, ownerScanLedger } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, StatCard, Card, Table, Loading, Badge } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const COLORS = ["#059669", "#2563eb", "#f59e0b", "#8b5cf6", "#ef4444", "#0ea5e9", "#14b8a6", "#64748b"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function OwnerAccounting() {
  const [d, setD] = useState(null);
  const reload = () => ownerAccounting().then(setD).catch(() => setD(null));
  useEffect(() => { reload(); }, []);

  const trend = useMemo(() => {
    if (!d?.ledger?.length) return [];
    const now = new Date();
    const buckets = [];
    const index = {};
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${m.getFullYear()}-${m.getMonth()}`;
      index[key] = buckets.length;
      buckets.push({ month: MONTHS[m.getMonth()], income: 0, expense: 0 });
    }
    for (const l of d.ledger) {
      if (!l.date) continue;
      const dt = new Date(l.date);
      const key = `${dt.getFullYear()}-${dt.getMonth()}`;
      const idx = index[key];
      if (idx === undefined) continue;
      buckets[idx][l.type === "income" ? "income" : "expense"] += Number(l.amount) || 0;
    }
    return buckets;
  }, [d]);

  if (!d) return <Loading rows={4} />;
  const s = d.summary;

  return (
    <div>
      <PageHead title="Accounting" subtitle="Income, expenses, payroll, profit and DSCC payout settlements for your centre." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={TrendingUp} label="Total income" value={s.income} money accent="emerald" />
        <StatCard icon={TrendingDown} label="Total expense" value={s.expense} money accent="rose" />
        <StatCard icon={Wallet} label="Net profit" value={s.net_profit} money accent={s.net_profit >= 0 ? "brand" : "rose"} />
        <StatCard icon={Percent} label="Profit margin" value={`${s.margin}%`} accent="violet" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SoftCard icon={Clock3} label="Pending expenses" value={s.expense_pending} accent="amber" />
        <SoftCard icon={Clock3} label="Pending payroll" value={s.payroll_pending} accent="sky" />
        <SoftCard icon={Clock3} label="Settlement payable" value={s.settlement_payable} accent="violet" />
        <SoftCard icon={HandCoins} label="Settlements received" value={s.settlement_paid} accent="emerald" />
      </div>

      <div className="mt-6 space-y-6">
      {trend.some((t) => t.income || t.expense) && (
        <Card title="Income vs expense" action={<span className="text-xs text-slate-400">Last 6 months</span>}>
          <div className="h-64 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: -8, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => taka(v)} />
                <Tooltip cursor={{ fill: "#f8fafc" }} formatter={(v, n) => [taka(v), n === "income" ? "Income" : "Expense"]} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                <Bar dataKey="income" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card title="DSCC settlements" action={<span className="text-xs text-slate-400">Based on payment date</span>}>
        {!d.settlements?.length ? (
          <div className="p-10 text-center text-sm text-slate-400">No settlement has been generated yet.</div>
        ) : (
          <Table head={["Settlement", "Period", "Bookings", "Gross", "Fee", "Tax", "Adjustment", "Net payout", "Status"]}>
            {d.settlements.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.settlement_no}</td>
                <td className="whitespace-nowrap px-5 py-3 text-slate-600">{row.period_start} <span className="text-slate-300">→</span> {row.period_end}</td>
                <td className="px-5 py-3 text-center tabular-nums">{row.items_count}</td>
                <td className="px-5 py-3 tabular-nums">{taka(row.gross_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-slate-500">{taka(row.commission_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-slate-500">{taka(row.tax_amount)}</td>
                <td className={`px-5 py-3 tabular-nums ${Number(row.adjustment_amount) < 0 ? "text-rose-600" : "text-emerald-600"}`}>{taka(row.adjustment_amount)}</td>
                <td className="px-5 py-3 font-extrabold tabular-nums text-emerald-700">{taka(row.net_amount)}</td>
                <td className="px-5 py-3"><Badge status={row.status} />{row.payment_reference && <div className="mt-1 font-mono text-[10px] text-slate-400">{row.payment_reference}</div>}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Expense breakdown">
          <div className="h-72 p-4">
            {d.by_category?.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={d.by_category} dataKey="amount" nameKey="category" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {d.by_category.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v) => taka(v)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm text-slate-400">No expenses recorded yet.</div>}
          </div>
        </Card>

        <Ledger rows={d.ledger} reload={reload} />
      </div>
    </div>
  );
}

const SOFT = {
  amber: "from-amber-400 to-orange-500 text-amber-700",
  sky: "from-sky-400 to-blue-500 text-sky-700",
  violet: "from-violet-400 to-purple-500 text-violet-700",
  emerald: "from-emerald-400 to-teal-500 text-emerald-700",
};
function SoftCard({ icon: Icon, label, value, accent }) {
  const [grad, text] = [SOFT[accent].split(" text-")[0], "text-" + SOFT[accent].split(" text-")[1]];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br ${grad} opacity-10`} />
      <div className="flex items-center justify-between">
        <div className={`text-sm font-medium ${text}`}>{label}</div>
        <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${grad} text-white shadow-sm`}><Icon className="h-5 w-5" /></span>
      </div>
      <div className="mt-2 text-2xl font-extrabold tabular-nums tracking-tight text-slate-900">{taka(value)}</div>
    </div>
  );
}

const LEDGER_COLS = [
  ["date", "Date", false],
  ["desc", "Description", false],
  ["category", "Category", false],
  ["type", "Type", false],
  ["amount", "Amount", true],
];

function Ledger({ rows, reload }) {
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [entryOpen, setEntryOpen] = useState(false);
  const [scan, setScan] = useState(null); // array of parsed rows under review
  const [scanning, setScanning] = useState(false);

  const runScan = async (file) => {
    if (!file) return;
    setScanning(true);
    try {
      const parsed = await ownerScanLedger(file);
      if (!parsed.length) return toast.error("No entries could be read from the image.");
      setScan(parsed);
    } catch (e) { toast.error(e.response?.data?.message || "Could not scan the image."); }
    finally { setScanning(false); }
  };

  const removeEntry = async (row) => {
    if (!(await askConfirm({ title: "Remove entry?", message: `“${row.desc}” will be deleted.`, confirmText: "Delete", danger: true }))) return;
    try { await ownerDeleteLedgerEntry(row.id); toast.success("Entry removed."); reload(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not remove."); }
  };

  const toggle = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: key === "amount" || key === "date" ? "desc" : "asc" }));

  const view = useMemo(() => {
    let list = rows || [];
    if (type !== "all") list = list.filter((l) => l.type === type);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((l) => (l.desc || "").toLowerCase().includes(q) || (l.category || "").toLowerCase().includes(q) || (l.ref || "").toLowerCase().includes(q));
    const numeric = LEDGER_COLS.find(([k]) => k === sort.key)?.[2];
    return [...list].sort((a, b) => {
      let av = a[sort.key], bv = b[sort.key];
      if (numeric) { av = Number(av) || 0; bv = Number(bv) || 0; }
      else { av = (av ?? "").toString().toLowerCase(); bv = (bv ?? "").toString().toLowerCase(); }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, type, query, sort]);

  const totals = useMemo(() => ({
    income: view.filter((l) => l.type === "income").reduce((s, l) => s + (Number(l.amount) || 0), 0),
    expense: view.filter((l) => l.type === "expense").reduce((s, l) => s + (Number(l.amount) || 0), 0),
  }), [view]);

  const head = LEDGER_COLS.map(([key, label, num]) => (
    <button key={key} onClick={() => toggle(key)} className={`inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition hover:text-brand-700 ${sort.key === key ? "text-brand-700" : ""} ${num ? "justify-end" : ""}`}>
      {label}
      {sort.key === key ? (sort.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ChevronsUpDown className="h-3 w-3 text-slate-300" />}
    </button>
  ));

  return (
    <Card
      title="Ledger"
      action={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-slate-200">
            {[["all", "All"], ["income", "Income"], ["expense", "Expense"]].map(([v, label]) => (
              <button key={v} onClick={() => setType(v)}
                className={`px-3 py-1.5 text-xs font-semibold transition ${type === v ? (v === "income" ? "bg-emerald-600 text-white" : v === "expense" ? "bg-rose-500 text-white" : "bg-brand-600 text-white") : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="w-24 bg-transparent text-xs outline-none" />
          </div>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 ${scanning ? "opacity-70" : ""}`}>
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanLine className="h-3.5 w-3.5" />} {scanning ? "Reading…" : "Scan register"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => runScan(e.target.files[0])} disabled={scanning} />
          </label>
          <button onClick={() => setEntryOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
            <Plus className="h-3.5 w-3.5" /> Add entry
          </button>
        </div>
      }
    >
      {view.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-400">No transactions match.</div>
      ) : (
        <>
        <div className="flex flex-wrap gap-4 border-b border-slate-100 px-5 py-2.5 text-xs">
          <span className="text-slate-400">{view.length} entries</span>
          <span className="text-emerald-600">Income <b className="tabular-nums">{taka(totals.income)}</b></span>
          <span className="text-rose-600">Expense <b className="tabular-nums">{taka(totals.expense)}</b></span>
          <span className={`ml-auto font-semibold ${totals.income - totals.expense >= 0 ? "text-emerald-700" : "text-rose-700"}`}>Net <b className="tabular-nums">{taka(totals.income - totals.expense)}</b></span>
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          <Table head={head}>
            {view.map((l, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3 tabular-nums text-slate-500">{l.date}</td>
                <td className="px-5 py-3 text-slate-700">{l.desc}{l.ref && <span className="ml-1 font-mono text-xs text-slate-400">{l.ref}</span>}</td>
                <td className="px-5 py-3"><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{l.category || "—"}</span></td>
                <td className="px-5 py-3">
                  {l.type === "income"
                    ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600"><ArrowDownLeft className="h-3.5 w-3.5" /> Income</span>
                    : <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600"><ArrowUpRight className="h-3.5 w-3.5" /> Expense</span>}
                </td>
                <td className={`px-5 py-3 text-right font-semibold tabular-nums ${l.type === "income" ? "text-emerald-700" : "text-rose-700"}`}>
                  <div className="inline-flex items-center justify-end gap-2">
                    <span>{l.type === "income" ? "+" : "−"}{taka(l.amount)}</span>
                    {l.manual && <button onClick={() => removeEntry(l)} title="Remove manual entry" className="grid h-6 w-6 place-items-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        </div>
        </>
      )}

      {entryOpen && <EntryModal onClose={() => setEntryOpen(false)} onSaved={() => { setEntryOpen(false); reload(); }} />}
      {scan && <ScanReviewModal rows={scan} onClose={() => setScan(null)} onSaved={() => { setScan(null); reload(); }} />}
    </Card>
  );
}

const CATEGORIES = ["Booking", "Utilities", "Maintenance", "Catering", "Rent", "Marketing", "Supplies", "Misc"];

function EntryModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ type: "expense", date: new Date().toISOString().slice(0, 10), category: "Misc", description: "", amount: "" });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    if (!form.description.trim()) return toast.error("Add a description.");
    if (!(Number(form.amount) > 0)) return toast.error("Enter an amount.");
    setBusy(true);
    try { await ownerAddLedgerEntry({ ...form, amount: Number(form.amount) }); toast.success("Entry added."); onSaved(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not add entry."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-slate-900">Manual ledger entry</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="col-span-2 flex gap-2">
            {[["expense", "Expense", "bg-rose-500"], ["income", "Income", "bg-emerald-600"]].map(([v, label, cls]) => (
              <button key={v} onClick={() => setForm((f) => ({ ...f, type: v }))}
                className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold ${form.type === v ? `${cls} border-transparent text-white` : "border-slate-200 text-slate-600"}`}>{label}</button>
            ))}
          </div>
          <Fld label="Date"><input type="date" value={form.date} onChange={set("date")} className="input" /></Fld>
          <Fld label="Category">
            <input list="ledger-cats" value={form.category} onChange={set("category")} className="input" />
            <datalist id="ledger-cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </Fld>
          <Fld label="Description" full><input value={form.description} onChange={set("description")} className="input" placeholder="e.g. Electricity bill" /></Fld>
          <Fld label="Amount (৳)" full><input type="number" value={form.amount} onChange={set("amount")} className="input" /></Fld>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Add entry"}</button>
        </div>
      </div>
    </div>
  );
}

function ScanReviewModal({ rows: initial, onClose, onSaved }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const upd = (i, k, v) => setRows((r) => r.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)));
  const del = (i) => setRows((r) => r.filter((_, idx) => idx !== i));

  const save = async () => {
    if (!rows.length) return onClose();
    setBusy(true);
    try { const res = await ownerAddLedgerEntries(rows.map((r) => ({ ...r, amount: Number(r.amount) }))); toast.success(res.message); onSaved(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not save entries."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/60 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-slate-900"><Sparkles className="h-5 w-5 text-brand-600" /> Review scanned entries</h2>
            <p className="text-xs text-slate-500">{rows.length} rows read from the register. Edit anything, then save.</p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-slate-400"><th className="p-2">Type</th><th className="p-2">Date</th><th className="p-2">Category</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th><th /></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t border-slate-50">
                  <td className="p-1.5"><select value={r.type} onChange={(e) => upd(i, "type", e.target.value)} className="input py-1 text-xs"><option value="expense">Expense</option><option value="income">Income</option></select></td>
                  <td className="p-1.5"><input type="date" value={r.date} onChange={(e) => upd(i, "date", e.target.value)} className="input py-1 text-xs" /></td>
                  <td className="p-1.5"><input value={r.category} onChange={(e) => upd(i, "category", e.target.value)} className="input py-1 text-xs" /></td>
                  <td className="p-1.5"><input value={r.description} onChange={(e) => upd(i, "description", e.target.value)} className="input py-1 text-xs" /></td>
                  <td className="p-1.5"><input type="number" value={r.amount} onChange={(e) => upd(i, "amount", e.target.value)} className="input py-1 text-right text-xs tabular-nums" /></td>
                  <td className="p-1.5"><button onClick={() => del(i)} className="grid h-7 w-7 place-items-center rounded text-slate-300 hover:bg-rose-50 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={save} disabled={busy || !rows.length} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : `Save ${rows.length} entries`}</button>
        </div>
      </div>
    </div>
  );
}
function Fld({ label, children, full }) {
  return <label className={`block ${full ? "col-span-2" : ""}`}><span className="text-xs font-semibold text-slate-500">{label}</span><div className="mt-1">{children}</div></label>;
}
