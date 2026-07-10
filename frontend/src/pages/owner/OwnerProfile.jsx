import { useEffect, useState } from "react";
import { Save, ExternalLink, Check, Upload, ImageIcon, Trash2, Plus, Pencil } from "lucide-react";
import { FACILITY_ICONS, facilityIcon, resolveIconKey } from "../../lib/facilityIcons";
import RichTextEditor from "../../components/RichTextEditor";
import { ownerProfile, ownerUpdateProfile, ownerUploadCover, ownerAddGallery, ownerDeleteGallery, ownerFloors, ownerCreateFloor, ownerUpdateFloor, ownerDeleteFloor, ownerAddFacility, ownerUpdateFacility, ownerDeleteFacility } from "../../services/api";
import { PageHead, Card, Loading } from "../admin/ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

export default function OwnerProfile() {
  const [centre, setCentre] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cover, setCover] = useState(null);
  const [gallery, setGallery] = useState([]);
  const [uploading, setUploading] = useState(false);

  const refreshImages = (c) => { setCover(c.cover_image); setGallery(c.images || []); };

  useEffect(() => {
    ownerProfile().then((c) => {
      setCentre(c);
      refreshImages(c);
      setForm({
        name: c.name || "", area: c.area || "", address: c.address || "", description: c.description || "",
        capacity: c.capacity || 0, base_price: c.base_price || 0, half_day_price: c.half_day_price || 0,
        full_day_price: c.full_day_price || 0, virtual_tour_url: c.virtual_tour_url || "",
        booking_prefix: c.booking_prefix || "DSCC",
      });
    }).catch(() => setCentre(false));
  }, []);

  if (centre === false) return <Card><div className="p-10 text-center text-sm text-slate-400">No centre assigned to your account.</div></Card>;
  if (!form) return <Loading rows={5} />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setSaved(false);
    try {
      await ownerUpdateProfile({
        ...form,
        capacity: Number(form.capacity),
        base_price: Number(form.base_price),
        half_day_price: Number(form.half_day_price),
        full_day_price: Number(form.full_day_price),
        virtual_tour_url: form.virtual_tour_url || null,
        booking_prefix: (form.booking_prefix || "DSCC").toUpperCase(),
      });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not save.");
    } finally { setBusy(false); }
  };

  const uploadCover = async (file) => {
    if (!file) return;
    setUploading(true);
    try { const r = await ownerUploadCover(file); setCover(r.url); toast.success("Cover photo updated."); }
    catch { toast.error("Upload failed."); }
    finally { setUploading(false); }
  };
  const addGallery = async (file) => {
    if (!file) return;
    setUploading(true);
    try { const r = await ownerAddGallery(file); setGallery((g) => [...g, r.data]); toast.success("Image added."); }
    catch { toast.error("Upload failed."); }
    finally { setUploading(false); }
  };
  const removeGallery = async (img) => {
    if (!(await askConfirm({ title: "Remove image?", confirmText: "Remove", danger: true }))) return;
    await ownerDeleteGallery(img.id);
    setGallery((g) => g.filter((x) => x.id !== img.id));
  };

  return (
    <div>
      <PageHead title="Venue Profile" subtitle="Update how your centre appears to customers.">
        <a href={`/centres/${centre.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ExternalLink className="h-4 w-4" /> View public page
        </a>
      </PageHead>

      {/* Images */}
      <Card title="Photos" >
        <div className="grid gap-6 p-5 md:grid-cols-[280px_1fr]">
          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">Cover photo</div>
            <div className="relative h-40 overflow-hidden rounded-xl bg-slate-100 ring-1 ring-slate-200">
              {cover ? <img src={cover} alt="cover" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-slate-400"><ImageIcon className="h-8 w-8" /></div>}
            </div>
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Change cover"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadCover(e.target.files[0])} />
            </label>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
              Recommended: <span className="font-semibold text-slate-500">1600 × 900 px</span> (16:9 landscape) · JPG or PNG · under 5 MB.
            </p>
          </div>

          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">Gallery</div>
            <p className="mb-2 text-[11px] leading-relaxed text-slate-400">
              Recommended: <span className="font-semibold text-slate-500">1200 × 1200 px</span> (square) · JPG or PNG · under 5 MB each.
            </p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {gallery.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-slate-200">
                  <img src={img.image_path} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => removeGallery(img)} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-black/55 text-white opacity-0 transition group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
              <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 text-slate-400 transition hover:border-brand-400 hover:text-brand-600">
                <div className="flex flex-col items-center gap-1 text-xs font-semibold"><Plus className="h-5 w-5" /> Add</div>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => addGallery(e.target.files[0])} />
              </label>
            </div>
          </div>
        </div>
      </Card>

      <form onSubmit={save} className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card title="Centre details">
          <div className="grid grid-cols-2 gap-4 p-5">
            <L label="Centre name"><input className="input" value={form.name ?? ""} onChange={set("name")} /></L>
            <L label="Area"><input className="input" value={form.area ?? ""} onChange={set("area")} placeholder="e.g. Dhanmondi" /></L>
            <L label="Address" full><input className="input" value={form.address ?? ""} onChange={set("address")} /></L>
            <L label="Description" full>
              <RichTextEditor
                value={form.description ?? ""}
                onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                placeholder="Describe your venue — halls, catering, parking, standout features…"
              />
            </L>
            <L label="Virtual tour URL" full><input className="input" placeholder="https://…" value={form.virtual_tour_url ?? ""} onChange={set("virtual_tour_url")} /></L>
            <L label="Booking code prefix" full>
              <input
                className="input uppercase"
                maxLength={12}
                value={form.booking_prefix}
                onChange={(e) => setForm((f) => ({ ...f, booking_prefix: e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase() }))}
                placeholder="DSCC"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                2–12 letters/numbers. New bookings will look like <span className="font-mono font-semibold text-slate-600">{(form.booking_prefix || "DSCC")}-A1B2C3D4</span>. Existing booking numbers don't change.
              </p>
            </L>
          </div>
        </Card>

        <Card title="Capacity & pricing">
          <div className="space-y-4 p-5">
            <L label="Capacity (guests)"><input type="number" className="input" value={form.capacity ?? 0} onChange={set("capacity")} /></L>
            <L label="Base price (৳)"><input type="number" className="input" value={form.base_price ?? 0} onChange={set("base_price")} /></L>
            <L label="Half-day price (৳)"><input type="number" className="input" value={form.half_day_price ?? 0} onChange={set("half_day_price")} /></L>
            <L label="Full-day price (৳)"><input type="number" className="input" value={form.full_day_price ?? 0} onChange={set("full_day_price")} /></L>
            <p className="text-[11px] text-slate-400">These are the venue defaults. Floors with their own capacity/pricing override them.</p>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}</>}
            </button>
          </div>
        </Card>
      </form>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <FacilitiesCard centre={centre} />
        <FloorsCard />
      </div>
    </div>
  );
}

/** Amenities shown on the public centre card and detail page. */
function FacilitiesCard({ centre }) {
  const [rows, setRows] = useState(centre?.facilities || []);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name, icon }
  const [busy, setBusy] = useState(false);

  // Preview the icon that will be auto-matched from the name as you type.
  const NewIcon = facilityIcon(name, null);

  const add = async (event) => {
    event.preventDefault();
    const value = name.trim();
    if (!value) return;
    setBusy(true);
    try { const created = await ownerAddFacility({ name: value, icon: resolveIconKey(value) }); setRows((r) => [...r, created]); setName(""); toast.success("Facility added."); }
    catch (error) { toast.error(error.response?.data?.message || "Could not add facility."); }
    finally { setBusy(false); }
  };

  const saveEdit = async () => {
    const value = editing.name.trim();
    if (!value) return;
    setBusy(true);
    try { const updated = await ownerUpdateFacility(editing.id, { name: value, icon: editing.icon }); setRows((r) => r.map((f) => (f.id === updated.id ? updated : f))); setEditing(null); toast.success("Facility updated."); }
    catch (error) { toast.error(error.response?.data?.message || "Could not update facility."); }
    finally { setBusy(false); }
  };

  const remove = async (facility) => {
    if (!(await askConfirm({ title: "Remove facility?", message: `“${facility.name}” will no longer show on your listing.`, confirmText: "Remove", danger: true }))) return;
    try { await ownerDeleteFacility(facility.id); setRows((r) => r.filter((f) => f.id !== facility.id)); toast.success("Facility removed."); }
    catch (error) { toast.error(error.response?.data?.message || "Could not remove facility."); }
  };

  return (
    <Card title="Facilities & amenities">
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-500">These chips appear on your public listing card and detail page. An icon is matched from the name — click a chip to change it.</p>

        <div className="flex flex-wrap gap-2">
          {!rows.length && <span className="text-sm text-slate-400">No facilities listed yet.</span>}
          {rows.map((facility) => {
            const Icon = facilityIcon(facility.name, facility.icon);
            return (
              <span key={facility.id} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 ring-1 ring-slate-200">
                <Icon className="h-4 w-4 text-brand-600" />
                {facility.name}
                <button type="button" onClick={() => setEditing({ id: facility.id, name: facility.name, icon: resolveIconKey(facility.name, facility.icon) })} className="ml-0.5 text-slate-300 hover:text-brand-600" aria-label={`Edit ${facility.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => remove(facility)} className="text-slate-300 hover:text-rose-600" aria-label={`Remove ${facility.name}`}><Trash2 className="h-3.5 w-3.5" /></button>
              </span>
            );
          })}
        </div>

        {editing && (
          <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4">
            <L label="Facility name">
              <input autoFocus className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditing(null); }} />
            </L>
            <div>
              <span className="text-xs font-semibold text-slate-500">Icon</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {Object.entries(FACILITY_ICONS).map(([key, { icon: Icon, label }]) => (
                  <button key={key} type="button" title={label} onClick={() => setEditing({ ...editing, icon: key })}
                    className={`grid h-9 w-9 place-items-center rounded-lg transition ${editing.icon === key ? "bg-brand-600 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:text-brand-600"}`}>
                    <Icon className="h-4 w-4" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy} onClick={saveEdit} className="min-h-11 flex-1 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save facility"}</button>
              <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
            </div>
          </div>
        )}

        <form onSubmit={add} className="flex gap-2">
          <div className="relative flex-1">
            <NewIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Air Conditioning, Parking, Bridal Room" />
          </div>
          <button disabled={busy || !name.trim()} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            <Plus className="h-4 w-4" /> Add
          </button>
        </form>
      </div>
    </Card>
  );
}

