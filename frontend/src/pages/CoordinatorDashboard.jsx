import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Building2, CalendarCheck, CheckCircle2, Eye, LogOut, Plus, Save, Ticket } from "lucide-react";
import { coordinatorBookingNote, coordinatorVerifyCompletion, coordinatorOverview, loginAccount } from "../services/api";
import { askConfirm } from "../store/confirmStore";
import { taka, sessionLabel } from "../lib/format";
import { useAuthStore } from "../store/authStore";
import { toast } from "../store/toastStore";
import FlexibleBookingModal from "../components/FlexibleBookingModal";

export default function CoordinatorDashboard({ embedded = false }) {
  const { user, logout, setAuth } = useAuthStore();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [note, setNote] = useState("");
  const [details, setDetails] = useState(null);

  const load = () => {
    coordinatorOverview(page).then((result) => { setData(result); setError(""); })
      .catch((requestError) => setError(requestError.response?.data?.message || "Could not load coordinator access."));
  };

  useEffect(() => {
    if (["project_coordinator", "caretaker"].includes(user?.role)) load();
    // Reload when the signed-in account or booking page changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, page]);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginAccount(form);
      if (!["project_coordinator", "caretaker"].includes(result.user.role)) {
        setError("This account is not a project coordinator.");
        return;
      }
      setAuth(result);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async (bookingNo) => {
    setBusy(true);
    try {
      await coordinatorBookingNote(bookingNo, note);
      setEditingNote(null);
      toast.success("Booking note saved.");
      load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Could not save booking note.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCompletion = async () => {
    if (!details?.can_verify) return;
    if (!(await askConfirm({
      title: "Verify event completion?",
      message: "Confirm the owner marked this booking Completed and the event has finished.",
      confirmText: "Verify completion",
    }))) return;
    setBusy(true);
    try {
      const result = await coordinatorVerifyCompletion(details.booking_no);
      setDetails((current) => ({ ...current, can_verify: false, completion_verified_at: result.completion_verified_at }));
      toast.success("Event completion verified.");
      load();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Could not verify completion.");
    } finally {
      setBusy(false);
    }
  };

  if (!embedded && user?.role === "caretaker") return <Navigate to="/caretaker" replace />;

  if (!user) return <main className="grid min-h-dvh place-items-center bg-slate-100 px-4">
    <form onSubmit={signIn} className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
      <h1 className="text-xl font-bold text-slate-900">ICCMS Project Coordinator</h1>
      <label className="mt-5 block text-sm font-semibold text-slate-700">Mobile number<input type="tel" inputMode="tel" pattern="01[0-9]{9}" required value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="input mt-1 w-full" /></label>
      <label className="mt-3 block text-sm font-semibold text-slate-700">Password<input type="password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="input mt-1 w-full" /></label>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Sign in</button>
    </form>
  </main>;

  if (!["project_coordinator", "caretaker"].includes(user.role)) return <main className="mx-auto max-w-2xl p-8"><p>Access denied.</p><Link to="/" className="mt-3 inline-block text-brand-700">Go home</Link></main>;

  const permissions = data?.permissions || [];
  const can = (permission) => permissions.includes(permission);

  return <section className={embedded ? "border-y border-slate-200" : "min-h-dvh bg-slate-50"}>
    <header hidden={embedded} className="border-b bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6"><div><h1 className="text-xl font-bold text-slate-900">Project coordinator</h1><p className="text-sm text-slate-500">{user.name}</p></div><div className="flex items-center gap-3"><Link to="/coordinator/tickets" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Ticket className="h-4 w-4" /> Service requests</Link><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><LogOut className="h-4 w-4" /> Sign out</button></div></div></header>
    <div className={embedded ? "space-y-6 py-5" : "mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6"}>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data ? <p className="text-sm text-slate-500">Loading assigned centres...</p> : <>
        {(can("centres.view") || can("bookings.create")) && <section><div className="flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 className="h-5 w-5" /> Assigned centres ({data.centres.length})</h2>{can("bookings.create") && <button type="button" onClick={() => setCreating(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> New booking</button>}</div>
          <div className="mt-3 overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[480px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Centre</th><th className="px-4 py-3">Area</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{data.centres.map((centre) => <tr key={centre.id} className="border-t border-slate-100"><td className="px-4 py-3"><Link to={`/centres/${centre.slug}`} className="font-semibold text-brand-700 hover:underline">{centre.name}</Link></td><td className="px-4 py-3">{centre.area}</td><td className="px-4 py-3">{centre.capacity}</td><td className="px-4 py-3 capitalize">{centre.status}</td></tr>)}</tbody></table>{data.centres.length === 0 && <p className="p-4 text-sm text-slate-500">No centres assigned.</p>}</div>
        </section>}
        {can("bookings.view") && <section><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarCheck className="h-5 w-5" /> Today's events <span className="text-sm font-normal text-slate-500">{data.today}</span></h2>
          <CoordinatorBookingTable rows={data.today_bookings} onDetails={setDetails} onNote={(booking) => { setEditingNote(booking.booking_no); setNote(booking.notes || ""); }} canNote={can("bookings.note")} empty="No events scheduled today." />
        </section>}
        {can("bookings.view") && <section><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarCheck className="h-5 w-5" /> Bookings</h2>
          <CoordinatorBookingTable rows={data.bookings.data} onDetails={setDetails} onNote={(booking) => { setEditingNote(booking.booking_no); setNote(booking.notes || ""); }} canNote={can("bookings.note")} empty="No bookings in assigned centres." />
          <div className="mt-3 flex items-center justify-end gap-3 text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {page}</span><button type="button" disabled={!data.bookings.next_page_url} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div>
        </section>}
      </>}
    </div>
    {creating && <FlexibleBookingModal open={creating} mode="coordinator" assignedCentres={data?.centres || []} onClose={() => setCreating(false)} onCreated={load} />}
    {editingNote && <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditingNote(null); }}><div role="dialog" aria-modal="true" aria-label="Edit booking note" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><h3 className="text-lg font-bold">Booking note · {editingNote}</h3><textarea className="input mt-4 min-h-32 w-full" maxLength={2000} value={note} onChange={(event) => setNote(event.target.value)} /><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditingNote(null)} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button type="button" disabled={busy} onClick={() => saveNote(editingNote)} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="h-4 w-4" /> Save</button></div></div></div>}
    {details && <CoordinatorBookingDetails booking={details} busy={busy} canVerify={can("bookings.verify")} onVerify={verifyCompletion} onClose={() => setDetails(null)} />}
  </section>;
}

