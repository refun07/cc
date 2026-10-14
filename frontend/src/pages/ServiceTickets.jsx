import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Clock3, MessageSquare, Plus, Send, Ticket, X } from "lucide-react";
import { createServiceTicket, serviceTicketAction, serviceTicketDetails, serviceTicketOptions, serviceTickets } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";
import { toast } from "../store/toastStore";
import LanguageSwitcher from "../components/LanguageSwitcher";

const STATUS = { open: "Open", in_progress: "In progress", resolved: "Resolved", closed: "Closed" };
const ROLE = { caretaker: "Caretaker", area_admin: "Area admin", project_coordinator: "Project coordinator", waste_partner: "Waste partner", admin: "City admin" };
const HOME = { owner: "/owner", caretaker: "/caretaker", area_admin: "/area", project_coordinator: "/coordinator", waste_partner: "/partner", admin: "/admin" };
const STAMP = { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" };

export default function ServiceTickets() {
  const user = useAuthStore((state) => state.user);
  const { lang } = useT();
  const [list, setList] = useState(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [options, setOptions] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ centre_id: "", assigned_to: "", subject: "", description: "" });
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const listScrollY = useRef(0);
  const isCaretaker = user?.role === "caretaker";
  const canCreate = ["owner", "caretaker", "admin"].includes(user?.role);

  const reload = () => serviceTickets({ page, ...(status ? { status } : {}) })
    .then((result) => { setList(result); setError(""); })
    .catch((err) => setError(err.response?.data?.message || "Could not load service tickets."));

  useEffect(() => {
    if (user) reload();
    // List refreshes when the selected status or page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, page, status]);

  const openTicket = async (id) => {
    try {
      const ticket = await serviceTicketDetails(id);
      listScrollY.current = window.scrollY;
      setSelected(ticket);
      setActionMessage("");
      if (window.innerWidth < 1024) requestAnimationFrame(() => window.scrollTo(0, 0));
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not open ticket.");
    }
  };

  const openCreate = async () => {
    try {
      const result = await serviceTicketOptions();
      setOptions(result);
      if (isCaretaker && result.centres?.[0]) setForm((current) => ({ ...current, centre_id: String(result.centres[0].id), assigned_to: "" }));
      setCreating(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not load ticket options.");
    }
  };

  const create = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      const ticket = await createServiceTicket({ ...form, centre_id: Number(form.centre_id), ...(isCaretaker ? { assigned_to: null } : { assigned_to: Number(form.assigned_to) }) });
      setCreating(false);
      setForm({ centre_id: "", assigned_to: "", subject: "", description: "" });
      listScrollY.current = window.scrollY;
      setSelected(ticket);
      if (window.innerWidth < 1024) requestAnimationFrame(() => window.scrollTo(0, 0));
      reload();
      toast.success("Service ticket created.");
    } catch (err) {
      toast.error(err.response?.data?.message || Object.values(err.response?.data?.errors || {})[0]?.[0] || "Could not create ticket.");
    } finally {
      setBusy(false);
    }
  };

  const act = async (action) => {
    setBusy(true);
    try {
      const ticket = await serviceTicketAction(selected.id, { action, message: actionMessage.trim() || undefined });
      setSelected(ticket);
      setActionMessage("");
      reload();
      toast.success("Ticket updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not update ticket.");
    } finally {
      setBusy(false);
    }
  };

  const closeDetails = () => {
    setSelected(null);
    if (window.innerWidth < 1024) requestAnimationFrame(() => window.scrollTo(0, listScrollY.current));
  };

  if (!user) return <main className="mx-auto max-w-3xl p-6"><p>Please sign in to view service tickets.</p><Link to="/" className="text-brand-700">Go home</Link></main>;

  const recipients = options?.recipients?.[form.centre_id] || [];
  const isAssignee = selected?.assigned_to === user.id;
  const isOwner = user.role === "owner" || user.role === "caretaker";
  const isAdmin = user.role === "admin";

  return <div className="mx-auto max-w-7xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to={HOME[user.role] || "/"} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" /> Dashboard</Link><h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><Ticket className="h-6 w-6 text-brand-600" /> Service requests</h1></div>
      <div className="flex items-center gap-2">{["caretaker", "area_admin", "project_coordinator", "waste_partner"].includes(user.role) && <LanguageSwitcher tone="dark" />}{canCreate && <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New ticket</button>}</div>
    </div>
    {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className={`${selected ? "hidden" : ""} lg:hidden`}>
      <label className="block text-sm font-semibold text-slate-700">Ticket status
        <select className="input mt-1" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
          {[['', 'All'], ...Object.entries(STATUS)].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
    </div>
    <div className="hidden gap-1 border-b border-slate-200 lg:flex" role="tablist" aria-label="Ticket status">
      {[["", "All"], ...Object.entries(STATUS)].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={status === value} onClick={() => { setStatus(value); setPage(1); }} className={`border-b-2 px-3 py-2 text-sm font-semibold ${status === value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-900"}`}>{label}</button>)}
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <section className={`${selected ? "hidden lg:block" : ""} min-w-0 border-y border-slate-200 bg-white`} aria-label="Ticket list">
        {list?.data?.map((ticket) => <button key={ticket.id} type="button" onClick={() => openTicket(ticket.id)} className={`flex min-h-16 w-full items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 text-left hover:bg-slate-50 ${selected?.id === ticket.id ? "bg-emerald-50/70" : ""}`}>
          <span className="min-w-0"><span className="block break-words text-sm font-bold text-slate-900">#{ticket.id} · {ticket.subject}</span><span className="mt-1 block break-words text-xs text-slate-500">{ticket.centre?.name} · {ticket.assignee?.name} ({ROLE[ticket.assignee?.role] || ticket.assignee?.role})</span><span className="mt-1 block text-xs text-slate-400">{dateTime(ticket.created_at, lang)}</span></span>
          <span className={`shrink-0 text-xs font-semibold ${ticket.status === "open" ? "text-amber-700" : ticket.status === "in_progress" ? "text-blue-700" : "text-brand-700"}`}>{STATUS[ticket.status]}</span>
        </button>)}
        {list && list.data.length === 0 && <p className="p-6 text-sm text-slate-500">No service tickets in this view.</p>}
        {!list && <p className="p-6 text-sm text-slate-500">Loading tickets...</p>}
        {list && list.last_page > 1 && <div className="flex items-center justify-end gap-3 p-3 text-sm"><button disabled={page === 1} onClick={() => setPage(page - 1)} className="min-h-11 rounded border px-3 disabled:opacity-40">Previous</button><span>{page} / {list.last_page}</span><button disabled={page >= list.last_page} onClick={() => setPage(page + 1)} className="min-h-11 rounded border px-3 disabled:opacity-40">Next</button></div>}
      </section>
      <section className={`${selected ? "" : "hidden lg:block"} min-w-0 border-y border-slate-200 bg-white p-4 sm:p-5`} aria-label="Ticket details">
        {!selected ? <p className="text-sm text-slate-500">Select a ticket to see its history and actions.</p> : <>
          <button type="button" onClick={closeDetails} className="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 lg:hidden"><ArrowLeft className="h-4 w-4" /> Back to tickets</button>
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold text-slate-500">Ticket #{selected.id}</p><h2 className="mt-1 break-words text-lg font-bold text-slate-900">{selected.subject}</h2></div><button type="button" onClick={closeDetails} aria-label="Close ticket details" className="hidden h-11 w-11 shrink-0 place-items-center text-slate-500 lg:grid"><X className="h-5 w-5" /></button></div>
          <p className="mt-3 text-sm text-slate-700">{selected.description}</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-200 py-4 text-xs [&_dd]:break-words"><div><dt className="text-slate-500">Centre</dt><dd className="font-semibold">{selected.centre?.name}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="font-semibold">{STATUS[selected.status]}</dd></div><div><dt className="text-slate-500">Assigned to</dt><dd className="font-semibold">{selected.assignee?.name}</dd></div><div><dt className="text-slate-500">Opened</dt><dd className="font-semibold">{dateTime(selected.created_at, lang)}</dd></div><div><dt className="text-slate-500">First response</dt><dd className="font-semibold">{dateTime(selected.first_responded_at, lang)}</dd></div><div><dt className="text-slate-500">Resolved</dt><dd className="font-semibold">{dateTime(selected.resolved_at, lang)}</dd></div></dl>
          <h3 className="mt-5 flex items-center gap-2 text-sm font-bold text-slate-900"><Clock3 className="h-4 w-4" /> Activity</h3>
          <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">{selected.actions?.map((entry) => <li key={entry.id} className="text-sm"><span className="font-semibold text-slate-900">{entry.actor?.name}</span> <span className="text-slate-600">{entry.action.replaceAll("_", " ")}</span><span className="block text-xs text-slate-400">{dateTime(entry.created_at, lang)}</span>{entry.message && <p className="mt-1 whitespace-pre-wrap text-slate-700">{entry.message}</p>}</li>)}</ol>
          {selected.status !== "closed" && <div className="mt-5 border-t border-slate-200 pt-4"><label className="block text-xs font-semibold text-slate-600">Update / action note<textarea value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} maxLength={5000} rows={3} className="input mt-1 w-full" placeholder="What was done?" /></label><div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={busy || !actionMessage.trim()} onClick={() => act("comment")} className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40"><MessageSquare className="h-4 w-4" /> Add update</button>{(isAssignee || isAdmin) && selected.status === "open" && <button type="button" disabled={busy} onClick={() => act("acknowledge")} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-40"><Send className="h-4 w-4" /> Start work</button>}{(isAssignee || isAdmin) && selected.status === "in_progress" && <button type="button" disabled={busy || !actionMessage.trim()} onClick={() => act("resolve")} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-40"><CheckCircle2 className="h-4 w-4" /> Resolve</button>}{(isOwner || isAdmin) && selected.status === "resolved" && <button type="button" disabled={busy} onClick={() => act("close")} className="min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40">Close ticket</button>}{(isOwner || isAdmin) && selected.status === "resolved" && <button type="button" disabled={busy || !actionMessage.trim()} onClick={() => act("reopen")} className="min-h-10 rounded-lg border px-3 text-sm font-semibold disabled:opacity-40">Reopen</button>}</div></div>}
          {(isOwner || isAdmin) && selected.status === "closed" && <div className="mt-4"><label className="block text-xs font-semibold text-slate-600">Why reopen?<textarea value={actionMessage} onChange={(event) => setActionMessage(event.target.value)} rows={2} className="input mt-1 w-full" /></label><button type="button" disabled={busy || !actionMessage.trim()} onClick={() => act("reopen")} className="mt-2 rounded-lg border px-3 py-2 text-sm font-semibold disabled:opacity-40">Reopen ticket</button></div>}
        </>}
      </section>
    </div>
    {creating && <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreating(false); }}><form onSubmit={create} role="dialog" aria-modal="true" aria-label="New service ticket" className="max-h-[95dvh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl sm:p-6"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">New service ticket</h2><button type="button" onClick={() => setCreating(false)} aria-label="Close" className="p-1"><X className="h-5 w-5" /></button></div><div className="mt-4 space-y-4"><label className="block text-sm font-semibold">Centre<select required className="input mt-1 w-full" value={form.centre_id} onChange={(event) => setForm((current) => ({ ...current, centre_id: event.target.value, assigned_to: "" }))}><option value="">Select centre</option>{options?.centres?.map((centre) => <option key={centre.id} value={centre.id}>{centre.name}</option>)}</select></label>{isCaretaker ? <p className="text-sm text-slate-600">Sent to the assigned Area Admin and City Admin.</p> : <><label className="block text-sm font-semibold">Send to<select required className="input mt-1 w-full" disabled={!form.centre_id} value={form.assigned_to} onChange={(event) => setForm((current) => ({ ...current, assigned_to: event.target.value }))}><option value="">Select recipient</option>{recipients.map((recipient) => <option key={recipient.id} value={recipient.id}>{ROLE[recipient.role]} · {recipient.name}</option>)}</select></label>{form.centre_id && recipients.length === 0 && <p className="text-xs text-amber-700">No assigned area admin, coordinator or waste partner is available for this centre.</p>}</>}<label className="block text-sm font-semibold">Subject<input required minLength={3} maxLength={150} className="input mt-1 w-full" value={form.subject} onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))} /></label><label className="block text-sm font-semibold">What needs attention?<textarea required minLength={5} maxLength={5000} rows={4} className="input mt-1 w-full" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} /></label></div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setCreating(false)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={busy || !form.centre_id || (!isCaretaker && !form.assigned_to)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{busy ? "Submitting..." : "Submit ticket"}</button></div></form></div>}
  </div>;
}

function dateTime(value, lang) {
  return value ? new Date(value).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", STAMP) : "—";
}
