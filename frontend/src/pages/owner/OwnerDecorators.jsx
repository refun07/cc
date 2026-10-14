import { useEffect, useState } from "react";
import { MapPin, Pencil, Phone, Plus, Trash2, X } from "lucide-react";
import { ownerDecorators, ownerCreateDecorator, ownerUpdateDecorator, ownerDeleteDecorator } from "../../services/api";
import { PageHead, Loading } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";
import { useT } from "../../store/langStore";

const blank = (centreId) => ({ centre_id: centreId, name: "", phone: "", service_area: "", address: "", description: "", status: "active" });

export default function OwnerDecorators() {
  const { lang } = useT();
  const [data, setData] = useState(null);
  const [selectedCentre, setSelectedCentre] = useState("");
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => ownerDecorators().then((result) => {
    setData(result);
    setSelectedCentre((current) => result.centres.some((centre) => String(centre.id) === String(current)) ? current : String(result.centres[0]?.id || ""));
  }).catch(() => { setData({ centres: [], data: [] }); toast.error("Could not load decorators."); });
  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    const payload = { ...editing, centre_id: Number(editing.centre_id) };
    try {
      if (editing.id) await ownerUpdateDecorator(editing.id, payload);
      else await ownerCreateDecorator(payload);
      toast.success(editing.id ? "Decorator updated." : "Decorator added.");
      setEditing(null);
      await load();
    } catch (error) {
      const message = Object.values(error.response?.data?.errors || {})[0]?.[0];
      toast.error(message || error.response?.data?.message || "Could not save decorator.");
    } finally { setBusy(false); }
  };
  const remove = async (decorator) => {
    if (!(await askConfirm({ title: lang === "bn" ? "ডেকরেটর সরাবেন?" : "Remove decorator?", message: lang === "bn" ? `“${decorator.name}” এই কেন্দ্রের তালিকায় আর দেখা যাবে না।` : `“${decorator.name}” will no longer appear on this centre.`, confirmText: lang === "bn" ? "সরান" : "Remove", danger: true }))) return;
    try { await ownerDeleteDecorator(decorator.id); toast.success("Decorator removed."); await load(); }
    catch { toast.error("Could not remove decorator."); }
  };

  const centres = data?.centres || [];
  const visible = (data?.data || []).filter((decorator) => String(decorator.centre_id) === selectedCentre);

  return <div>
    <PageHead title="Decorators" subtitle="Contact options for customers booking your centre.">
      <button type="button" onClick={() => setEditing(blank(Number(selectedCentre)))} disabled={!selectedCentre} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" />Add decorator</button>
    </PageHead>
    {!data ? <Loading /> : !centres.length ? <p className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">No centre is assigned to this account.</p> : <>
      <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
        <label className="text-sm font-semibold text-slate-700" htmlFor="decorator-centre">Centre</label>
        <select id="decorator-centre" className="input w-full max-w-sm" value={selectedCentre} onChange={(event) => setSelectedCentre(event.target.value)}>{centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name} · {centre.area}</option>)}</select>
        <span className="text-xs text-slate-500">{visible.length} listed</span>
      </div>
      {visible.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((decorator) => <div key={decorator.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-bold text-slate-900">{decorator.name}</h2><p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-600"><MapPin className="h-4 w-4 shrink-0" />{decorator.service_area}</p></div><span className={`rounded px-2 py-0.5 text-xs font-semibold ${decorator.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{decorator.status}</span></div>
          {decorator.address && <p className="mt-3 text-sm text-slate-600">{decorator.address}</p>}
          {decorator.description && <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{decorator.description}</p>}
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <a href={`tel:${decorator.phone}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><Phone className="h-4 w-4" />{decorator.phone}</a>
            <div className="flex gap-1"><IconButton onClick={() => setEditing({ ...decorator })} label="Edit decorator"><Pencil className="h-4 w-4" /></IconButton><IconButton onClick={() => remove(decorator)} label="Remove decorator" danger><Trash2 className="h-4 w-4" /></IconButton></div>
          </div>
        </div>)}
      </div> : <p className="rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">No decorators listed for this centre.</p>}
    </>}

    {editing && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditing(null); }}>
      <form onSubmit={save} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">{editing.id ? "Edit decorator" : "Add decorator"}</h2><IconButton onClick={() => setEditing(null)} label="Close"><X className="h-5 w-5" /></IconButton></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Centre" full><select className="input" value={editing.centre_id} onChange={(event) => setEditing((current) => ({ ...current, centre_id: event.target.value }))}>{centres.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}</select></Field>
          <Field label="Name"><input className="input" required maxLength={255} value={editing.name} onChange={(event) => setEditing((current) => ({ ...current, name: event.target.value }))} /></Field>
          <Field label="Mobile number"><input type="tel" inputMode="tel" pattern="01[0-9]{9}" title="11-digit Bangladesh mobile number" className="input" required value={editing.phone} onChange={(event) => setEditing((current) => ({ ...current, phone: event.target.value }))} /></Field>
          <Field label="Service area"><input className="input" required maxLength={255} value={editing.service_area} onChange={(event) => setEditing((current) => ({ ...current, service_area: event.target.value }))} /></Field>
          <Field label="Address"><input className="input" maxLength={255} value={editing.address || ""} onChange={(event) => setEditing((current) => ({ ...current, address: event.target.value }))} /></Field>
          <Field label="Basic information" full><textarea rows={4} maxLength={1000} className="input resize-y" value={editing.description || ""} onChange={(event) => setEditing((current) => ({ ...current, description: event.target.value }))} /></Field>
          <Field label="Status"><select className="input" value={editing.status} onChange={(event) => setEditing((current) => ({ ...current, status: event.target.value }))}><option value="active">Active</option><option value="inactive">Inactive</option></select></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button disabled={busy} className="min-h-10 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">{busy ? "Saving…" : "Save decorator"}</button></div>
      </form>
    </div>}
  </div>;
}

function Field({ label, children, full }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${full ? "sm:col-span-2" : ""}`}><span>{label}</span><div className="mt-1">{children}</div></label>;
}

function IconButton({ onClick, label, danger, children }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 ${danger ? "text-rose-600" : "text-slate-600"}`}>{children}</button>;
}
