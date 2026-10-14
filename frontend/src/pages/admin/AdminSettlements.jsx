import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, CircleDollarSign, Clock3, HandCoins, Pause, Play, Plus, ReceiptText, X } from "lucide-react";
import {
  adminCentres, adminCreateSettlement, adminSetCommissionRate,
  adminSettlements, adminUpdateSettlement,
} from "../../services/api";
import { taka } from "../../lib/format";
import { Badge, Card, Loading, PageHead, StatCard, Table } from "./ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const FILTERS = ["", "pending", "approved", "paid", "held"];

export default function AdminSettlements() {
  const [data, setData] = useState(null);
  const [centres, setCentres] = useState([]);
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);
  const [paying, setPaying] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const request = useRef(0);

  const load = useCallback(() => {
    const id = ++request.current;
    setData(null);
    setError("");
    adminSettlements(status ? { status } : {})
      .then((result) => { if (id === request.current) setData(result); })
      .catch((err) => { if (id === request.current) setError(apiError(err)); });
  }, [status]);
  useEffect(() => { load(); return () => { request.current += 1; }; }, [load]);
  useEffect(() => { adminCentres({}).then(setCentres).catch(() => setCentres([])); }, []);

  const transition = async (row, next) => {
    if (next === "paid") { setPaying(row); return; }
    if (!(await askConfirm({
      title: next === "held" ? "Place settlement on hold?" : `${next[0].toUpperCase() + next.slice(1)} settlement?`,
      message: next === "held" ? "The owner will see that payout processing is paused." : `Settlement ${row.settlement_no} will move to ${next}.`,
      confirmText: next === "held" ? "Place on hold" : "Confirm",
      danger: next === "held",
    }))) return;
    setBusy(row.id);
    try { await adminUpdateSettlement(row.id, { status: next }); toast.success("Settlement updated."); load(); }
    catch (e) { toast.error(apiError(e)); }
    finally { setBusy(null); }
  };

  const s = data?.summary || {};
  return (
    <div>
      <PageHead title="Settlements" subtitle="Reconcile paid bookings, approve centre payouts, and keep an auditable payment trail.">
        <button onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Generate settlement
        </button>
      </PageHead>

      <div className="mb-4 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-900">
        <p>Cash collected at the centre is excluded from payouts. Cash VAT and fees require separate reconciliation.</p>
        {data?.centre_cash && <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
          <div><dt>Centre cash retained (all time, after refunds)</dt><dd className="font-bold">{taka(data.centre_cash.net_collected)}</dd></div>
          <div><dt>Cash fees and tax to reconcile (all time)</dt><dd className="font-bold">{taka(data.centre_cash.fees_tax_to_reconcile)}</dd></div>
          <div><dt>Historical payouts blocked for cash review</dt><dd className="font-bold">{taka(s.cash_blocked || 0)}</dd></div>
        </dl>}
      </div>

      {data && !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={CircleDollarSign} label="Gross reconciled" value={s.gross || 0} money accent="blue" />
        <StatCard icon={ReceiptText} label="Platform fees" value={s.commission || 0} money accent="violet" />
        <StatCard icon={ReceiptText} label="Tax withheld" value={s.tax || 0} money accent="amber" />
        <StatCard icon={Clock3} label="Awaiting payout" value={s.payable || 0} money accent="rose" />
        <StatCard icon={HandCoins} label="Paid to centres" value={s.paid || 0} money accent="emerald" />
      </div>}

      <div className="my-5 flex flex-wrap gap-2" aria-label="Filter settlements by status">
        {FILTERS.map((f) => <button key={f || "all"} onClick={() => setStatus(f)}
          className={`min-h-10 rounded-full px-4 text-xs font-semibold capitalize transition ${status === f ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {f || "All"}
        </button>)}
      </div>

      <Card>
        {error ? <div role="alert" className="p-6 text-rose-700"><p>{error}</p><button type="button" onClick={load} className="mt-3 min-h-11 rounded-lg border border-rose-200 px-4 font-semibold">Retry</button></div> : !data ? <Loading /> : data.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-12 text-center">
            <HandCoins className="h-9 w-9 text-slate-300" />
            <div className="font-semibold text-slate-600">No settlements found</div>
            <div className="max-w-sm text-sm text-slate-400">Generate one after a centre has paid bookings in the selected payment period.</div>
          </div>
        ) : (
          <Table head={["Settlement", "Centre", "Payment period", "Settlement items", "Gross", "Fees + tax", "Net payout", "Status", "Actions"]}>
            {data.data.map((row) => <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-mono text-xs text-slate-500">{row.settlement_no}</td>
              <td className="px-5 py-3"><div className="font-medium text-slate-800">{row.centre?.name}</div><div className="text-xs text-slate-400">Future rate {Number(row.centre?.commission_rate || 0)}%</div></td>
              <td className="whitespace-nowrap px-5 py-3 text-slate-600">{row.period_start} <span className="text-slate-300">→</span> {row.period_end}</td>
              <td className="px-5 py-3 text-center tabular-nums">{row.items_count}</td>
              <td className="px-5 py-3 font-semibold tabular-nums">{taka(row.gross_amount)}</td>
              <td className="px-5 py-3 tabular-nums text-slate-500">{taka(Number(row.commission_amount) + Number(row.tax_amount))}</td>
              <td className="px-5 py-3 font-extrabold tabular-nums text-emerald-700">{taka(row.net_amount)}</td>
              <td className="px-5 py-3"><Badge status={row.status} />{row.contains_centre_cash && <div className="mt-1 text-xs font-semibold text-amber-800">Centre cash: reconciliation required</div>}{row.payment_reference && <div className="mt-1 font-mono text-[10px] text-slate-400">{row.payment_reference}</div>}</td>
              <td className="px-5 py-3"><div className="flex min-w-max gap-2">
                {row.status === "pending" && <Action disabled={busy === row.id || row.contains_centre_cash} onClick={() => transition(row, "approved")} icon={Check}>Approve</Action>}
                {row.status === "approved" && <Action disabled={busy === row.id || row.contains_centre_cash} onClick={() => transition(row, "paid")} icon={HandCoins}>Pay</Action>}
                {["pending", "approved"].includes(row.status) && <Action disabled={busy === row.id} onClick={() => transition(row, "held")} icon={Pause} danger>Hold</Action>}
                {row.status === "held" && <Action disabled={busy === row.id} onClick={() => transition(row, "pending")} icon={Play}>Resume</Action>}
              </div></td>
            </tr>)}
          </Table>
        )}
      </Card>

      <GenerateModal open={creating} centres={centres} onClose={() => setCreating(false)} onCreated={load} />
      <PayModal settlement={paying} onClose={() => setPaying(null)} onPaid={load} />
    </div>
  );
}

function GenerateModal({ open, centres, onClose, onCreated }) {
  const defaults = useMemo(() => {
    const now = new Date();
    return { centre_id: "", period_start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, period_end: now.toISOString().slice(0, 10), adjustment_amount: 0, notes: "" };
  }, []);
  const [form, setForm] = useState(defaults);
  const [rate, setRate] = useState(5);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setForm(defaults); setRate(5); } }, [open, defaults]);
  const selected = centres.find((c) => String(c.id) === String(form.centre_id));
  useEffect(() => { if (selected) setRate(Number(selected.commission_rate ?? 5)); }, [selected]);
  if (!open) return null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const saveRate = async () => {
    if (!selected) return;
    try { await adminSetCommissionRate(selected.id, Number(rate)); selected.commission_rate = Number(rate); toast.success("Future booking rate updated."); }
    catch (e) { toast.error(apiError(e)); }
  };
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await adminCreateSettlement({ ...form, centre_id: Number(form.centre_id), adjustment_amount: Number(form.adjustment_amount || 0) }); toast.success("Settlement generated."); onClose(); onCreated(); }
    catch (err) { toast.error(apiError(err)); }
    finally { setBusy(false); }
  };
  return <Modal title="Generate settlement" onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <Field label="Community centre"><select value={form.centre_id} onChange={set("centre_id")} className="input" required><option value="">Select a centre…</option>{centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
      {selected && <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
        <label className="text-xs font-semibold text-blue-800" htmlFor="commission-rate">Commission rate for future bookings</label>
        <div className="mt-1 flex gap-2"><input id="commission-rate" type="number" min="0" max="25" step="0.25" value={rate} onChange={(e) => setRate(e.target.value)} className="input bg-white" /><button type="button" onClick={saveRate} className="min-h-11 whitespace-nowrap rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">Save rate</button></div>
        <p className="mt-1 text-xs text-blue-700">Historical bookings retain the fee recorded when they were created.</p>
      </div>}
      <div className="grid grid-cols-2 gap-3"><Field label="Payment period start"><input type="date" value={form.period_start} onChange={set("period_start")} className="input" required /></Field><Field label="Payment period end"><input type="date" value={form.period_end} onChange={set("period_end")} className="input" required /></Field></div>
      <Field label="Adjustment (optional)"><input type="number" step="0.01" value={form.adjustment_amount} onChange={set("adjustment_amount")} className="input" /><p className="mt-1 text-xs text-slate-400">Use a positive value for a credit or negative value for a deduction.</p></Field>
      <Field label="Internal note (optional)"><textarea rows="3" value={form.notes} onChange={set("notes")} className="input resize-none" /></Field>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button disabled={busy} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Generating…" : "Generate"}</button></div>
    </form>
  </Modal>;
}

function PayModal({ settlement, onClose, onPaid }) {
  const [form, setForm] = useState({ payment_method: "Bank Transfer", payment_reference: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (settlement) setForm({ payment_method: "Bank Transfer", payment_reference: "" }); }, [settlement]);
  if (!settlement) return null;
  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await adminUpdateSettlement(settlement.id, { status: "paid", ...form }); toast.success("Payout recorded."); onClose(); onPaid(); }
    catch (err) { toast.error(apiError(err)); }
    finally { setBusy(false); }
  };
  return <Modal title="Record centre payout" onClose={onClose}>
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-xl bg-emerald-50 p-4"><div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Net payout</div><div className="mt-1 text-2xl font-extrabold text-emerald-900">{taka(settlement.net_amount)}</div><div className="text-xs text-emerald-700">{settlement.centre?.name} · {settlement.settlement_no}</div></div>
      <Field label="Payment method"><select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option>Bank Transfer</option><option>Cheque</option><option>bKash</option><option>Nagad</option></select></Field>
      <Field label="Payment reference"><input className="input" value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} placeholder="Bank transaction or cheque number" required /></Field>
      <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button disabled={busy} className="min-h-11 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Recording…" : "Mark paid"}</button></div>
    </form>
  </Modal>;
}

function Modal({ title, onClose, children }) {
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
    <div className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="settlement-modal-title">
      <div className="mb-5 flex items-center justify-between"><h2 id="settlement-modal-title" className="font-display text-xl font-bold text-slate-900">{title}</h2><button onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div>{children}
    </div>
  </div>;
}

function Field({ label, children }) { return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>; }
function Action({ icon: Icon, children, danger, ...props }) { return <button {...props} className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50 ${danger ? "bg-rose-50 text-rose-700 hover:bg-rose-100" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}><Icon className="h-3.5 w-3.5" />{children}</button>; }
function apiError(err) { return err.response?.data?.errors ? Object.values(err.response.data.errors)[0][0] : err.response?.data?.message || "Request failed."; }
