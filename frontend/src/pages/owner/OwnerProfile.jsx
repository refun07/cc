import { useEffect, useState } from "react";
import { Save, ExternalLink, Check, Upload, ImageIcon, Trash2, Plus } from "lucide-react";
import { ownerProfile, ownerUpdateProfile, ownerUploadCover, ownerAddGallery, ownerDeleteGallery } from "../../services/api";
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
        name: c.name || "", address: c.address || "", description: c.description || "",
        capacity: c.capacity || 0, half_day_price: c.half_day_price || 0,
        full_day_price: c.full_day_price || 0, virtual_tour_url: c.virtual_tour_url || "",
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
        half_day_price: Number(form.half_day_price),
        full_day_price: Number(form.full_day_price),
        virtual_tour_url: form.virtual_tour_url || null,
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
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold text-slate-500">Gallery</div>
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
            <L label="Centre name" full><input className="input" value={form.name} onChange={set("name")} /></L>
            <L label="Address" full><input className="input" value={form.address} onChange={set("address")} /></L>
            <L label="Description" full><textarea className="input h-28 resize-none" value={form.description} onChange={set("description")} /></L>
            <L label="Virtual tour URL" full><input className="input" placeholder="https://…" value={form.virtual_tour_url} onChange={set("virtual_tour_url")} /></L>
          </div>
        </Card>

        <Card title="Capacity & pricing">
          <div className="space-y-4 p-5">
            <L label="Capacity (guests)"><input type="number" className="input" value={form.capacity} onChange={set("capacity")} /></L>
            <L label="Half-day price (৳)"><input type="number" className="input" value={form.half_day_price} onChange={set("half_day_price")} /></L>
            <L label="Full-day price (৳)"><input type="number" className="input" value={form.full_day_price} onChange={set("full_day_price")} /></L>
            <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> {busy ? "Saving…" : "Save changes"}</>}
            </button>
          </div>
        </Card>
      </form>
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
