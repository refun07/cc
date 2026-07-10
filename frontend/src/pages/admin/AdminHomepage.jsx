import { useEffect, useState } from "react";
import { Save, RotateCcw, Plus, Trash2, ExternalLink } from "lucide-react";
import { adminHomepage, adminUpdateHomepage, adminResetHomepage } from "../../services/api";
import { PageHead, Card, Loading } from "./ui";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const ICON_CHOICES = ["ShieldCheck", "CalendarDays", "UtensilsCrossed", "Wallet", "Boxes", "Recycle", "MapPin", "Leaf", "TrendingUp", "Users", "Star", "CheckCircle2"];

export default function AdminHomepage() {
  const [content, setContent] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { adminHomepage().then(setContent).catch(() => setContent(false)); }, []);

  if (content === false) return <Card><div className="p-10 text-center text-sm text-slate-400">Could not load home page content.</div></Card>;
  if (!content) return <Loading rows={6} />;

  const setHero = (key) => (e) => setContent((c) => ({ ...c, hero: { ...c.hero, [key]: e.target.value } }));
  const setField = (key) => (e) => setContent((c) => ({ ...c, [key]: e.target.value }));

  const setList = (key, index, field, value) =>
    setContent((c) => ({ ...c, [key]: c[key].map((row, i) => (i === index ? { ...row, [field]: value } : row)) }));
  const addRow = (key, blank) => setContent((c) => ({ ...c, [key]: [...(c[key] || []), blank] }));
  const removeRow = (key, index) => setContent((c) => ({ ...c, [key]: c[key].filter((_, i) => i !== index) }));

  const setBadge = (index, value) =>
    setContent((c) => ({ ...c, hero: { ...c.hero, trust_badges: c.hero.trust_badges.map((b, i) => (i === index ? value : b)) } }));
  const removeBadge = (index) =>
    setContent((c) => ({ ...c, hero: { ...c.hero, trust_badges: c.hero.trust_badges.filter((_, i) => i !== index) } }));
  const addBadge = () =>
    setContent((c) => ({ ...c, hero: { ...c.hero, trust_badges: [...(c.hero.trust_badges || []), "New badge"] } }));

  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const saved = await adminUpdateHomepage({
        ...content,
        stats: (content.stats || []).map((s) => ({ ...s, value: Number(s.value) || 0 })),
      });
      setContent(saved);
      toast.success("Home page updated. Visitors see it immediately.");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save the home page.");
    } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!(await askConfirm({ title: "Restore defaults?", message: "All home page copy will be reset to the shipped defaults.", confirmText: "Restore", danger: true }))) return;
    try { setContent(await adminResetHomepage()); toast.success("Home page restored to defaults."); }
    catch { toast.error("Could not reset the home page."); }
  };

  return (
    <div>
      <PageHead title="Home page content" subtitle="Edit the public landing page — hero, stats, feature cards and steps. Changes go live instantly.">
        <div className="flex gap-2">
          <a href="/" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><ExternalLink className="h-4 w-4" />View site</a>
          <button onClick={reset} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RotateCcw className="h-4 w-4" />Restore defaults</button>
        </div>
      </PageHead>

      <form onSubmit={save} className="space-y-6">
        <Card title="Hero section">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <F label="Badge" full><input className="input" value={content.hero.badge || ""} onChange={setHero("badge")} /></F>
            <F label="Headline (plain)"><input className="input" value={content.hero.title_lead || ""} onChange={setHero("title_lead")} /></F>
            <F label="Headline (highlighted)"><input className="input" value={content.hero.title_highlight || ""} onChange={setHero("title_highlight")} /></F>
            <F label="Subtitle" full><textarea rows="3" className="input resize-none" value={content.hero.subtitle || ""} onChange={setHero("subtitle")} /></F>
            <F label="Search placeholder" full><input className="input" value={content.hero.search_placeholder || ""} onChange={setHero("search_placeholder")} /></F>
            <div className="sm:col-span-2">
              <span className="text-xs font-semibold text-slate-500">Trust badges (max 4)</span>
              <div className="mt-1 space-y-2">
                {(content.hero.trust_badges || []).map((badge, i) => (
                  <div key={i} className="flex gap-2">
                    <input className="input flex-1" value={badge} onChange={(e) => setBadge(i, e.target.value)} />
                    <IconBtn onClick={() => removeBadge(i)} />
                  </div>
                ))}
                {(content.hero.trust_badges || []).length < 4 && <AddBtn onClick={addBadge}>Add badge</AddBtn>}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Stat strip">
          <div className="space-y-3 p-5">
            {(content.stats || []).map((s, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_110px_90px_1fr_44px]">
                <F label="Label"><input className="input" value={s.label} onChange={(e) => setList("stats", i, "label", e.target.value)} /></F>
                <F label="Value"><input type="number" className="input" value={s.value} onChange={(e) => setList("stats", i, "value", e.target.value)} /></F>
                <F label="Suffix"><input className="input" value={s.suffix || ""} onChange={(e) => setList("stats", i, "suffix", e.target.value)} placeholder="+" /></F>
                <F label="Icon"><IconSelect value={s.icon} onChange={(v) => setList("stats", i, "icon", v)} /></F>
                <div className="flex items-end"><IconBtn onClick={() => removeRow("stats", i)} /></div>
              </div>
            ))}
            {(content.stats || []).length < 6 && <AddBtn onClick={() => addRow("stats", { label: "New stat", value: 0, suffix: "", icon: "Star" })}>Add stat</AddBtn>}
          </div>
        </Card>

        <Card title="Feature cards">
          <div className="space-y-3 p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <F label="Section heading"><input className="input" value={content.features_heading || ""} onChange={setField("features_heading")} /></F>
              <F label="Section subheading"><input className="input" value={content.features_subheading || ""} onChange={setField("features_subheading")} /></F>
            </div>
            {(content.features || []).map((f, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_2fr_44px]">
                <F label="Icon"><IconSelect value={f.icon} onChange={(v) => setList("features", i, "icon", v)} /></F>
                <F label="Title"><input className="input" value={f.title} onChange={(e) => setList("features", i, "title", e.target.value)} /></F>
                <F label="Description"><input className="input" value={f.description || ""} onChange={(e) => setList("features", i, "description", e.target.value)} /></F>
                <div className="flex items-end"><IconBtn onClick={() => removeRow("features", i)} /></div>
              </div>
            ))}
            {(content.features || []).length < 9 && <AddBtn onClick={() => addRow("features", { icon: "CheckCircle2", title: "New feature", description: "" })}>Add feature</AddBtn>}
          </div>
        </Card>

        <Card title="How it works">
          <div className="space-y-3 p-5">
            <F label="Section heading"><input className="input" value={content.steps_heading || ""} onChange={setField("steps_heading")} /></F>
            {(content.steps || []).map((s, i) => (
              <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[40px_1fr_2fr_44px]">
                <div className="mt-6 grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">{i + 1}</div>
                <F label="Title"><input className="input" value={s.title} onChange={(e) => setList("steps", i, "title", e.target.value)} /></F>
                <F label="Description"><input className="input" value={s.description || ""} onChange={(e) => setList("steps", i, "description", e.target.value)} /></F>
                <div className="flex items-end"><IconBtn onClick={() => removeRow("steps", i)} /></div>
              </div>
            ))}
            {(content.steps || []).length < 6 && <AddBtn onClick={() => addRow("steps", { title: "New step", description: "" })}>Add step</AddBtn>}
          </div>
        </Card>

        <div className="sticky bottom-4 flex justify-end">
          <button disabled={busy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-600 px-6 font-semibold text-white shadow-lg hover:bg-brand-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {busy ? "Saving…" : "Save home page"}
          </button>
        </div>
      </form>
    </div>
  );
}

function F({ label, children, full }) {
  return <label className={`block ${full ? "sm:col-span-2" : ""}`}><span className="text-xs font-semibold text-slate-500">{label}</span><div className="mt-1">{children}</div></label>;
}
function IconSelect({ value, onChange }) {
  return <select className="input" value={value || "CheckCircle2"} onChange={(e) => onChange(e.target.value)}>{ICON_CHOICES.map((n) => <option key={n} value={n}>{n}</option>)}</select>;
}
function IconBtn({ onClick }) {
  return <button type="button" onClick={onClick} className="grid h-11 w-11 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>;
}
function AddBtn({ onClick, children }) {
  return <button type="button" onClick={onClick} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100"><Plus className="h-4 w-4" />{children}</button>;
}