const FLOOR_BLANK = { name: "", description: "", capacity: 0, half_day_price: 0, full_day_price: 0, sort_order: 0, status: "active" };

/**
 * Floors are optional. With none, the venue is booked as a single unit.
 * With one or more, customers and admins must pick a floor, and each floor
 * carries its own capacity, pricing and independent availability calendar.
 */
function FloorsCard() {
  const [floors, setFloors] = useState(null);
  const [editing, setEditing] = useState(null); // FLOOR_BLANK shape (+ id when editing)
  const [busy, setBusy] = useState(false);

  const load = () => ownerFloors().then(setFloors).catch(() => setFloors([]));
  // Must not return the promise — React would treat it as the cleanup function.
  useEffect(() => { load(); }, []);

  const save = async (event) => {
    event.preventDefault();
    if (!editing.name.trim()) return toast.error("Give the floor a name.");
    setBusy(true);
    try {
      const payload = { ...editing, capacity: Number(editing.capacity) || 0, half_day_price: Number(editing.half_day_price) || 0, full_day_price: Number(editing.full_day_price) || 0, sort_order: Number(editing.sort_order) || 0 };
      if (editing.id) await ownerUpdateFloor(editing.id, payload);
      else await ownerCreateFloor(payload);
      toast.success(editing.id ? "Floor updated." : "Floor added.");
      setEditing(null); load();
    } catch (error) { toast.error(error.response?.data?.message || "Could not save the floor."); }
    finally { setBusy(false); }
  };

  const remove = async (floor) => {
    if (!(await askConfirm({ title: "Delete floor?", message: `“${floor.name}” will be removed. Floors with bookings cannot be deleted — set them inactive instead.`, confirmText: "Delete", danger: true }))) return;
    try { await ownerDeleteFloor(floor.id); toast.success("Floor removed."); load(); }
    catch (error) { toast.error(error.response?.data?.message || "Could not delete the floor."); }
  };

  return (
    <Card title="Floors & halls">
      <div className="space-y-4 p-5">
        <p className="text-sm text-slate-500">
          Add a floor for each separately bookable hall. Each gets its own capacity, pricing and availability calendar.
          {" "}<span className="font-medium text-slate-700">Leave empty to keep booking the venue as one unit.</span>
        </p>

        {!floors ? <Loading rows={3} /> : (
          <div className="space-y-2">
            {!floors.length && <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">No floors yet — the whole venue is booked as one unit.</div>}
            {floors.map((floor) => (
              <div key={floor.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{floor.name}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${floor.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{floor.status}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {floor.description ? `${floor.description} · ` : ""}up to {floor.capacity || "—"} guests · half ৳{Number(floor.half_day_price).toLocaleString()} · full ৳{Number(floor.full_day_price).toLocaleString()}
                  </div>
                </div>
                <button type="button" onClick={() => setEditing({ ...FLOOR_BLANK, ...floor })} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">Edit</button>
                <button type="button" onClick={() => remove(floor)} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        )}

        {editing ? (
          <form onSubmit={save} className="grid gap-3 rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:grid-cols-2">
            <L label="Floor name"><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Ground Floor Hall" /></L>
            <L label="Description"><input className="input" value={editing.description || ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="Optional" /></L>
            <L label="Capacity (guests)"><input type="number" className="input" value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} /></L>
            <L label="Display order"><input type="number" className="input" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} /></L>
            <L label="Half-day price (৳)"><input type="number" className="input" value={editing.half_day_price} onChange={(e) => setEditing({ ...editing, half_day_price: e.target.value })} /></L>
            <L label="Full-day price (৳)"><input type="number" className="input" value={editing.full_day_price} onChange={(e) => setEditing({ ...editing, full_day_price: e.target.value })} /></L>
            <L label="Status">
              <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                <option value="active">Active (bookable)</option>
                <option value="inactive">Inactive (hidden)</option>
              </select>
            </L>
            <div className="flex items-end gap-2">
              <button disabled={busy} className="min-h-11 flex-1 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : editing.id ? "Save floor" : "Add floor"}</button>
              <button type="button" onClick={() => setEditing(null)} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
            </div>
            <p className="sm:col-span-2 text-xs text-slate-400">Leave a price or capacity at 0 to fall back to the venue's default.</p>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing({ ...FLOOR_BLANK, sort_order: (floors?.length || 0) + 1 })} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <Plus className="h-4 w-4" /> Add floor
          </button>
        )}
      </div>
    </Card>
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
