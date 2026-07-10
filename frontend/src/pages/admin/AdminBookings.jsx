import { useEffect, useMemo, useState } from "react";
import { StickyNote, Plus, MapPin, CalendarDays, Clock, Users, Building2, Phone } from "lucide-react";
import { adminBookings, adminBookingNote } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, Card, Badge, Loading } from "./ui";
import NoteModal from "../../components/NoteModal";
import AdminBookingModal from "./AdminBookingModal";

const FILTERS = ["", "pending_review", "payment_pending", "confirmed", "cancelled", "completed"];

export default function AdminBookings() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("");
  const [noteFor, setNoteFor] = useState(null);
  const [creating, setCreating] = useState(false);

  const load = () => { setRows(null); adminBookings(status ? { status } : {}).then(setRows).catch(() => setRows([])); };
  useEffect(load, [status]);

  const stats = useMemo(() => {
    const list = rows || [];
    return {
      count: list.length,
      revenue: list.reduce((s, b) => s + Number(b.paid_amount || 0), 0),
      due: list.reduce((s, b) => s + Number(b.due_amount || 0), 0),
    };
  }, [rows]);

  return (
    <div>
      <PageHead title="Bookings" subtitle="Every booking across the marketplace.">
        <button onClick={() => setCreating(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> New booking
        </button>
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f || "all"} onClick={() => setStatus(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${status === f ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {f ? f.replaceAll("_", " ") : "All"}
          </button>
        ))}
      </div>
      {rows && rows.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <MiniStat label="Bookings" value={stats.count} accent="from-blue-500 to-indigo-600" />
          <MiniStat label="Collected" value={taka(stats.revenue)} accent="from-emerald-500 to-teal-600" />
          <MiniStat label="Outstanding due" value={taka(stats.due)} accent="from-amber-500 to-orange-600" />
        </div>
      )}

      {!rows ? (
        <Card><Loading /></Card>
      ) : rows.length === 0 ? (
        <Card><div className="p-10 text-center text-sm text-slate-400">No bookings found.</div></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((b) => {
            const mixed = new Set((b.booking_dates || []).map((s) => s.session_type)).size > 1;
            return (
              <div key={b.id} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
                  <span className="font-mono text-xs text-slate-500">{b.booking_no}</span>
                  <Badge status={b.status} />
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-900">{b.customer_name}</div>
                      <div className="inline-flex items-center gap-1 text-xs text-slate-400"><Phone className="h-3 w-3" /> {b.customer_phone}</div>
                    </div>
                    {b.event_type && <span className="shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold text-brand-700">{b.event_type}</span>}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="inline-flex items-center gap-1.5 font-semibold text-slate-800"><Building2 className="h-4 w-4 text-brand-600" /> {b.centre?.name || "—"}</div>
                    {b.centre?.area && <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-400"><MapPin className="h-3 w-3" /> {b.centre.area}</div>}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-slate-400" /> {b.event_date}{b.date_count > 1 ? ` +${b.date_count - 1}` : ""}</span>
                    <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-slate-400" /> {mixed ? "Mixed" : sessionLabel(b.session_type)}</span>
                    <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" /> {b.guest_count}</span>
                  </div>

                  <div className="mt-auto flex items-end justify-between border-t border-slate-100 pt-3">
                    <div>
                      <div className="text-lg font-extrabold tabular-nums text-slate-900">{taka(b.total_amount)}</div>
                      {b.due_amount > 0
                        ? <div className="text-xs font-semibold text-amber-600">Paid {taka(b.paid_amount)} · Due {taka(b.due_amount)}</div>
                        : <div className="text-xs font-semibold text-emerald-600">Fully paid</div>}
                    </div>
                    <button onClick={() => setNoteFor(b)} title={b.notes || "Add note"}
                      className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${b.notes ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                      <StickyNote className="h-3.5 w-3.5" /> {b.notes ? "View" : "Note"}
                    </button>
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
        onSave={(notes) => adminBookingNote(noteFor.booking_no, notes)}
        onSaved={(notes) => setRows((list) => list.map((x) => (x.id === noteFor.id ? { ...x, notes } : x)))}
        onClose={() => setNoteFor(null)}
      />
      <AdminBookingModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </div>
  );
}

function MiniStat({ label, value, accent }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${accent} opacity-10`} />
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