function CoordinatorBookingTable({ rows, canNote, onDetails, onNote, empty }) {
  return <div className="mt-3 overflow-x-auto border-y border-slate-200 bg-white">
    <table className="w-full min-w-[760px] text-left text-sm">
      <thead className="bg-slate-50 text-slate-500"><tr>
        <th className="px-4 py-3">Booking</th>
        <th className="px-4 py-3">Centre / floor</th>
        <th className="px-4 py-3">Date / session</th>
        <th className="px-4 py-3">Customer</th>
        <th className="px-4 py-3">Status</th>
        <th className="px-4 py-3">Action</th>
      </tr></thead>
      <tbody>{rows.map((booking) => <tr key={booking.booking_no} className="border-t border-slate-100">
        <td className="px-4 py-3 font-semibold">{booking.booking_no}</td>
        <td className="px-4 py-3">{booking.centre}{booking.floor ? ` · ${booking.floor}` : ""}</td>
        <td className="px-4 py-3">{booking.event_date}<span className="block text-xs text-slate-500">{sessionLabel(booking.session_type)}</span></td>
        <td className="px-4 py-3">{booking.customer_name}<span className="block text-xs text-slate-500">{booking.customer_phone}</span></td>
        <td className="px-4 py-3 capitalize">{booking.status.replaceAll("_", " ")}{booking.completion_verified_at && <span className="block text-xs text-brand-700">Verified</span>}</td>
        <td className="px-4 py-3"><div className="flex items-center gap-3">
          <button type="button" onClick={() => onDetails(booking)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline"><Eye className="h-4 w-4" /> Details</button>
          {canNote && <button type="button" onClick={() => onNote(booking)} className="text-sm font-semibold text-slate-600 hover:underline">{booking.notes ? "Edit note" : "Add note"}</button>}
        </div></td>
      </tr>)}</tbody>
    </table>
    {rows.length === 0 && <p className="p-4 text-sm text-slate-500">{empty}</p>}
  </div>;
}

function CoordinatorBookingDetails({ booking, busy, canVerify, onVerify, onClose }) {
  const verifiedAt = booking.completion_verified_at
    ? new Date(booking.completion_verified_at).toLocaleString("en-BD", { timeZone: "Asia/Dhaka" })
    : null;

  return <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label="Booking details" className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
      <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div><h3 className="text-lg font-bold text-slate-900">{booking.booking_no}</h3><p className="mt-1 text-sm capitalize text-slate-500">{booking.status.replaceAll("_", " ")}</p></div>
        <button type="button" onClick={onClose} className="rounded-lg border px-3 py-1.5 text-sm">Close</button>
      </div>
      <dl className="grid gap-x-4 gap-y-3 py-4 text-sm sm:grid-cols-2">
        <div><dt className="text-slate-500">Centre / floor</dt><dd className="font-semibold text-slate-900">{booking.centre}{booking.floor ? ` · ${booking.floor}` : ""}</dd></div>
        <div><dt className="text-slate-500">Event date</dt><dd className="font-semibold text-slate-900">{booking.event_date}{booking.last_event_date !== booking.event_date ? ` – ${booking.last_event_date}` : ""}</dd></div>
        <div><dt className="text-slate-500">Session</dt><dd className="font-semibold text-slate-900">{sessionLabel(booking.session_type)}</dd></div>
        {booking.event_type && <div><dt className="text-slate-500">Event type</dt><dd className="font-semibold text-slate-900">{booking.event_type}</dd></div>}
        <div><dt className="text-slate-500">Guests</dt><dd className="font-semibold text-slate-900">{booking.guest_count || "—"}</dd></div>
        <div><dt className="text-slate-500">Customer</dt><dd className="font-semibold text-slate-900">{booking.customer_name}<span className="block font-normal">{booking.customer_phone}</span></dd></div>
        {booking.event_manager_name && <div><dt className="text-slate-500">Event-day contact</dt><dd className="font-semibold text-slate-900">{booking.event_manager_name}<span className="block font-normal">{booking.event_manager_phone}</span></dd></div>}
        <div><dt className="text-slate-500">Total</dt><dd className="font-semibold text-slate-900">{taka(booking.total_amount)}</dd></div>
        <div><dt className="text-slate-500">Paid / due</dt><dd className="font-semibold text-slate-900">{taka(booking.paid_amount)} / {taka(booking.due_amount)}</dd></div>
      </dl>
      {booking.notes && <p className="border-t border-slate-200 py-3 text-sm text-slate-600">{booking.notes}</p>}
      <div className="border-t border-slate-200 pt-4 text-sm">
        <p className="font-semibold text-slate-900">Completion verification</p>
        {verifiedAt ? <p className="mt-1 text-brand-700">Verified on {verifiedAt}</p>
          : booking.status !== "completed" ? <p className="mt-1 text-slate-500">Owner must mark this booking Completed first.</p>
          : Number(booking.due_amount) > 0 ? <p className="mt-1 text-slate-500">Settle the remaining balance before verification.</p>
          : <p className="mt-1 text-slate-500">Awaiting verification.</p>}
        {canVerify && booking.can_verify && <button type="button" disabled={busy} onClick={onVerify} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" /> Verify completion</button>}
      </div>
    </div>
  </div>;
}
