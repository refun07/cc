import { useCallback, useEffect, useState } from "react";
import {
  CalendarClock, CircleDollarSign, ContactRound, Mail, MessageCircle,
  Phone, Plus, Search, Send, Sparkles, UserRound, Users, X,
} from "lucide-react";
import {
  ownerCreateCrmActivity, ownerCreateCrmContact, ownerCrm, ownerCrmContact,
  ownerUpdateCrmContact,
} from "../../services/api";
import { taka } from "../../lib/format";
import { Card, Loading, PageHead, StatCard } from "../admin/ui";
import { toast } from "../../store/toastStore";

const STAGES = ["", "new", "contacted", "qualified", "proposal", "won", "customer", "lost"];
const STAGE_STYLE = {
  new: "bg-blue-100 text-blue-700", contacted: "bg-cyan-100 text-cyan-700",
  qualified: "bg-violet-100 text-violet-700", proposal: "bg-amber-100 text-amber-800",
  won: "bg-emerald-100 text-emerald-700", customer: "bg-emerald-100 text-emerald-700",
  lost: "bg-rose-100 text-rose-700",
};
const ACTIVITY_ICONS = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: Users, note: ContactRound, follow_up: CalendarClock };

export default function OwnerCRM() {
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => ownerCrm({ q: query || undefined, stage: stage || undefined }).then((result) => {
    setData(result);
    setSelectedId((current) => result.data.some((contact) => contact.id === current) ? current : result.data[0]?.id || null);
  }).catch(() => setData({ data: [], summary: {} })), [query, stage]);

  useEffect(() => { const timer = setTimeout(load, 200); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    setDetail(null);
    ownerCrmContact(selectedId).then(setDetail).catch(() => setDetail(null));
  }, [selectedId]);

  const refreshContact = () => {
    load();
    if (selectedId) ownerCrmContact(selectedId).then(setDetail);
  };
  const summary = data?.summary || {};

  return <div>
    <PageHead title="Customer CRM" subtitle="Manage leads, customer relationships, follow-ups, and every booking conversation in one place.">
      <button onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"><Plus className="h-4 w-4" /> Add contact</button>
    </PageHead>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard icon={ContactRound} label="All contacts" value={summary.total || 0} accent="blue" />
      <StatCard icon={Sparkles} label="New leads" value={summary.new_leads || 0} accent="violet" />
      <StatCard icon={Users} label="Active pipeline" value={summary.active_pipeline || 0} accent="amber" />
      <StatCard icon={CalendarClock} label="Follow-ups due" value={summary.followups_due || 0} accent="rose" />
      <StatCard icon={CircleDollarSign} label="Customer value" value={summary.lifetime_value || 0} money accent="emerald" />
    </div>

    <div className="mt-5 flex flex-wrap gap-2">
      <div className="flex min-h-11 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3"><Search className="h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm outline-none" placeholder="Search name, phone or email…" /></div>
      <div className="flex max-w-full gap-2 overflow-x-auto pb-1">{STAGES.map((value) => <button key={value || "all"} onClick={() => setStage(value)} className={`min-h-11 whitespace-nowrap rounded-xl px-4 text-xs font-semibold capitalize ${stage === value ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-600"}`}>{value || "All stages"}</button>)}</div>
    </div>

    <div className="mt-5 grid min-h-[620px] gap-5 lg:grid-cols-[minmax(300px,.8fr)_minmax(0,1.5fr)]">
      <Card title={`Contacts · ${data?.data?.length || 0}`}>
        {!data ? <Loading /> : !data.data.length ? <div className="p-10 text-center text-sm text-slate-400">No contacts match this view.</div> : <div className="max-h-[680px] divide-y divide-slate-100 overflow-y-auto">
          {data.data.map((contact) => <button key={contact.id} onClick={() => setSelectedId(contact.id)} className={`w-full p-4 text-left transition hover:bg-slate-50 ${selectedId === contact.id ? "bg-brand-50/70" : ""}`}>
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold text-slate-900">{contact.name}</div><div className="mt-0.5 text-xs text-slate-500">{contact.phone}</div></div><StageBadge stage={contact.stage} /></div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{contact.booking_count} booking{contact.booking_count === 1 ? "" : "s"}</span><span className="font-semibold text-emerald-700">{taka(contact.lifetime_value)}</span></div>
            {contact.next_follow_up_at && <div className={`mt-2 flex items-center gap-1 text-xs font-medium ${new Date(contact.next_follow_up_at) <= new Date() ? "text-rose-600" : "text-amber-700"}`}><CalendarClock className="h-3.5 w-3.5" /> Follow up {formatDateTime(contact.next_follow_up_at)}</div>}
          </button>)}
        </div>}
      </Card>

      <Card>{!selectedId ? <div className="grid min-h-[500px] place-items-center p-10 text-center text-slate-400"><div><UserRound className="mx-auto h-10 w-10" /><p className="mt-2 text-sm">Select a contact to open Customer 360.</p></div></div> : !detail ? <Loading rows={8} /> : <ContactDetail detail={detail} onUpdated={refreshContact} />}</Card>
    </div>

    <ContactModal open={creating} onClose={() => setCreating(false)} onSaved={(contact) => { setCreating(false); load(); setSelectedId(contact.id); }} />
  </div>;
}

