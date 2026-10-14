import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Wallet, CheckCircle2, Pencil, Printer } from "lucide-react";
import { getBooking, cancelBooking, initiatePayment, paymentAvailability, updateBookingDetails } from "../services/api";
import { taka, sessionLabel } from "../lib/format";
import { toast } from "../store/toastStore";
import BookingSoftwareFeedback from "../components/BookingSoftwareFeedback";
import Invoice from "../components/Invoice";
import BookingLoadError from "../components/BookingLoadError";
import { nextBookingPayment } from "../lib/bookingPayment";

const STATUS_STYLES = {
  confirmed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  payment_pending: "bg-amber-100 text-amber-700",
  pending_review: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function BookingSuccess() {
  const { bookingNo } = useParams();
  const [searchParams] = useSearchParams();
  const [booking, setBooking] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadRetry, setLoadRetry] = useState(0);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [paying, setPaying] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const invoiceRef = useRef(null);

  useEffect(() => {
    let active = true;
    setBooking(null);
    setLoadError(null);
    setPayOpen(false);
    setEditOpen(false);
    getBooking(bookingNo).then((value) => { if (active) setBooking(value); })
      .catch((error) => { if (active) setLoadError({ status: error.response?.status }); });
    return () => { active = false; };
  }, [bookingNo, loadRetry]);

  useEffect(() => {
    let active = true;
    paymentAvailability().then((value) => { if (active) setOnlineAvailable(value); }).catch(() => { if (active) setOnlineAvailable(false); });
    return () => { active = false; };
  }, [loadRetry]);

  // Estimated refund preview (mirrors backend day-based policy on amount paid).
  const refundEstimate = (b) => {
    if (!b) return 0;
    const days = Math.ceil((new Date(b.event_date) - new Date()) / 86400000);
    const pct = days >= 7 ? 1 : days >= 3 ? 0.5 : 0;
    return Math.round(b.paid_amount * pct);
  };

  const doCancel = async () => {
    setCancelling(true);
    try {
      const updated = await cancelBooking(bookingNo, { reason });
      setBooking(updated);
      setShowCancel(false);
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not cancel booking.");
    } finally {
      setCancelling(false);
    }
  };

  const openEdit = () => {
    setEditForm({
      customer_name: booking.customer_name || "",
      customer_phone: booking.customer_phone || "",
      guest_count: booking.guest_count || "",
      event_type: booking.event_type || "",
      event_manager_name: booking.event_manager_name || "",
      event_manager_phone: booking.event_manager_phone || "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSavingEdit(true);
    try {
      const updated = await updateBookingDetails(bookingNo, editForm);
      setBooking(updated);
      setEditOpen(false);
      toast.success("Booking details updated.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not update details.");
    } finally {
      setSavingEdit(false);
    }
  };

  const doPayDue = async () => {
    setPaying(true);
    try {
      const res = await initiatePayment({ booking_no: bookingNo, payment_option: nextBookingPayment(booking).option });
      window.location.assign(res.redirect_url);
    } catch (e) {
      toast.error(e.response?.data?.message || "Payment could not be processed.");
    } finally {
      setPaying(false);
    }
  };

  const printInvoice = () => {
    const html = invoiceRef.current?.innerHTML;
    if (!html) return;
    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) { toast.error("Allow pop-ups to print your invoice."); return; }
    const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')]
      .map((node) => node.outerHTML).join("");
    printWindow.document.write(`<!doctype html><html><head><title>Invoice ${booking.booking_no}</title>
      ${styles}<style>@media print{.no-print{display:none}} body{font-family:ui-sans-serif,system-ui,sans-serif}</style>
      </head><body class="p-8">${html}<script>window.onload=()=>{window.print()}</script></body></html>`);
    printWindow.document.close();
  };

  // Once a booking is confirmed/paid by the centre or admin it is locked in and
  // can no longer be self-cancelled by the customer.
  const canCancel = booking && !["confirmed", "paid", "cancelled", "completed", "refunded"].includes(booking.status);
  const canPayDue = booking && onlineAvailable && booking.due_amount > 0 && !["cancelled", "completed", "refunded"].includes(booking.status);
  const canEdit = booking && !["cancelled", "completed", "refunded"].includes(booking.status);

  if (loadError) return <BookingLoadError status={loadError.status} subject="Booking" onRetry={() => setLoadRetry((value) => value + 1)} />;
  if (!booking || booking.booking_no !== bookingNo) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-slate-400">Loading…</div>;
  }

  const nextPayment = nextBookingPayment(booking);
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="text-center">
        <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full text-3xl ${booking.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
          {booking.status === "confirmed" ? "✓" : <Wallet className="h-8 w-8" />}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">{booking.status === "confirmed" ? "Booking confirmed!" : "Booking request submitted"}</h1>
        <p className="text-slate-500 mt-1">
          {booking.status === "confirmed" ? "Your payment has been verified." : "Payment is not yet confirmed."}
        </p>
        {searchParams.get("payment") === "pending" && <p className="mt-3 text-sm text-amber-700">The gateway result is pending verification. Please check this booking again shortly.</p>}
        {searchParams.get("payment") === "unavailable" && <p className="mt-3 text-sm text-amber-700">Your booking was saved, but the payment gateway could not start. No payment has been recorded.</p>}
      </div>

      <BookingSoftwareFeedback bookingNo={bookingNo} />

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs font-medium text-slate-500">Booking number</div>
            <div className="text-xl font-extrabold text-slate-900">{booking.booking_no}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {Number(booking.paid_amount) > 0 && booking.payment && <button type="button" onClick={printInvoice} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"><Printer className="h-4 w-4" />Invoice</button>}
            <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-600"}`}>
              {booking.status.replaceAll("_", " ")}
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booking details</div>
          {canEdit && !editOpen && (
            <button
              onClick={openEdit}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Edit details
            </button>
          )}
        </div>

        {editOpen ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <EditField label="Customer name" value={editForm.customer_name} onChange={(v) => setEditForm((f) => ({ ...f, customer_name: v }))} />
              <EditField label="Phone" value={editForm.customer_phone} onChange={(v) => setEditForm((f) => ({ ...f, customer_phone: v }))} />
              <EditField label="Guests" type="number" value={editForm.guest_count} onChange={(v) => setEditForm((f) => ({ ...f, guest_count: v }))} />
              <EditField label="Event type" value={editForm.event_type} onChange={(v) => setEditForm((f) => ({ ...f, event_type: v }))} />
              <EditField label="Event manager name" value={editForm.event_manager_name} onChange={(v) => setEditForm((f) => ({ ...f, event_manager_name: v }))} />
              <EditField label="Event manager phone" type="tel" value={editForm.event_manager_phone} onChange={(v) => setEditForm((f) => ({ ...f, event_manager_phone: v }))} />
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={saveEdit} disabled={savingEdit} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
              <button onClick={() => setEditOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 grid sm:grid-cols-2 gap-4 text-sm">
            <Info label="Centre" value={booking.centre.name} />
            <Info label="Area" value={booking.centre.area} />
            <Info label="Event schedule" value={`${booking.date_count || 1} date${booking.date_count > 1 ? "s" : ""}`} />
            <Info label="First session" value={sessionLabel(booking.session_type)} />
            <Info label="Guests" value={booking.guest_count} />
            <Info label="Event type" value={booking.event_type || "—"} />
            {booking.decorator_name && <><Info label="Decorator" value={booking.decorator_name} /><Info label="Decorator phone" value={booking.decorator_phone || "—"} /></>}
            {(booking.event_manager_name || booking.event_manager_phone) && <><Info label="Event manager" value={booking.event_manager_name || "—"} /><Info label="Manager phone" value={booking.event_manager_phone || "—"} /></>}
            <Info label="Customer" value={booking.customer_name} />
            <Info label="Phone" value={booking.customer_phone} />
          </div>
        )}

        {booking.booking_dates?.length > 0 && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <div className="mb-2 text-xs font-semibold text-slate-500">Reserved dates</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {booking.booking_dates.map((slot) => <div key={`${slot.date}-${slot.session_type}`} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"><span className="font-semibold text-slate-700">{slot.date}</span><span className="text-slate-500">{sessionLabel(slot.session_type)}</span></div>)}
            </div>
          </div>
        )}

        {booking.food_items.length > 0 && (
          <div className="mt-5">
            <div className="text-xs font-semibold text-slate-500 mb-1">Food package</div>
            {booking.food_items.map((f, i) => (
              <div key={i} className="flex justify-between text-sm text-slate-600">
                <span>{f.menu_name} × {f.quantity}</span>
                <span>{taka(f.total_price)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 border-t border-slate-100 pt-4 text-sm space-y-1.5">
          <Row label="Venue" value={booking.venue_amount} />
          {Number(booking.food_amount) > 0 && <Row label="Food" value={booking.food_amount} />}
          <Row label="Service charge" value={booking.service_charge} />
          <Row label="VAT" value={booking.vat_amount} />
          <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-100">
            <span>Total</span>
            <span>{taka(booking.total_amount)}</span>
          </div>
          <div className="flex justify-between text-emerald-700">
            <span>Paid {booking.payment_option === "advance" ? "(advance)" : ""}</span>
            <span>{taka(booking.paid_amount)}</span>
          </div>
          {booking.due_amount > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Due before event</span>
              <span>{taka(booking.due_amount)}</span>
            </div>
          )}
          {booking.refunded_amount > 0 && (
            <div className="flex justify-between text-blue-700">
              <span>Refunded</span>
              <span>{taka(booking.refunded_amount)}</span>
            </div>
          )}
        </div>

        {booking.payment && (
          <div className="mt-4 flex min-w-0 flex-col gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:flex-row sm:justify-between">
            <span className="text-slate-500">Paid via {booking.payment.payment_method}</span>
            <span className="min-w-0 font-mono text-slate-600 [overflow-wrap:anywhere] sm:text-right">{booking.payment.transaction_id}</span>
          </div>
        )}

        {booking.status === "cancelled" && (
          <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            Booking cancelled{booking.cancellation_reason ? `: ${booking.cancellation_reason}` : "."}{" "}
            {booking.refunded_amount > 0
              ? `${taka(booking.refunded_amount)} refunded.`
              : "No refund was due per policy."}
          </div>
        )}

        {/* Pay remaining due */}
        {canPayDue && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-500 text-white">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-semibold text-slate-900">Outstanding balance</div>
                  <div className="text-sm text-slate-500">Pay the remaining <span className="font-semibold text-amber-700">{taka(booking.due_amount)}</span> now or before the event.</div>
                </div>
              </div>
              {!payOpen && (
                <button
                  onClick={() => setPayOpen(true)}
                  className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Pay now
                </button>
              )}
            </div>
            {payOpen && (
              <div className="mt-4 border-t border-amber-200 pt-4">
                <div className="text-sm font-semibold text-slate-700">{nextPayment.option === "advance" ? "Pay the selected advance via ekPay" : "Continue securely to ekPay"}</div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={doPayDue}
                    disabled={paying}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {paying ? "Processing…" : `Pay ${taka(nextPayment.amount)}`}
                  </button>
                  <button
                    onClick={() => setPayOpen(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cancellation */}
        {canCancel && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            {!showCancel ? (
              <button
                onClick={() => setShowCancel(true)}
                className="text-sm font-semibold text-red-600 hover:underline"
              >
                Cancel booking
              </button>
            ) : (
              <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
                <div className="font-semibold text-slate-900">Cancel this booking?</div>
                <p className="text-sm text-slate-500 mt-1">
                  Refund policy on amount paid: 100% if 7+ days away, 50% if 3–6 days,
                  0% within 3 days. Estimated refund:{" "}
                  <span className="font-bold text-slate-800">{taka(refundEstimate(booking))}</span>
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="input mt-3 h-20 resize-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={doCancel}
                    disabled={cancelling}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {cancelling ? "Cancelling…" : "Confirm cancellation"}
                  </button>
                  <button
                    onClick={() => setShowCancel(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600"
                  >
                    Keep booking
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div ref={invoiceRef} hidden aria-hidden="true"><Invoice booking={booking} centre={booking.centre} /></div>

      <div className="mt-6 flex justify-center gap-3">
        <Link to="/centres" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Book another centre
        </Link>
        <Link to="/" className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          Back to home
        </Link>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 font-semibold text-slate-900">{value}</div>
    </div>
  );
}
function EditField({ label, value, onChange, type = "text" }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input mt-1 w-full"
      />
    </label>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between text-slate-700">
      <span className="font-medium">{label}</span>
      <span className="font-semibold tabular-nums text-slate-900">{taka(value)}</span>
    </div>
  );
}
