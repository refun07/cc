import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, X, StickyNote, Search, CalendarCheck, Clock, CheckCircle2, Wallet, Plus, Eye, Phone, Users, CalendarDays } from "lucide-react";
import { ownerBookings, ownerBookingAction, ownerBookingNote } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, Card, Badge, Loading, StatCard } from "../admin/ui";
import NoteModal from "../../components/NoteModal";
import OwnerBookingModal from "./OwnerBookingModal";
import OwnerBookingDetailModal from "./OwnerBookingDetailModal";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const FILTERS = ["", "pending_review", "payment_pending", "confirmed", "completed", "cancelled"];

export default function OwnerBookings() {
  const [all, setAll] = useState(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
  const [detailFor, setDetailFor] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => { setAll(null); ownerBookings({}).then(setAll).catch(() => setAll([])); };
  useEffect(() => { load(); }, []);

  const replace = (updated) => setAll((l) => l.map((x) => (x.id === updated.id ? updated : x)));

  const summary = useMemo(() => {
    const l = all || [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: l.length,
      pending: l.filter((b) => b.status === "pending_review").length,
      confirmed: l.filter((b) => b.status === "confirmed").length,
      upcoming: l.filter((b) => ["confirmed", "payment_pending"].includes(b.status) && b.event_date >= today).length,
      revenue: l.reduce((a, b) => a + Number(b.paid_amount || 0), 0),
    };
  }, [all]);

  const rows = useMemo(() => {
    let l = all || [];
    if (status) l = l.filter((b) => b.status === status);
    const q = query.trim().toLowerCase();
    if (q) l = l.filter((b) => b.booking_no.toLowerCase().includes(q) || b.customer_name.toLowerCase().includes(q) || (b.customer_phone || "").includes(q));
    return l;
  }, [all, status, query]);

  const act = async (b, action) => {
    if (action === "cancel" && !(await askConfirm({ title: "Cancel booking?", message: "A refund will be issued per the cancellation policy.", confirmText: "Cancel booking", danger: true }))) return;
    setBusy(b.booking_no);
    try { replace(await ownerBookingAction(b.booking_no, action)); toast.success("Booking updated."); }
    catch (e) { toast.error(e.response?.data?.message || "Action failed."); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageHead title="Bookings" subtitle="Every event booking for your centre — review, confirm, and track.">
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> New booking
        </button>
      </PageHead>

      {/* Stats */}
      <div className="mb-5 grid grid-cols-2 gap-2 sm:gap-4 xl:grid-cols-5">
        <StatCard icon={CalendarCheck} label="Total bookings" value={summary.total} accent="blue" />
        <StatCard icon={Clock} label="Pending review" value={summary.pending} accent="amber" />
        <StatCard icon={CheckCircle2} label="Confirmed" value={summary.confirmed} accent="emerald" />
        <StatCard icon={CalendarCheck} label="Upcoming" value={summary.upcoming} accent="violet" />
        <div className="col-span-2 xl:col-span-1"><StatCard icon={Wallet} label="Collected" value={summary.revenue} money accent="brand" /></div>
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search booking no, name or phone…" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Booking status" className="input w-full sm:hidden">
          {FILTERS.map((f) => <option key={f || "all"} value={f}>{f ? f.replaceAll("_", " ") : "All statuses"}</option>)}
        </select>
        <div className="hidden flex-wrap gap-2 sm:flex">
          {FILTERS.map((f) => (
            <button key={f || "all"} onClick={() => setStatus(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${status === f ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {f ? f.replaceAll("_", " ") : "All"}
            </button>
          ))}
        </div>
      </div>

      {!all ? (
        <Card><Loading /></Card>
      ) : rows.length === 0 ? (
        <Card><div className="p-10 text-center text-sm text-slate-400">No bookings found.</div></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => {
            const canConfirm = ["pending_review", "payment_pending"].includes(b.status);
            const todayDhaka = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
            const finalDate = (b.booking_dates || []).reduce((latest, slot) => slot.date > latest ? slot.date : latest, b.event_date);
            const canComplete = ["confirmed", "paid"].includes(b.status)
              && !b.caretaker_assigned && Number(b.due_amount || 0) <= 0 && finalDate <= todayDhaka;
            const canCancel = !["cancelled", "completed", "refunded"].includes(b.status);
            const mixed = new Set((b.booking_dates || []).map((s) => s.session_type)).size > 1;
            return (
              <div key={b.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                {/* header */}
                <button onClick={() => setDetailFor(b)} className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 text-left">
                  <span className="font-mono text-xs font-semibold text-brand-700 group-hover:underline">{b.booking_no}</span>
                  <Badge status={b.status} />
                </button>

                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-900">{b.customer_name}</div>
                      <div className="inline-flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" /> {b.customer_phone}</div>
                    </div>
                    {b.event_type && <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">{b.event_type}</span>}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-slate-400" /> {b.event_date}{b.date_count > 1 ? ` +${b.date_count - 1}` : ""}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {mixed ? "Mixed" : sessionLabel(b.session_type)}</span>
                    <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" /> {b.guest_count}</span>
                  </div>

                  <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                    <div>
                      <div className="text-lg font-extrabold tabular-nums text-slate-900">{taka(b.total_amount)}</div>
                      {b.due_amount > 0
                        ? <div className="text-xs font-semibold text-amber-600"><span>Paid</span> {taka(b.paid_amount)} · <span>Due</span> {taka(b.due_amount)}</div>
                        : <div className="text-xs font-semibold text-emerald-600">Fully paid</div>}
                    </div>
                    <button onClick={() => setNoteFor(b)} title={b.notes || "Add note"}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${b.notes ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                      <StickyNote className="h-3.5 w-3.5" /> {b.notes ? "View" : "Note"}
                    </button>
                  </div>

                  {/* actions */}
                  {b.caretaker_assigned && ["confirmed", "paid"].includes(b.status) && finalDate <= todayDhaka && <p className="text-xs font-semibold text-blue-700">Caretaker will confirm event completion.</p>}
                  <div className="flex flex-wrap gap-1.5">
                    <Action onClick={() => setDetailFor(b)} cls="flex-1 justify-center bg-slate-100 text-slate-700 hover:bg-slate-200" icon={Eye}>Details</Action>
                    {canConfirm && <Action busy={busy === b.booking_no} onClick={() => act(b, "confirm")} cls="flex-1 justify-center bg-emerald-50 text-emerald-700 hover:bg-emerald-100" icon={Check}>Confirm</Action>}
                    {canComplete && <Action busy={busy === b.booking_no} onClick={() => act(b, "complete")} cls="flex-1 justify-center bg-blue-50 text-blue-700 hover:bg-blue-100" icon={CheckCheck}>Complete</Action>}
                    {canCancel && <Action busy={busy === b.booking_no} onClick={() => act(b, "cancel")} cls="flex-1 justify-center bg-rose-50 text-rose-700 hover:bg-rose-100" icon={X}>Cancel</Action>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NoteModal
        open={!!noteFor}
        title={`Note · ${noteFor?.booking_no || ""}`}
        initial={noteFor?.notes || ""}
        onSave={(notes) => ownerBookingNote(noteFor.booking_no, notes)}
        onSaved={(notes) => setAll((list) => list.map((x) => (x.id === noteFor.id ? { ...x, notes } : x)))}
        onClose={() => setNoteFor(null)}
      />
      <OwnerBookingModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
      {detailFor && (
        <OwnerBookingDetailModal
          booking={detailFor}
          onClose={() => setDetailFor(null)}
          onUpdated={(updated) => { replace(updated); setDetailFor(updated); }}
        />
      )}
    </div>
  );
}

function Action({ onClick, busy, cls, icon: Icon, children }) {
  return (
    <button disabled={busy} onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}
