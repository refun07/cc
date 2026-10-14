import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, MapPin, CalendarDays, Clock, Users, Tag, ShieldCheck } from "lucide-react";
import { taka, sessionLabel } from "../lib/format";
import { useT } from "../store/langStore";

/**
 * Final review of all booking info before money moves.
 * Props: open, draft, customer{name,phone}, method, payOption, payNow, dueLater, busy, onConfirm, onClose
 */
export default function BookingPreviewModal({
  open, draft, customer, eventManager, method, payOption, payNow, dueLater, busy, onConfirm, onClose,
}) {
  const { lang } = useT();
  if (!draft) return null;
  const q = draft.quote;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center bg-slate-900/60 p-0 sm:p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">Confirm your booking</h2>
                <p className="text-xs text-slate-500">Please review everything before you pay.</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
              {/* centre */}
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="font-bold text-slate-900">{draft.centre.name}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-500">
                  <MapPin className="h-3.5 w-3.5" /> {draft.centre.area}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  {draft.bookingDates?.length > 1 ? (
                    <div className="col-span-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" /> Dates ({draft.bookingDates.length})
                      </div>
                      <div className="mt-1 space-y-0.5 font-semibold text-slate-900">
                        {draft.bookingDates.map((d) => (
                          <div key={d.date}>{d.date} · {sessionLabel(d.session_type)}</div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <Row icon={CalendarDays} label="Date" value={draft.eventDate} />
                      <Row icon={Clock} label="Session" value={sessionLabel(draft.sessionType)} />
                    </>
                  )}
                  <Row icon={Users} label="Guests" value={draft.guestCount} />
                  <Row icon={Tag} label="Event" value={draft.eventType || "—"} />
                  {draft.decorator && <Row icon={Tag} label="Decorator" value={`${draft.decorator.name} · ${draft.decorator.phone}`} />}
                </div>
              </div>

              {/* customer */}
              <div className="mt-3 rounded-2xl p-4 ring-1 ring-slate-200/70">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Booked by</div>
                <div className="mt-1 font-semibold text-slate-900">{customer.name}</div>
                <div className="text-sm text-slate-500">{customer.phone}</div>
                {eventManager?.name && <div className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-600">Event manager: <span className="font-semibold text-slate-900">{eventManager.name}</span> · {eventManager.phone}</div>}
              </div>

              {/* cost */}
              <div className="mt-3 space-y-1.5 rounded-2xl p-4 ring-1 ring-slate-200/70 text-sm">
                <Line label="Venue" value={q.venue_amount} />
                <Line label="Service charge" value={q.service_charge} />
                <Line label="VAT" value={q.vat_amount} />
                <div className="flex justify-between border-t border-slate-100 pt-1.5 text-base font-extrabold text-slate-900">
                  <span>Total</span><span>{taka(q.total_amount)}</span>
                </div>
                <div className="flex justify-between pt-1 text-brand-700">
                  <span className="font-semibold">{payOption === "cash" ? (lang === "bn" ? "এখন পরিশোধ" : "Paying now") : `Paying now (${payOption})`}</span>
                  <span className="font-extrabold">{taka(payNow)}</span>
                </div>
                {dueLater > 0 && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Due before event</span><span>{taka(dueLater)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1 text-sm text-slate-500">
                  <span>Payment method</span><span className="font-medium text-slate-700">{method === "Cash" && lang === "bn" ? "নগদ" : method}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Go back
              </button>
              <button
                onClick={onConfirm}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                {busy ? "Processing…" : payNow > 0 ? `Confirm & pay ${taka(payNow)}` : "Confirm reservation"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Row({ icon: Icon, label, value }) {
  return (
    <div>
      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold text-slate-900">{value}</div>
    </div>
  );
}
function Line({ label, value }) {
  return (
    <div className="flex justify-between text-slate-700">
      <span className="font-medium">{label}</span><span className="font-semibold tabular-nums text-slate-900">{taka(value)}</span>
    </div>
  );
}