function ContactDetail({ detail, onUpdated }) {
  const { data: contact, bookings } = detail;
  const [activity, setActivity] = useState({ type: "call", subject: "", details: "", next_follow_up_at: "" });
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  const updateStage = async (stage) => {
    try { await ownerUpdateCrmContact(contact.id, { ...contact, stage, tags: contact.tags || [] }); toast.success("Pipeline stage updated."); onUpdated(); }
    catch (error) { toast.error(apiError(error)); }
  };
  const logActivity = async (event) => {
    event.preventDefault(); setBusy(true);
    try { await ownerCreateCrmActivity(contact.id, { ...activity, next_follow_up_at: activity.next_follow_up_at || null }); toast.success("Activity logged."); setActivity({ type: "call", subject: "", details: "", next_follow_up_at: "" }); onUpdated(); }
    catch (error) { toast.error(apiError(error)); }
    finally { setBusy(false); }
  };

  return <div>
    <div className="border-b border-slate-100 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="font-display text-2xl font-bold text-slate-900">{contact.name}</h2><StageBadge stage={contact.stage} /></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500"><span className="inline-flex items-center gap-1"><Phone className="h-4 w-4" />{contact.phone}</span>{contact.email && <span className="inline-flex items-center gap-1"><Mail className="h-4 w-4" />{contact.email}</span>}</div></div><button onClick={() => setEditing(true)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50">Edit contact</button></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><MiniStat label="Bookings" value={bookings.length} /><MiniStat label="Paid value" value={taka(bookings.reduce((sum, booking) => sum + Number(booking.paid_amount || 0), 0))} /><MiniStat label="Next follow-up" value={contact.next_follow_up_at ? formatDateTime(contact.next_follow_up_at) : "Not scheduled"} /></div>
      <label className="mt-4 block"><span className="text-xs font-semibold text-slate-500">Pipeline stage</span><select value={contact.stage} onChange={(event) => updateStage(event.target.value)} className="input mt-1 min-h-11 max-w-xs">{STAGES.filter(Boolean).map((stage) => <option key={stage} value={stage}>{stage[0].toUpperCase() + stage.slice(1)}</option>)}</select></label>
      {contact.notes && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><span className="font-semibold">Contact note:</span> {contact.notes}</div>}
    </div>

    <div className="grid lg:grid-cols-[1fr_.9fr]">
      <div className="border-b border-slate-100 p-5 lg:border-b-0 lg:border-r">
        <h3 className="font-semibold text-slate-900">Activity timeline</h3>
        <div className="mt-4 max-h-[420px] space-y-4 overflow-y-auto pr-2">{!contact.activities.length ? <p className="text-sm text-slate-400">No conversations logged yet.</p> : contact.activities.map((item) => { const Icon = ACTIVITY_ICONS[item.type] || ContactRound; return <div key={item.id} className="flex gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><Icon className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold capitalize text-slate-800">{item.subject || item.type.replaceAll("_", " ")}</span><span className="text-[11px] text-slate-400">{formatDateTime(item.occurred_at)}</span></div>{item.details && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{item.details}</p>}{item.next_follow_up_at && <p className="mt-1 text-xs font-medium text-amber-700">Next follow-up: {formatDateTime(item.next_follow_up_at)}</p>}</div></div>; })}</div>
      </div>
      <form onSubmit={logActivity} className="space-y-3 p-5"><h3 className="font-semibold text-slate-900">Log interaction</h3><Field label="Activity type"><select className="input min-h-11" value={activity.type} onChange={(event) => setActivity({ ...activity, type: event.target.value })}>{Object.keys(ACTIVITY_ICONS).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></Field><Field label="Subject"><input className="input min-h-11" value={activity.subject} onChange={(event) => setActivity({ ...activity, subject: event.target.value })} placeholder="What was discussed?" /></Field><Field label="Details"><textarea rows="4" className="input resize-none" value={activity.details} onChange={(event) => setActivity({ ...activity, details: event.target.value })} /></Field><Field label="Next follow-up"><input type="datetime-local" className="input min-h-11" value={activity.next_follow_up_at} onChange={(event) => setActivity({ ...activity, next_follow_up_at: event.target.value })} /></Field><button disabled={busy || (!activity.subject && !activity.details)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" />{busy ? "Saving…" : "Log activity"}</button></form>
    </div>

    {!!bookings.length && <div className="border-t border-slate-100 p-5"><h3 className="font-semibold text-slate-900">Booking history</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{bookings.map((booking) => <div key={booking.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><span className="font-mono text-xs text-slate-500">{booking.booking_no}</span><span className="text-xs font-semibold capitalize text-slate-600">{booking.status.replaceAll("_", " ")}</span></div><div className="mt-2 font-semibold text-slate-800">{booking.event_date}{booking.booking_dates?.length > 1 ? ` +${booking.booking_dates.length - 1} dates` : ""}</div><div className="mt-1 text-sm text-emerald-700">{taka(booking.paid_amount)} paid</div></div>)}</div></div>}
    <ContactModal open={editing} contact={contact} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); onUpdated(); }} />
  </div>;
}

function ContactModal({ open, contact, onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", stage: "new", source: "manual", tags: "", notes: "", next_follow_up_at: "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setForm(contact ? { ...contact, tags: (contact.tags || []).join(", "), next_follow_up_at: contact.next_follow_up_at?.slice(0, 16) || "" } : { name: "", phone: "", email: "", stage: "new", source: "manual", tags: "", notes: "", next_follow_up_at: "" }); }, [open, contact]);
  if (!open) return null;
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { const payload = { name: form.name, phone: form.phone, email: form.email || null, stage: form.stage, source: form.source || "manual", tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean), notes: form.notes || null, next_follow_up_at: form.next_follow_up_at || null }; const saved = contact ? await ownerUpdateCrmContact(contact.id, payload) : await ownerCreateCrmContact(payload); toast.success(contact ? "Contact updated." : "Contact created."); onSaved(saved); } catch (error) { toast.error(apiError(error)); } finally { setBusy(false); } };
  return <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form onSubmit={submit} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="font-display text-xl font-bold text-slate-900">{contact ? "Edit contact" : "Add CRM contact"}</h2><button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><Field label="Name"><input className="input min-h-11" value={form.name} onChange={set("name")} required /></Field><Field label="Phone"><input type="tel" className="input min-h-11" value={form.phone} onChange={set("phone")} required /></Field><Field label="Email"><input type="email" className="input min-h-11" value={form.email || ""} onChange={set("email")} /></Field><Field label="Stage"><select className="input min-h-11" value={form.stage} onChange={set("stage")}>{STAGES.filter(Boolean).map((stage) => <option key={stage}>{stage}</option>)}</select></Field><Field label="Source"><input className="input min-h-11" value={form.source} onChange={set("source")} placeholder="Website, referral, walk-in…" /></Field><Field label="Next follow-up"><input type="datetime-local" className="input min-h-11" value={form.next_follow_up_at || ""} onChange={set("next_follow_up_at")} /></Field><div className="sm:col-span-2"><Field label="Tags"><input className="input min-h-11" value={form.tags} onChange={set("tags")} placeholder="VIP, corporate, repeat" /></Field></div><div className="sm:col-span-2"><Field label="Notes"><textarea rows="3" className="input resize-none" value={form.notes || ""} onChange={set("notes")} /></Field></div></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button><button disabled={busy} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : "Save contact"}</button></div></form></div>;
}

function StageBadge({ stage }) { return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize ${STAGE_STYLE[stage] || "bg-slate-100 text-slate-600"}`}>{stage}</span>; }
function MiniStat({ label, value }) { return <div className="rounded-xl bg-slate-50 p-3"><div className="text-xs text-slate-400">{label}</div><div className="mt-1 text-sm font-bold text-slate-800">{value}</div></div>; }
function Field({ label, children }) { return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>; }
function formatDateTime(value) { return new Date(value).toLocaleString("en-BD", { dateStyle: "medium", timeStyle: "short" }); }
function apiError(error) { return error.response?.data?.errors ? Object.values(error.response.data.errors)[0][0] : error.response?.data?.message || "Request failed."; }
