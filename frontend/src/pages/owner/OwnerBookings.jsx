import { useEffect, useMemo, useState } from "react";
import { Check, CheckCheck, X, StickyNote, Search, CalendarCheck, Clock, CheckCircle2, Wallet, Plus } from "lucide-react";
import { ownerBookings, ownerBookingAction, ownerBookingNote } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading, StatCard } from "../admin/ui";
import NoteModal from "../../components/NoteModal";
import OwnerBookingModal from "./OwnerBookingModal";
import { toast } from "../../store/toastStore";
import { askConfirm } from "../../store/confirmStore";

const FILTERS = ["", "pending_review", "payment_pending", "confirmed", "completed", "cancelled"];

export default function OwnerBookings() {
  const [all, setAll] = useState(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(null);
  const [noteFor, setNoteFor] = useState(null);
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
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={CalendarCheck} label="Total bookings" value={summary.total} accent="blue" />
        <StatCard icon={Clock} label="Pending review" value={summary.pending} accent="amber" />
        <StatCard icon={CheckCircle2} label="Confirmed" value={summary.confirmed} accent="emerald" />
        <StatCard icon={CalendarCheck} label="Upcoming" value={summary.upcoming} accent="violet" />
        <StatCard icon={Wallet} label="Collected" value={summary.revenue} money accent="brand" />
      </div>

      {/* Search + filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search booking no, name or phone…" className="w-full bg-transparent text-sm outline-none" />
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button key={f || "all"} onClick={() => setStatus(f)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${status === f ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
              {f ? f.replaceAll("_", " ") : "All"}
            </button>
          ))}
        </div>
      </div>

      <Card>
        {!all ? <Loading /> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No bookings found.</div>
        ) : (
          <Table head={["Booking", "Customer", "Date", "Session", "Guests", "Total", "Paid", "Status", "Actions"]}>
            {rows.map((b) => {
              const canConfirm = ["pending_review", "payment_pending"].includes(b.status);
              const canComplete = b.status === "confirmed";
              const canCancel = !["cancelled", "completed", "refunded"].includes(b.status);
              return (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{b.booking_no}</td>
                  <td className="px-5 py-3"><div className="font-medium text-slate-800">{b.customer_name}</div><div className="text-xs text-slate-400">{b.customer_phone}</div></td>
                  <td className="px-5 py-3 tabular-nums text-slate-600"><div>{b.event_date}</div>{b.date_count > 1 && <div className="text-xs font-semibold text-brand-600">+{b.date_count - 1} more date{b.date_count > 2 ? "s" : ""}</div>}</td>
                  <td className="px-5 py-3 text-slate-600">{new Set((b.booking_dates || []).map((slot) => slot.session_type)).size > 1 ? "Mixed sessions" : sessionLabel(b.session_type)}</td>
                  <td className="px-5 py-3 tabular-nums">{b.guest_count}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{taka(b.total_amount)}</td>
                  <td className="px-5 py-3 tabular-nums text-emerald-700">{taka(b.paid_amount)}</td>
                  <td className="px-5 py-3"><Badge status={b.status} /></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      {canConfirm && <Action busy={busy === b.booking_no} onClick={() => act(b, "confirm")} cls="bg-emerald-50 text-emerald-700 hover:bg-emerald-100" icon={Check}>Confirm</Action>}
                      {canComplete && <Action busy={busy === b.booking_no} onClick={() => act(b, "complete")} cls="bg-blue-50 text-blue-700 hover:bg-blue-100" icon={CheckCheck}>Complete</Action>}
                      {canCancel && <Action busy={busy === b.booking_no} onClick={() => act(b, "cancel")} cls="bg-rose-50 text-rose-700 hover:bg-rose-100" icon={X}>Cancel</Action>}
                      <button onClick={() => setNoteFor(b)} title={b.notes || "Add note"}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${b.notes ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                        <StickyNote className="h-3.5 w-3.5" /> Note
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>

      <NoteModal
        open={!!noteFor}
        title={`Note · ${noteFor?.booking_no || ""}`}
        initial={noteFor?.notes || ""}
        onSave={(notes) => ownerBookingNote(noteFor.booking_no, notes)}
        onSaved={(notes) => setAll((list) => list.map((x) => (x.id === noteFor.id ? { ...x, notes } : x)))}
        onClose={() => setNoteFor(null)}
      />
      <OwnerBookingModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
}

function Action({ onClick, busy, cls, icon: Icon, children }) {
  return (
    <button disabled={busy} onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold disabled:opacity-50 ${cls}`}>
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}
