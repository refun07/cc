import { taka, sessionLabel } from "../lib/format";

/**
 * Printable invoice for a booking. Rendered off-screen and copied into a
 * print window; keep styles inline/Tailwind-utility so they survive the copy.
 */
export default function Invoice({ booking, centre }) {
  if (!booking) return null;
  const issued = new Date().toISOString().slice(0, 10);
  const centreName = centre?.name || booking.centre?.name || "ICCMS Community Centre";
  const centreArea = centre?.area || booking.centre?.area || "";

  return (
    <div className="mx-auto max-w-2xl text-slate-800">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div>
          <div className="text-2xl font-extrabold tracking-tight">{centreName}</div>
          <div className="text-sm text-slate-500">{centreArea}</div>
          <div className="mt-1 text-xs text-slate-400">ICCMS DSCC Community Centres</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-extrabold uppercase tracking-widest text-slate-900">Invoice</div>
          <div className="mt-1 text-sm font-mono">{booking.booking_no}</div>
          <div className="text-xs text-slate-500">Issued: {issued}</div>
          <div className="text-xs text-slate-500 capitalize">Status: {booking.status?.replaceAll("_", " ")}</div>
        </div>
      </div>

      {/* Bill to + event */}
      <div className="mt-5 grid grid-cols-2 gap-6 text-sm">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Bill to</div>
          <div className="font-semibold">{booking.customer_name}</div>
          <div className="text-slate-500">{booking.customer_phone}</div>
          {booking.customer_email && <div className="text-slate-500">{booking.customer_email}</div>}
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">Event</div>
          <div>{booking.event_type || "Event"} · {booking.guest_count} guests</div>
          <div className="text-slate-500">{booking.event_date}{booking.date_count > 1 ? ` (+${booking.date_count - 1} more)` : ""}</div>
          <div className="text-slate-500">{sessionLabel(booking.session_type)}</div>
          {booking.event_manager_name && <div className="mt-1 text-slate-500">Organiser: {booking.event_manager_name} · {booking.event_manager_phone}</div>}
        </div>
      </div>

      {/* Line items */}
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-400">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          <Row label="Venue rental" value={booking.venue_amount} />
          {Number(booking.food_amount) > 0 && <Row label="Food package" value={booking.food_amount} />}
          {booking.food_items?.map((f, i) => (
            <tr key={i} className="text-slate-400">
              <td className="py-0.5 pl-4 text-xs">— {f.menu_name} × {f.quantity}</td>
              <td className="py-0.5 text-right text-xs">{taka(f.total_price)}</td>
            </tr>
          ))}
          <Row label="Service charge" value={booking.service_charge} />
          <Row label="VAT" value={booking.vat_amount} />
          {Number(booking.adjustment_amount) !== 0 && (
            <Row label={`Adjustment${booking.adjustment_reason ? ` (${booking.adjustment_reason})` : ""}`} value={booking.adjustment_amount} />
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-slate-900 text-base font-extrabold">
            <td className="py-2">Total</td>
            <td className="py-2 text-right">{taka(booking.total_amount)}</td>
          </tr>
          <tr className="text-emerald-700">
            <td className="py-0.5">Paid</td>
            <td className="py-0.5 text-right">{taka(booking.paid_amount)}</td>
          </tr>
          {Number(booking.due_amount) > 0 && (
            <tr className="font-bold text-amber-700">
              <td className="py-0.5">Balance due</td>
              <td className="py-0.5 text-right">{taka(booking.due_amount)}</td>
            </tr>
          )}
          {Number(booking.refunded_amount) > 0 && (
            <tr className="text-rose-600">
              <td className="py-0.5">Refunded</td>
              <td className="py-0.5 text-right">{taka(booking.refunded_amount)}</td>
            </tr>
          )}
        </tfoot>
      </table>

      {booking.payment?.transaction_id && (
        <div className="mt-4 text-xs text-slate-500">Payment: {booking.payment.payment_method} · {booking.payment.transaction_id}</div>
      )}

      <div className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Thank you for booking with {centreName}. This is a computer-generated invoice.
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right tabular-nums">{taka(value)}</td>
    </tr>
  );
}
