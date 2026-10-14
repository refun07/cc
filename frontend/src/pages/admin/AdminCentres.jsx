import { useEffect, useState } from "react";
import { Star, Check, Ban, ExternalLink, Plus, X, Pencil, MapPin } from "lucide-react";
import { adminCentres, adminCreateCentre, adminSetCentreStatus, adminSetCentreType, adminSetCentreLocation, adminSetDecoratorContact, adminUsers } from "../../services/api";
import { taka } from "../../lib/format";
import { CENTRE_TYPES } from "../../lib/centreTypes";
import { PageHead, Card, Table, Badge, Loading } from "./ui";
import { toast } from "../../store/toastStore";

export default function AdminCentres() {
  const [centres, setCentres] = useState(null);
  const [owners, setOwners] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editingDecorator, setEditingDecorator] = useState(null);
  const [editingLocation, setEditingLocation] = useState(null);

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

  const setType = async (centre, centreType) => {
    setBusyId(centre.id);
    try {
      await adminSetCentreType(centre.id, centreType);
      setCentres((list) => list.map((item) => item.id === centre.id ? { ...item, centre_type: centreType } : item));
      toast.success("Centre type updated.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update centre type.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <PageHead title="Community centres" subtitle="Approve, suspend and monitor every DSCC venue.">
        <button onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Plus className="h-4 w-4" /> New centre
        </button>
      </PageHead>
      <Card>
        {!centres ? <Loading /> : (
          <Table head={["Centre", "Type", "Area", "Working area", "Capacity", "Price (½ day)", "Bookings", "Rating", "Status", "Actions"]}>
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
                <td className="px-5 py-3">
                  <select aria-label={`Type for ${c.name}`} className="min-w-40 rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700" value={c.centre_type || "community_centre"} disabled={busyId === c.id} onChange={(event) => setType(c, event.target.value)}>
                    {CENTRE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </td>
                <td className="px-5 py-3 text-slate-600">{c.area}</td>
                <td className="px-5 py-3 text-slate-600">{c.working_area || "—"}</td>
                <td className="px-5 py-3 tabular-nums">{c.capacity}</td>
                <td className="px-5 py-3 tabular-nums">{taka(c.half_day_price)}</td>
                <td className="px-5 py-3 tabular-nums">{c.bookings_count}</td>
                <td className="px-5 py-3"><span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{c.rating.toFixed(1)}</span></td>
                <td className="px-5 py-3"><Badge status={c.status} /></td>
                <td className="px-5 py-3">
                  <div className="flex gap-1.5">
                    <button type="button" onClick={() => setEditingLocation(c)} title="Edit area and working area" aria-label={`Edit area and working area for ${c.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><MapPin className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setEditingDecorator(c)} title="Edit decorator contact" aria-label={`Edit decorator contact for ${c.name}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-600 hover:bg-slate-100"><Pencil className="h-4 w-4" /></button>
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
      {editingLocation && <LocationModal centre={editingLocation} onClose={() => setEditingLocation(null)} onSaved={() => { setEditingLocation(null); load(); }} />}
      {editingDecorator && <DecoratorModal centre={editingDecorator} onClose={() => setEditingDecorator(null)} onSaved={() => { setEditingDecorator(null); load(); }} />}
    </div>
  );
}

function CentreModal({ open, owners, onClose, onCreated }) {
  const [form, setForm] = useState({
    owner_id: "",
    name: "",
    slug: "",
    area: "",
    working_area: "",
    centre_type: "community_centre",
    address: "",
    description: "",
    capacity: "",
    half_day_price: "",
    full_day_price: "",
    commission_rate: "5",
    booking_prefix: "ICCMS",
    status: "active",
    cover_image: "",
    decorator_phone: "",
    decorator_name: "",
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
          <Field label="Working area"><input className="input min-h-11" value={form.working_area} onChange={set("working_area")} placeholder="e.g. zone-1" required /></Field>
          <Field label="Centre type"><select className="input min-h-11" value={form.centre_type} onChange={set("centre_type")}>{CENTRE_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></Field>
          <Field label="Decorator name"><input className="input min-h-11" value={form.decorator_name} onChange={set("decorator_name")} maxLength={255} /></Field>
          <Field label="Decorator phone"><input type="tel" inputMode="tel" pattern="01[0-9]{9}" className="input min-h-11" value={form.decorator_phone} onChange={set("decorator_phone")} placeholder="01XXXXXXXXX" maxLength={11} /></Field>
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

function LocationModal({ centre, onClose, onSaved }) {
  const [area, setArea] = useState(centre.area || "");
  const [workingArea, setWorkingArea] = useState(centre.working_area || "");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminSetCentreLocation(centre.id, { area: area.trim(), working_area: workingArea.trim() });
      toast.success("Centre location updated.");
      onSaved();
    } catch (error) {
      toast.error(Object.values(error.response?.data?.errors || {})[0]?.[0] || error.response?.data?.message || "Could not update centre location.");
    } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Centre location · {centre.name}</h2><button type="button" onClick={onClose} aria-label="Close" className="p-2"><X className="h-5 w-5" /></button></div>
      <div className="mt-4 grid gap-3">
        <Field label="Area"><input className="input w-full" maxLength={120} value={area} onChange={(event) => setArea(event.target.value)} placeholder="e.g. Basabo" required /></Field>
        <Field label="Working area"><input className="input w-full" maxLength={120} value={workingArea} onChange={(event) => setWorkingArea(event.target.value)} placeholder="e.g. zone-1" required /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button></div>
    </form>
  </div>;
}

function DecoratorModal({ centre, onClose, onSaved }) {
  const [form, setForm] = useState({
    decorator_name: centre.decorator_name || "",
    decorator_phone: centre.decorator_phone || "",
  });
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await adminSetDecoratorContact(centre.id, Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null])));
      toast.success("Decorator contact updated.");
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update decorator contact.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <form onSubmit={submit} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
      <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Decorator contact · {centre.name}</h2><button type="button" onClick={onClose} aria-label="Close" className="p-2"><X className="h-5 w-5" /></button></div>
      <div className="mt-4 grid gap-3">
        <Field label="Decorator name"><input className="input w-full" maxLength={255} value={form.decorator_name} onChange={set("decorator_name")} /></Field>
        <Field label="Decorator phone"><input type="tel" inputMode="tel" pattern="01[0-9]{9}" maxLength={11} value={form.decorator_phone} onChange={set("decorator_phone")} placeholder="01XXXXXXXXX" className="input w-full" /></Field>
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border px-4 py-2">Cancel</button><button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white disabled:opacity-50">Save</button></div>
    </form>
  </div>;
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
