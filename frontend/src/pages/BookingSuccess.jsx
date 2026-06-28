import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getBooking, cancelBooking } from "../services/api";
import { taka, sessionLabel } from "../lib/format";
import { toast } from "../store/toastStore";

const STATUS_STYLES = {
  confirmed: "bg-emerald-100 text-emerald-700",
  paid: "bg-emerald-100 text-emerald-700",
  payment_pending: "bg-amber-100 text-amber-700",
  pending_review: "bg-blue-100 text-blue-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function BookingSuccess() {
  const { bookingNo } = useParams();
  const [booking, setBooking] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    getBooking(bookingNo).then(setBooking).catch(() => setNotFound(true));
  }, [bookingNo]);

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

  const canCancel = booking && !["cancelled", "completed", "refunded"].includes(booking.status);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-500">
        Booking not found.
        <Link to="/centres" className="block mt-4 text-brand-700 font-semibold">Browse centres →</Link>
      </div>
    );
  }
  if (!booking) {
    return <div className="mx-auto max-w-3xl px-4 py-20 text-slate-400">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12">
      <div className="text-center">
        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-100 grid place-items-center text-3xl">
          ✓
        </div>
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Booking confirmed!</h1>
        <p className="text-slate-500 mt-1">
          Your booking request has been submitted and payment recorded.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-xs text-slate-400">Booking number</div>
            <div className="text-xl font-extrabold text-slate-900">{booking.booking_no}</div>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[booking.status] || "bg-slate-100 text-slate-600"}`}>
            {booking.status.replaceAll("_", " ")}
          </span>
        </div>

        <div className="mt-5 grid sm:grid-cols-2 gap-4 text-sm">
          <Info label="Centre" value={booking.centre.name} />
          <Info label="Area" value={booking.centre.area} />
          <Info label="Event schedule" value={`${booking.date_count || 1} date${booking.date_count > 1 ? "s" : ""}`} />
          <Info label="First session" value={sessionLabel(booking.session_type)} />
          <Info label="Guests" value={booking.guest_count} />
          <Info label="Event type" value={booking.event_type || "—"} />
          <Info label="Customer" value={booking.customer_name} />
          <Info label="Phone" value={booking.customer_phone} />
        </div>

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
          <Row label="Food" value={booking.food_amount} />
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
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm flex justify-between">
            <span className="text-slate-500">Paid via {booking.payment.payment_method}</span>
            <span className="font-mono text-slate-600">{booking.payment.transaction_id}</span>
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
      <div className="text-xs text-slate-400">{label}</div>
      <div className="font-medium text-slate-800">{value}</div>
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{taka(value)}</span>
    </div>
  );
}
