import { useEffect, useState } from "react";
import { StickyNote, Plus } from "lucide-react";
import { adminBookings, adminBookingNote } from "../../services/api";
import { taka, sessionLabel } from "../../lib/format";
import { PageHead, Card, Table, Badge, Loading } from "./ui";
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
      <Card>
        {!rows ? <Loading /> : rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No bookings found.</div>
        ) : (
          <Table head={["Booking", "Customer", "Centre", "Date", "Session", "Total", "Paid", "Status", "Note"]}>
            {rows.map((b) => (
              <tr key={b.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{b.booking_no}</td>
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800">{b.customer_name}</div>
                  <div className="text-xs text-slate-400">{b.customer_phone}</div>
                </td>
                <td className="px-5 py-3 text-slate-600">{b.centre?.name}</td>
                <td className="px-5 py-3 tabular-nums text-slate-600"><div>{b.event_date}</div>{b.date_count > 1 && <div className="text-xs font-semibold text-brand-600">+{b.date_count - 1} more date{b.date_count > 2 ? "s" : ""}</div>}</td>
                <td className="px-5 py-3 text-slate-600">{new Set((b.booking_dates || []).map((slot) => slot.session_type)).size > 1 ? "Mixed sessions" : sessionLabel(b.session_type)}</td>
                <td className="px-5 py-3 font-semibold tabular-nums">{taka(b.total_amount)}</td>
                <td className="px-5 py-3 tabular-nums text-emerald-700">{taka(b.paid_amount)}</td>
                <td className="px-5 py-3"><Badge status={b.status} /></td>
                <td className="px-5 py-3">
                  <button onClick={() => setNoteFor(b)} title={b.notes || "Add note"}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${b.notes ? "bg-amber-100 text-amber-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
                    <StickyNote className="h-3.5 w-3.5" /> {b.notes ? "View" : "Add"}
                  </button>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

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
