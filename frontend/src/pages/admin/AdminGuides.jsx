import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDown, ArrowUp, ExternalLink, Plus, Save, Trash2, Video } from "lucide-react";
import { adminGuides, adminSaveGuides } from "../../services/api";
import { youtubeVideoId } from "../../lib/youtube";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";
import { PageHead, Loading } from "./ui";
import { useT } from "../../store/langStore";

export default function AdminGuides() {
  const { lang } = useT();
  const [guides, setGuides] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    adminGuides().then((items) => { setGuides(items); setSelected(items[0]?.slug || null); })
      .catch(() => { setGuides([]); toast.error("Could not load booking guides."); });
  }, []);

  if (!guides) return <Loading rows={5} />;

  const active = guides.find((guide) => guide.slug === selected);
  const update = (key, value) => setGuides((current) => current.map((guide) => guide.slug === selected ? { ...guide, [key]: value } : guide));
  const add = () => {
    const slug = `guide-${Date.now().toString(36)}`;
    setGuides((current) => [...current, { slug, title: "", title_bn: "", summary: "", summary_bn: "", body: "", body_bn: "", video_url: "", published: false }]);
    setSelected(slug);
  };
  const move = (direction) => {
    const index = guides.findIndex((guide) => guide.slug === selected);
    const target = index + direction;
    if (target < 0 || target >= guides.length) return;
    setGuides((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };
  const remove = async () => {
    if (!(await askConfirm({ title: "Delete guide?", message: "This guide will disappear from the public page after saving.", confirmText: "Delete", danger: true }))) return;
    setGuides((current) => current.filter((guide) => guide.slug !== selected));
    setSelected(guides.find((guide) => guide.slug !== selected)?.slug || null);
  };
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await adminSaveGuides(guides.map((guide) => ({ ...guide, video_url: guide.video_url || null })));
      setGuides(saved);
      toast.success("Booking guides saved.");
    } catch (error) {
      const message = Object.values(error.response?.data?.errors || {})[0]?.[0];
      toast.error(message || error.response?.data?.message || "Could not save guides.");
    } finally { setBusy(false); }
  };

  return <div>
    <PageHead title="Booking guides" subtitle="Manage the public How it works articles and videos.">
      <Link to="/how-it-works" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="h-4 w-4" />View guides</Link>
    </PageHead>
    <form onSubmit={save} className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <div className="self-start border-r border-slate-200 pr-4">
        <div className="flex items-center justify-between gap-2 pb-3"><h2 className="text-sm font-bold text-slate-900">Articles ({guides.length})</h2><button type="button" onClick={add} disabled={guides.length >= 20} title="Add guide" className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"><Plus className="h-4 w-4" /></button></div>
        <div className="space-y-1">
          {guides.map((guide, index) => <button key={guide.slug} type="button" onClick={() => setSelected(guide.slug)} className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${selected === guide.slug ? "bg-brand-50 text-brand-800" : "text-slate-700 hover:bg-white"}`}>
            <span className="mt-0.5 shrink-0 text-xs text-slate-400">{String(index + 1).padStart(2, "0")}</span>
            <span className="min-w-0 flex-1 break-words font-medium">{(lang === "bn" ? guide.title_bn || guide.title : guide.title) || "Untitled guide"}</span>
            {!guide.published && <span className="shrink-0 text-[10px] text-amber-700">Draft</span>}
          </button>)}
        </div>
      </div>
      <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-5">
        {active ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div><h2 className="text-base font-bold text-slate-900">{(lang === "bn" ? active.title_bn || active.title : active.title) || "New guide"}</h2><p className="mt-0.5 text-xs text-slate-500">/how-it-works/{active.slug}</p></div>
            <div className="flex gap-1">
              <IconButton onClick={() => move(-1)} label="Move up"><ArrowUp className="h-4 w-4" /></IconButton>
              <IconButton onClick={() => move(1)} label="Move down"><ArrowDown className="h-4 w-4" /></IconButton>
              <IconButton onClick={remove} label="Delete guide" danger><Trash2 className="h-4 w-4" /></IconButton>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Title (English)"><input required maxLength={160} className="input" value={active.title} onChange={(event) => update("title", event.target.value)} /></Field>
            <Field label="Title (Bangla)"><input required={active.published} maxLength={160} className="input" value={active.title_bn || ""} onChange={(event) => update("title_bn", event.target.value)} /></Field>
            <Field label="Summary (English)"><textarea required maxLength={300} rows={3} className="input resize-y" value={active.summary} onChange={(event) => update("summary", event.target.value)} /></Field>
            <Field label="Summary (Bangla)"><textarea required={active.published} maxLength={300} rows={3} className="input resize-y" value={active.summary_bn || ""} onChange={(event) => update("summary_bn", event.target.value)} /></Field>
            <Field label="Article (English)"><textarea required maxLength={12000} rows={12} className="input resize-y leading-6" value={active.body} onChange={(event) => update("body", event.target.value)} /></Field>
            <Field label="Article (Bangla)"><textarea required={active.published} maxLength={12000} rows={12} className="input resize-y leading-6" value={active.body_bn || ""} onChange={(event) => update("body_bn", event.target.value)} /></Field>
            <Field label="YouTube video URL" full><div className="flex items-center gap-2"><Video className="h-4 w-4 shrink-0 text-slate-500" /><input type="url" maxLength={500} placeholder="https://www.youtube.com/watch?v=..." className="input" value={active.video_url || ""} onChange={(event) => update("video_url", event.target.value)} /></div>{active.video_url && !youtubeVideoId(active.video_url) && <span className="mt-1 block text-xs text-rose-600">Enter a valid HTTPS YouTube video URL.</span>}</Field>
          </div>
          <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={Boolean(active.published)} onChange={(event) => update("published", event.target.checked)} className="h-4 w-4 accent-emerald-600" />Published</label>
        </> : <p className="py-12 text-center text-sm text-slate-500">Add a guide to get started.</p>}
      </div>
      <div className="sticky bottom-4 flex justify-end lg:col-start-2">
        <button type="submit" disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white shadow-md hover:bg-brand-700 disabled:opacity-50"><Save className="h-4 w-4" />{busy ? "Saving…" : "Save guides"}</button>
      </div>
    </form>
  </div>;
}

function Field({ label, children, full }) {
  return <label className={`block text-xs font-semibold text-slate-600 ${full ? "sm:col-span-2" : ""}`}><span>{label}</span><div className="mt-1">{children}</div></label>;
}

function IconButton({ onClick, label, danger, children }) {
  return <button type="button" onClick={onClick} title={label} aria-label={label} className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-slate-100 ${danger ? "text-rose-600" : "text-slate-600"}`}>{children}</button>;
}
