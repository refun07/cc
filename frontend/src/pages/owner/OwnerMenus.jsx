import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { ownerMenus, ownerCreateMenu, ownerUpdateMenu, ownerDeleteMenu } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, Card, Loading } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const EMPTY = { name: "", menu_type: "", price_per_person: "", min_guest_count: "", items: "", description: "", status: "active" };

export default function OwnerMenus() {
  const [menus, setMenus] = useState(null);
  const [editing, setEditing] = useState(null); // object or null
  const [busy, setBusy] = useState(false);

  const load = () => ownerMenus().then(setMenus).catch(() => setMenus([]));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...editing, price_per_person: Number(editing.price_per_person), min_guest_count: Number(editing.min_guest_count || 0) };
    try {
      if (editing.id) await ownerUpdateMenu(editing.id, payload);
      else await ownerCreateMenu(payload);
      toast.success(editing.id ? `“${payload.name}” updated.` : `“${payload.name}” added.`);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save menu.");
    } finally { setBusy(false); }
  };

  const remove = async (m) => {
    if (!(await askConfirm({ title: "Delete menu?", message: `“${m.name}” will be removed.`, confirmText: "Delete", danger: true }))) return;
    await ownerDeleteMenu(m.id); toast.success("Menu removed."); load();
  };

  return (
    <div>
      <PageHead title="Food Menus" subtitle="Create and manage the catering packages customers can choose.">
        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Add menu
        </button>
      </PageHead>

      {!menus ? <Loading /> : menus.length === 0 ? (
        <Card><div className="p-10 text-center text-sm text-slate-400">No menus yet. Add your first package.</div></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menus.map((m) => (
            <div key={m.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-900">{m.name}</div>
                  {m.menu_type && <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{m.menu_type}</span>}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{m.status}</span>
              </div>
              <p className="mt-2 flex-1 text-xs text-slate-500">{m.items}</p>
              <div className="mt-3 flex items-end justify-between">
                <div className="text-sm"><span className="text-lg font-extrabold text-brand-700">{taka(m.price_per_person)}</span><span className="text-slate-400"> /person · min {m.min_guest_count}</span></div>
                <div className="flex gap-1.5">
                  <button onClick={() => setEditing(m)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(m)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">{editing.id ? "Edit menu" : "New menu"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <L label="Name" full><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} required /></L>
              <L label="Type"><input className="input" placeholder="e.g. Premium" value={editing.menu_type || ""} onChange={(e) => setEditing({ ...editing, menu_type: e.target.value })} /></L>
              <L label="Status">
                <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                  <option value="active">Active</option><option value="inactive">Inactive</option>
                </select>
              </L>
              <L label="Price / person (৳)"><input type="number" className="input" value={editing.price_per_person} onChange={(e) => setEditing({ ...editing, price_per_person: e.target.value })} required /></L>
              <L label="Min guests"><input type="number" className="input" value={editing.min_guest_count} onChange={(e) => setEditing({ ...editing, min_guest_count: e.target.value })} /></L>
              <L label="Items" full><input className="input" placeholder="Comma separated" value={editing.items || ""} onChange={(e) => setEditing({ ...editing, items: e.target.value })} /></L>
              <L label="Description" full><textarea className="input h-20 resize-none" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></L>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
              <button disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save menu"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function L({ label, children, full }) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
