import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Upload, ImageIcon, Wallet, CheckCircle2, Clock, CalendarDays } from "lucide-react";
import { ownerList, ownerCreate, ownerUpdate, ownerRemove, ownerUpload } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading, StatCard } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const CATEGORIES = ["Electricity", "Cleaning", "Generator fuel", "Linen wash", "Maintenance", "Security", "Staff overtime", "Vendor payment", "Utility", "Other"];
const METHODS = ["Cash", "bKash", "Nagad", "Bank Transfer", "Card", "Cheque"];
const EMPTY = { title: "", category: "Utility", vendor: "", amount: "", payment_method: "Cash", reference_no: "", status: "pending", expense_date: new Date().toISOString().slice(0, 10), due_date: "", notes: "", bill_image: "" };

export default function OwnerExpenses() {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = () => ownerList("expenses").then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const summary = useMemo(() => {
    const list = rows || [];
    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      total: list.reduce((a, e) => a + Number(e.amount), 0),
      paid: list.filter((e) => e.status === "paid").reduce((a, e) => a + Number(e.amount), 0),
      pending: list.filter((e) => e.status === "pending").reduce((a, e) => a + Number(e.amount), 0),
      month: list.filter((e) => (e.expense_date || "").startsWith(thisMonth)).reduce((a, e) => a + Number(e.amount), 0),
    };
  }, [rows]);

  const cats = useMemo(() => [...new Set((rows || []).map((e) => e.category).filter(Boolean))], [rows]);
  const shown = (rows || []).filter((e) => !filter || e.category === filter);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...editing, amount: Number(editing.amount || 0) };
    try {
      if (editing.id) await ownerUpdate("expenses", editing.id, payload);
      else await ownerCreate("expenses", payload);
      toast.success("Expense saved.");
      setEditing(null); load();
    } catch (err) { toast.error(err.response?.data?.message || "Could not save."); }
    finally { setBusy(false); }
  };

  const remove = async (row) => { if (!(await askConfirm({ title: "Delete expense?", confirmText: "Delete", danger: true }))) return; await ownerRemove("expenses", row.id); toast.success("Deleted."); load(); };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try { const r = await ownerUpload(file); setEditing((ed) => ({ ...ed, bill_image: r.url })); toast.success("Bill uploaded."); }
    catch { toast.error("Upload failed."); }
    finally { setUploading(false); }
  };

  return (
    <div>
      <PageHead title="Expenses" subtitle="Record operating costs with vendor, payment method and bill receipts.">
        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add expense
        </button>
      </PageHead>

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Total expenses" value={summary.total} money accent="brand" />
        <StatCard icon={CheckCircle2} label="Paid" value={summary.paid} money accent="emerald" />
        <StatCard icon={Clock} label="Pending" value={summary.pending} money accent="amber" />
        <StatCard icon={CalendarDays} label="This month" value={summary.month} money accent="violet" />
      </div>

      {cats.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button onClick={() => setFilter("")} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${!filter ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>All</button>
          {cats.map((c) => (
            <button key={c} onClick={() => setFilter(c)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === c ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>{c}</button>
          ))}
        </div>
      )}

      <Card>
        {!rows ? <Loading /> : shown.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">No expenses recorded.</div>
        ) : (
          <Table head={["Title", "Vendor", "Category", "Amount", "Method", "Date", "Bill", "Status", "Actions"]}>
            {shown.map((e) => (
              <tr key={e.id} className="hover:bg-slate-50">
                <td className="px-5 py-3"><div className="font-medium text-slate-800">{e.title}</div>{e.reference_no && <div className="font-mono text-xs text-slate-400">{e.reference_no}</div>}</td>
                <td className="px-5 py-3 text-slate-600">{e.vendor || "—"}</td>
                <td className="px-5 py-3 text-slate-600">{e.category}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{taka(e.amount)}</td>
                <td className="px-5 py-3 text-slate-600">{e.payment_method || "—"}</td>
                <td className="px-5 py-3 tabular-nums text-slate-500">{e.expense_date || "—"}</td>
                <td className="px-5 py-3">{e.bill_image ? <a href={e.bill_image} target="_blank" rel="noreferrer"><img src={e.bill_image} alt="bill" className="h-9 w-9 rounded-md object-cover ring-1 ring-slate-200" /></a> : <span className="text-slate-300">—</span>}</td>
                <td className="px-5 py-3"><Badge status={e.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    <button onClick={() => setEditing(e)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(e)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <form onClick={(ev) => ev.stopPropagation()} onSubmit={save} className="max-h-[88vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">{editing.id ? "Edit expense" : "New expense"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <F label="Title" full><input className="input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} required /></F>
              <F label="Category"><select className="input" value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></F>
              <F label="Vendor"><input className="input" value={editing.vendor} onChange={(e) => setEditing({ ...editing, vendor: e.target.value })} /></F>
              <F label="Amount (৳)"><input type="number" className="input" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: e.target.value })} required /></F>
              <F label="Payment method"><select className="input" value={editing.payment_method} onChange={(e) => setEditing({ ...editing, payment_method: e.target.value })}>{METHODS.map((m) => <option key={m}>{m}</option>)}</select></F>
              <F label="Reference no."><input className="input" value={editing.reference_no} onChange={(e) => setEditing({ ...editing, reference_no: e.target.value })} /></F>
              <F label="Status"><select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}><option value="pending">Pending</option><option value="paid">Paid</option></select></F>
              <F label="Expense date"><input type="date" className="input" value={editing.expense_date || ""} onChange={(e) => setEditing({ ...editing, expense_date: e.target.value })} /></F>
              <F label="Due date"><input type="date" className="input" value={editing.due_date || ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} /></F>
              <F label="Notes" full><textarea className="input h-16 resize-none" value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></F>
              <F label="Bill / receipt image" full>
                <div className="flex items-center gap-3">
                  {editing.bill_image ? (
                    <img src={editing.bill_image} alt="bill" className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200" />
                  ) : (
                    <div className="grid h-16 w-16 place-items-center rounded-lg bg-slate-100 text-slate-400"><ImageIcon className="h-6 w-6" /></div>
                  )}
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : editing.bill_image ? "Replace" : "Upload"}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files[0])} />
                  </label>
                  {editing.bill_image && <button type="button" onClick={() => setEditing({ ...editing, bill_image: "" })} className="text-xs text-rose-600">Remove</button>}
                </div>
              </F>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
              <button disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save expense"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function F({ label, children, full }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
