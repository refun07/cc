import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, X, Search } from "lucide-react";
import { ownerList, ownerCreate, ownerUpdate, ownerRemove } from "../../services/api";
import { PageHead, Card, Table, Loading } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

/**
 * Generic owner resource manager (list + search + add/edit modal + delete).
 * columns: [{ key, label, render?(row) }]
 * fields:  [{ key, label, type?, options?, required?, full? }]
 * searchKeys: optional array of row keys to match against the search box.
 */
export default function CrudPanel({
  resource, title, subtitle, addLabel = "Add", columns, fields, defaults, headExtra, rowActions,
  searchKeys, searchPlaceholder = "Search…",
}) {
  const [rows, setRows] = useState(null);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const keys = searchKeys || (fields || []).filter((f) => !f.type || f.type === "text").map((f) => f.key);

  const load = () => ownerList(resource).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resource]);

  const shown = useMemo(() => {
    const l = rows || [];
    const q = query.trim().toLowerCase();
    if (!q) return l;
    return l.filter((r) => keys.some((k) => String(r[k] ?? "").toLowerCase().includes(q)));
  }, [rows, query, keys]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    const payload = { ...editing };
    fields.forEach((f) => { if (f.type === "number") payload[f.key] = Number(payload[f.key] || 0); });
    try {
      if (editing.id) await ownerUpdate(resource, editing.id, payload);
      else await ownerCreate(resource, payload);
      toast.success(editing.id ? "Changes saved." : "Created.");
      setEditing(null); load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save.");
    } finally { setBusy(false); }
  };

  const remove = async (row) => {
    if (!(await askConfirm({ title: "Delete record?", message: "This action cannot be undone.", confirmText: "Delete", danger: true }))) return;
    try { await ownerRemove(resource, row.id); toast.success("Deleted."); load(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not delete."); }
  };

  return (
    <div>
      <PageHead title={title} subtitle={subtitle}>
        <button onClick={() => setEditing({ ...defaults })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      </PageHead>

      {headExtra}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:max-w-xs">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} className="w-full bg-transparent text-sm outline-none" />
        </div>
        {rows && <div className="text-sm text-slate-400">{shown.length} {shown.length === 1 ? "record" : "records"}</div>}
      </div>

      <Card>
        {!rows ? <Loading /> : shown.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">{query ? `No matches for “${query}”.` : "Nothing here yet."}</div>
        ) : (
          <Table head={[...columns.map((c) => c.label), "Actions"]}>
            {shown.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {columns.map((c) => (
                  <td key={c.key} className="px-5 py-3 text-slate-700">{c.render ? c.render(row, load) : row[c.key]}</td>
                ))}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-1.5">
                    {rowActions?.(row, load)}
                    <button onClick={() => setEditing(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => remove(row)} className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {editing && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setEditing(null)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={save} className="w-full max-w-lg space-y-3 rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-slate-900">{editing.id ? `Edit ${title}` : addLabel}</h2>
              <button type="button" onClick={() => setEditing(null)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f) => (
                <label key={f.key} className={`block ${f.full ? "col-span-2" : ""}`}>
                  <span className="text-xs font-semibold text-slate-500">{f.label}</span>
                  <div className="mt-1">
                    {f.type === "select" ? (
                      <select className="input" value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })}>
                        {f.options.map((o) => <option key={o} value={o}>{String(o).replaceAll("_", " ")}</option>)}
                      </select>
                    ) : f.type === "textarea" ? (
                      <textarea className="input h-20 resize-none" value={editing[f.key] ?? ""} onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                    ) : (
                      <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} className="input"
                        value={editing[f.key] ?? ""} required={f.required}
                        onChange={(e) => setEditing({ ...editing, [f.key]: e.target.value })} />
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
              <button disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
