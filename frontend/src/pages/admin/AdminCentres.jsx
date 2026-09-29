import { useEffect, useState } from "react";
import { Star, Check, Ban, ExternalLink, Plus, X } from "lucide-react";
import { adminCentres, adminCreateCentre, adminSetCentreStatus, adminUsers } from "../../services/api";
import { taka } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading } from "./ui";
import { toast } from "../../store/toastStore";

export default function AdminCentres() {
  const [centres, setCentres] = useState(null);
  const [owners, setOwners] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => adminCentres().then(setCentres).catch(() => setCentres([]));
  useEffect(() => { load(); }, []);
  useEffect(() => { adminUsers({ role: "owner" }).then(setOwners).catch(() => setOwners([])); }, []);

  const setStatus = async (c, status) => {
    setBusyId(c.id);
    try {
      await adminSetCentreStatus(c.id, status);
      setCentres((list) => list.map((x) => (x.id === c.id ? { ...x, status, is_verified: status === "active" ? true : x.is_verified } : x)));
      toast.success(`${c.name} ${status === "active" ? "approved & activated" : status === "suspended" ? "suspended" : "updated"}.`);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not update centre.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHead title="Community centres" subtitle="Approve, suspend and monitor every venue on the marketplace.">
        <button onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Plus className="h-4 w-4" /> New centre
        </button>
      </PageHead>
      <Card>
        {!centres ? <Loading /> : (
          <Table head={["Centre", "Area", "Capacity", "Price (½ day)", "Bookings", "Rating", "Status", "Actions"]}>
            {centres.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img src={c.cover_image} alt="" className="h-9 w-9 rounded-lg object-cover" />
                    <a href={`/centres/${c.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-slate-800 hover:text-brand-700">
                      {c.name} <ExternalLink className="h-3 w-3 text-slate-400" />
                    </a>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-600">{c.area}</td>
                <td className="px-5 py-3 tabular-nums">{c.capacity}</td>
                <td className="px-5 py-3 tabular-nums">{taka(c.half_day_price)}</td>
                <td className="px-5 py-3 tabular-nums">{c.bookings_count}</td>
                <td className="px-5 py-3"><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{c.rating.toFixed(1)}</span></td>
                <td className="px-5 py-3"><Badge status={c.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    {c.status !== "active" && (
                      <button disabled={busyId === c.id} onClick={() => setStatus(c, "active")}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {c.status !== "suspended" && (
                      <button disabled={busyId === c.id} onClick={() => setStatus(c, "suspended")}
                        className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
                        <Ban className="h-3.5 w-3.5" /> Suspend
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      <CentreModal open={creating} owners={owners} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />
    </div>
  );
}

function CentreModal({ open, owners, onClose, onCreated }) {
  const [form, setForm] = useState({
    owner_id: "",
    name: "",
    slug: "",
    area: "",
    address: "",
    description: "",
    capacity: "",
    half_day_price: "",
    full_day_price: "",
    commission_rate: "5",
    booking_prefix: "DSCC",
    status: "active",
    cover_image: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm((f) => ({ ...f, owner_id: owners[0]?.id ? String(owners[0].id) : "" }));
    }
  }, [open, owners]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminCreateCentre({
        ...form,
        owner_id: form.owner_id || null,
        slug: form.slug || null,
        capacity: Number(form.capacity),
        half_day_price: Number(form.half_day_price),
        full_day_price: Number(form.full_day_price),
        commission_rate: form.commission_rate === "" ? null : Number(form.commission_rate),
        cover_image: form.cover_image || null,
      });
      toast.success("Centre created.");
      onCreated();
    } catch (e) {
      toast.error(e.response?.data?.message || Object.values(e.response?.data?.errors || {})[0]?.[0] || "Could not create centre.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-slate-900">Create community centre</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Owner"><select className="input min-h-11" value={form.owner_id} onChange={set("owner_id")}><option value="">No owner yet</option>{owners.map((o) => <option key={o.id} value={o.id}>{o.name} · {o.phone}</option>)}</select></Field>
          <Field label="Status"><select className="input min-h-11" value={form.status} onChange={set("status")}><option value="active">Active</option><option value="pending">Pending</option><option value="draft">Draft</option><option value="suspended">Suspended</option></select></Field>
          <Field label="Centre name"><input className="input min-h-11" value={form.name} onChange={set("name")} required /></Field>
          <Field label="Slug"><input className="input min-h-11" value={form.slug} onChange={set("slug")} placeholder="Auto-generated when blank" /></Field>
          <Field label="Area"><input className="input min-h-11" value={form.area} onChange={set("area")} required /></Field>
          <Field label="Capacity"><input type="number" min="1" className="input min-h-11" value={form.capacity} onChange={set("capacity")} required /></Field>
          <Field label="Half-day price"><input type="number" min="0" className="input min-h-11" value={form.half_day_price} onChange={set("half_day_price")} required /></Field>
          <Field label="Full-day price"><input type="number" min="0" className="input min-h-11" value={form.full_day_price} onChange={set("full_day_price")} required /></Field>
          <Field label="Commission %"><input type="number" min="0" max="25" step="0.01" className="input min-h-11" value={form.commission_rate} onChange={set("commission_rate")} /></Field>
          <Field label="Booking prefix"><input className="input min-h-11 uppercase" value={form.booking_prefix} onChange={set("booking_prefix")} maxLength={12} /></Field>
          <div className="sm:col-span-2"><Field label="Address"><input className="input min-h-11" value={form.address} onChange={set("address")} /></Field></div>
          <div className="sm:col-span-2"><Field label="Cover image URL"><input type="url" className="input min-h-11" value={form.cover_image} onChange={set("cover_image")} placeholder="Uses default venue image when blank" /></Field></div>
          <div className="sm:col-span-2"><Field label="Description"><textarea rows="3" className="input resize-none" value={form.description} onChange={set("description")} /></Field></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
          <button disabled={busy} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating..." : "Create centre"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
