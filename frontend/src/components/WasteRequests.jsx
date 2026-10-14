import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Plus, RefreshCw, Truck } from "lucide-react";
import api from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";

export default function WasteRequests() {
  const role = useAuthStore((s) => s.user?.role);
  const { lang } = useT();
  const tr = (en, bn) => lang === "bn" ? bn : en;
  const caretaker = role === "caretaker";
  const [scope, setScope] = useState("requested");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState(null);
  const load = useCallback(async () => {
    try {
      const result = await api.get("/waste-requests", { params: { scope, page } });
      setData(result.data.data); setError("");
    } catch { setError(lang === "bn" ? "অনুরোধ লোড করা যায়নি। আবার চেষ্টা করুন।" : "Could not load requests. Please retry."); }
  }, [scope, page, lang]);
  useEffect(() => {
    if (!["caretaker", "area_admin", "admin"].includes(role)) return;
    load(); const timer = setInterval(load, 60000); return () => clearInterval(timer);
  }, [load, role]);
  const submit = async (event) => {
    event.preventDefault(); if (busy) return;
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    setBusy(true); setError("");
    try {
      if (action.kind === "create") await api.post("/waste-requests", fields);
      if (action.kind === "assign") await api.post(`/waste-requests/${action.row.id}/assign`, { ...fields, pickup_scheduled_for: new Date(`${fields.schedule}+06:00`).toISOString() });
      if (action.kind === "complete") await api.post(`/waste-requests/${action.row.id}/complete`, { ...fields, confirmed: fields.confirmed === "on" });
      setAction(null); await load();
    } catch (err) { setError(Object.values(err.response?.data?.errors || {})[0]?.[0] || err.response?.data?.message || tr("Could not save. Please retry.", "সংরক্ষণ করা যায়নি। আবার চেষ্টা করুন।")); }
    finally { setBusy(false); }
  };
  if (!["caretaker", "area_admin", "admin"].includes(role)) return null;
  const date = (v) => v ? new Date(v).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—";
  const button = "min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50";
  return <section className="min-w-0 space-y-4 border-y border-slate-200 py-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Truck className="h-5 w-5 text-brand-700" />{tr("Waste collection requests", "বর্জ্য সংগ্রহের অনুরোধ")}</h2>
      <div className="flex gap-2"><button type="button" onClick={load} title={tr("Refresh", "রিফ্রেশ করুন")} aria-label={tr("Refresh", "রিফ্রেশ করুন")} className={`${button} grid place-items-center`}><RefreshCw className="h-4 w-4" /></button>{caretaker && <button type="button" onClick={() => { setAction({ kind: "create" }); setError(""); }} className={`${button} inline-flex items-center gap-2 bg-brand-600 text-white`}><Plus className="h-4 w-4" />{tr("Request collection", "সংগ্রহের অনুরোধ")}</button>}</div>
    </div>
    <div className="flex flex-wrap gap-2">{[["requested", tr("Awaiting assignment", "বরাদ্দের অপেক্ষায়")], ["assigned", tr("Awaiting collection", "সংগ্রহের অপেক্ষায়")], ["completed", tr("Collection confirmed", "সংগ্রহ নিশ্চিত")]].map(([value, label]) => <button key={value} type="button" aria-pressed={scope === value} onClick={() => { setScope(value); setPage(1); setData(null); setAction(null); }} className={`min-h-11 border-b-2 px-3 text-sm font-semibold ${scope === value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{label} ({data?.counts[value] ?? "—"})</button>)}</div>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {action && <form onSubmit={submit} className="space-y-4 border-y border-brand-200 bg-brand-50/50 p-4">
      <h3 className="font-semibold">{action.kind === "create" ? tr("New collection request", "নতুন সংগ্রহের অনুরোধ") : action.kind === "assign" ? tr("Assign waste partner", "বর্জ্য অপসারণকারী বরাদ্দ") : tr("Confirm waste collected", "বর্জ্য সংগ্রহ নিশ্চিত করুন")}{action.row && ` · ${action.row.waste_type}`}</h3>
      {action.kind === "create" && <label className="block text-sm">{tr("Centre", "কেন্দ্র")}<select name="centre_id" required defaultValue={data?.centres.length === 1 ? data.centres[0].id : ""} className="input mt-1 w-full"><option value="" disabled>{tr("Select centre", "কেন্দ্র বাছুন")}</option>{data?.centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
      {action.kind === "create" && <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm sm:col-span-3">{tr("Waste type", "বর্জ্যের ধরন")}<input name="waste_type" required maxLength={100} className="input mt-1 w-full" /></label><label className="text-sm">{tr("Quantity", "পরিমাণ")}<input name="quantity" type="number" min="0.01" max="999999" step="0.01" required className="input mt-1 w-full" /></label><label className="text-sm">{tr("Unit", "একক")}<select name="unit" className="input mt-1 w-full"><option value="kg">{tr("kg", "কেজি")}</option><option value="pcs">{tr("pieces", "টি")}</option></select></label></div>}
      {action.kind === "assign" && <div className="grid gap-3 sm:grid-cols-2"><label className="min-w-0 text-sm">{tr("Waste partner", "বর্জ্য অপসারণকারী")}<select name="partner_id" required defaultValue="" className="input mt-1 w-full"><option value="" disabled>{tr("Select partner", "অপসারণকারী বাছুন")}</option>{data?.partners.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.phone}</option>)}</select>{data?.partners.length === 0 && <span className="text-amber-800">{tr("No active partners available.", "সক্রিয় অপসারণকারী নেই।")}</span>}</label><label className="min-w-0 text-sm">{tr("Pickup time (Bangladesh)", "সংগ্রহের সময় (বাংলাদেশ)")}<input name="schedule" type="datetime-local" required className="input mt-1 w-full min-w-0" /></label></div>}
      {action.kind !== "assign" && <label className="block text-sm">{tr("Notes (optional)", "বিবরণ (ঐচ্ছিক)")}<textarea name="notes" maxLength={2000} rows={2} className="input mt-1 w-full" /></label>}
      {action.kind === "complete" && <label className="flex items-start gap-3 text-sm"><input name="confirmed" type="checkbox" required className="mt-1 h-5 w-5 shrink-0" />{tr("I confirm that the assigned partner has collected the waste from this centre.", "নির্ধারিত অপসারণকারী এই কেন্দ্র থেকে বর্জ্য সংগ্রহ করেছেন, আমি নিশ্চিত করছি।")}</label>}
      <div className="flex flex-wrap gap-2"><button disabled={busy} className={`${button} bg-brand-600 text-white`}>{busy ? tr("Saving…", "সংরক্ষণ হচ্ছে…") : tr("Submit", "জমা দিন")}</button><button type="button" disabled={busy} onClick={() => setAction(null)} className={`${button} bg-white`}>{tr("Cancel", "বাতিল")}</button></div>
    </form>}
    {!data && !error && <p className="text-sm text-slate-500">{tr("Loading…", "লোড হচ্ছে…")}</p>}
    {data?.requests.data.length === 0 && <p className="py-4 text-sm text-slate-500">{tr("No requests in this view.", "এই তালিকায় কোনো অনুরোধ নেই।")}</p>}
    <div className="divide-y divide-slate-200">{data?.requests.data.map((row) => <article key={row.id} className="flex min-w-0 flex-wrap items-start justify-between gap-4 py-4">
      <div className="min-w-0 flex-1 break-words"><h3 className="font-semibold">#{row.id} · {row.centre?.name}</h3><p className="mt-1 text-sm">{row.waste_type} · {row.quantity} {row.unit}</p><p className="mt-1 text-sm text-slate-500">{tr("Requested by", "অনুরোধকারী")}: {row.requester?.name} · {date(row.created_at)}</p>{row.notes && <p className="mt-1 text-sm">{row.notes}</p>}{row.partner && <p className="mt-2 text-sm">{row.partner.name} · {row.partner.phone}<br />{tr("Scheduled", "নির্ধারিত সময়")}: {date(row.pickup_scheduled_for)}<br />{tr("Assigned by", "বরাদ্দকারী")}: {row.assigner?.name}</p>}{row.status === "pickup_assigned" && new Date(row.pickup_scheduled_for) < new Date() && <p className="mt-1 text-sm font-semibold text-amber-800">{tr("Overdue collection", "সংগ্রহের সময় পেরিয়েছে")}</p>}{row.collection_confirmer && <p className="mt-2 text-sm text-brand-700">{tr("Confirmed by", "নিশ্চিত করেছেন")}: {row.collection_confirmer.name} · {date(row.collected_at)}{row.collection_notes && <span className="block">{row.collection_notes}</span>}</p>}</div>
      {scope === "requested" && !caretaker && <button type="button" onClick={() => { setAction({ kind: "assign", row }); setError(""); }} className={`${button} inline-flex items-center gap-2 text-brand-700`}><Truck className="h-4 w-4" />{tr("Assign partner", "অপসারণকারী বরাদ্দ")}</button>}
      {scope === "assigned" && caretaker && <button type="button" onClick={() => { setAction({ kind: "complete", row }); setError(""); }} className={`${button} inline-flex items-center gap-2 bg-brand-600 text-white`}><CheckCircle2 className="h-4 w-4" />{tr("Confirm collection", "সংগ্রহ নিশ্চিত করুন")}</button>}
    </article>)}</div>
    {data?.requests.last_page > 1 && <div className="flex items-center justify-end gap-3"><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)} className={button}>{tr("Previous", "আগের")}</button><span>{page} / {data.requests.last_page}</span><button type="button" disabled={page === data.requests.last_page} onClick={() => setPage(page + 1)} className={button}>{tr("Next", "পরের")}</button></div>}
  </section>;
}
