import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, UserCircle2, LogIn, Eye } from "lucide-react";
import { useBookingStore } from "../store/bookingStore";
import { useAuthStore } from "../store/authStore";
import { createBooking, initiatePayment } from "../services/api";
import { taka, sessionLabel } from "../lib/format";
import AuthModal from "../components/AuthModal";
import BookingPreviewModal from "../components/BookingPreviewModal";

const PAYMENT_METHODS = [
  { id: "bKash", color: "#E2136E" },
  { id: "Nagad", color: "#EE7C1B" },
  { id: "Rocket", color: "#8B3A93" },
  { id: "Upay", color: "#0FA3E0" },
  { id: "SSLCommerz", color: "#0B6E4F" },
  { id: "Card", color: "#1A56DB" },
  { id: "Bank Transfer", color: "#475569" },
  { id: "QR Payment", color: "#0F172A" },
];

export default function Checkout() {
  const nav = useNavigate();
  const draft = useBookingStore((s) => s.draft);
  const clearDraft = useBookingStore((s) => s.clearDraft);
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState({ name: "", email: "" });
  const [method, setMethod] = useState("bKash");
  const [payOption, setPayOption] = useState("full"); // 'full' | 'advance'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Prefill from the signed-in account.
  useEffect(() => {
    if (user) setForm((f) => ({ name: f.name || user.name, email: f.email || user.email || "" }));
  }, [user]);

  if (!draft) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-slate-500">No booking in progress.</p>
        <Link to="/centres" className="mt-4 inline-block text-brand-700 font-semibold">
          Browse centres →
        </Link>
      </div>
    );
  }

  const q = draft.quote;
  const advance = q.advance_amount ?? Math.round(q.total_amount * 0.3);
  const payNow = payOption === "later" ? 0 : payOption === "advance" ? advance : q.total_amount;
  const dueLater = q.total_amount - payNow;

  // Step 1: open the details popup (no money moves yet). The popup is the review step,
  // so it must open BEFORE the "I have reviewed" confirmation — not after.
  const openPreview = () => {
    setError("");
    if (!user) { setAuthOpen(true); return; }
    if (!form.name) { setError("Please enter your name."); return; }
    setPreviewOpen(true);
  };
  const review = (e) => { e.preventDefault(); openPreview(); };

  // Step 2: actually create the booking + take payment.
  const confirmBooking = async () => {
    setSubmitting(true);
    setError("");
    try {
      const booking = await createBooking({
        centre_slug: draft.centre.slug,
        centre_floor_id: draft.floorId ?? undefined,
        customer_name: form.name,
        customer_email: form.email || null,
        event_date: draft.eventDate,
        session_type: draft.sessionType,
        booking_dates: draft.bookingDates?.length ? draft.bookingDates : undefined,
        guest_count: draft.guestCount,
        event_type: draft.eventType,
        food_selections: draft.foodSelections,
        payment_option: payOption,
        payment_method: method,
      });
      // "Pay later" reserves the slot without moving any money — the customer
      // settles the balance from their bookings page before the event.
      if (payOption !== "later") {
        await initiatePayment({
          booking_no: booking.booking_no,
          payment_method: method,
          payment_option: payOption,
        });
      }
      clearDraft();
      nav(`/booking/${booking.booking_no}`);
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit booking. Please try again.");
      setSubmitting(false);
      setPreviewOpen(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">Review & confirm booking</h1>
      <p className="text-slate-500 mt-1">Step 7–9 · Review summary, choose payment, submit request.</p>

      <form onSubmit={review} className="mt-8 grid lg:grid-cols-[1fr_380px] gap-8">
        <div className="space-y-6">
          {/* Account gate */}
          {!user ? (
            <Card title="Sign in to book">
              <div className="flex flex-col items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white">
                    <UserCircle2 className="h-6 w-6" />
                  </span>
                  <div>
                    <div className="font-semibold text-slate-900">Account required</div>
                    <p className="text-sm text-slate-500">Create an account with your mobile number to confirm a booking.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  <LogIn className="h-4 w-4" /> Sign in / Sign up
                </button>
              </div>
            </Card>
          ) : (
            <Card title="Contact details">
              <div className="grid sm:grid-cols-2 gap-3">
                <Labeled label="Full name *">
                  <input value={form.name} onChange={set("name")} className="input" placeholder="Your name" />
                </Labeled>
                <Labeled label="Mobile number (account)">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    <Lock className="h-3.5 w-3.5 text-slate-400" /> {user.phone}
                  </div>
                </Labeled>
                <Labeled label="Email">
                  <input value={form.email} onChange={set("email")} className="input" placeholder="you@example.com" />
                </Labeled>
              </div>
            </Card>
          )}

          {/* Payment option */}
          <Card title="How much to pay now">
            <div className="grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setPayOption("full")}
                className={`rounded-xl border p-4 text-left ${
                  payOption === "full" ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-900">Pay in full</div>
                <div className="text-sm text-slate-500">Settle the entire amount now.</div>
                <div className="mt-2 font-extrabold text-brand-700">{taka(q.total_amount)}</div>
              </button>
              <button
                type="button"
                onClick={() => setPayOption("advance")}
                className={`rounded-xl border p-4 text-left ${
                  payOption === "advance" ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-900">Pay advance (30%)</div>
                <div className="text-sm text-slate-500">Confirm now, pay the rest later.</div>
                <div className="mt-2 font-extrabold text-brand-700">{taka(advance)}</div>
                <div className="text-xs text-slate-400">Due later: {taka(q.total_amount - advance)}</div>
              </button>
              <button
                type="button"
                onClick={() => setPayOption("later")}
                className={`rounded-xl border p-4 text-left ${
                  payOption === "later" ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-900">Pay later</div>
                <div className="text-sm text-slate-500">Reserve the slot, pay before the event.</div>
                <div className="mt-2 font-extrabold text-brand-700">{taka(0)}</div>
                <div className="text-xs text-slate-400">Due later: {taka(q.total_amount)}</div>
              </button>
            </div>
          </Card>

          {/* Payment */}
          {payOption !== "later" ? (
          <Card title="Payment method">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => setMethod(p.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
                    method === p.id
                      ? "border-brand-500 bg-brand-50 text-brand-800 ring-1 ring-brand-200"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span
                    className="grid h-6 w-6 flex-shrink-0 place-items-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.id[0]}
                  </span>
                  <span className="truncate">{p.id}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Demo build: payment is simulated and instantly marked paid.
            </p>
          </Card>
          ) : (
          <Card title="Pay later">
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-sm text-slate-600">
              Your slot will be reserved with no payment now. You can pay the full
              <span className="font-semibold text-amber-700"> {taka(q.total_amount)} </span>
              anytime from your bookings page, before the event date.
            </div>
          </Card>
          )}

          <p className="text-xs text-slate-400">
            You'll see the full booking details in a popup to review and confirm before any payment is made.
          </p>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="lg:sticky lg:top-20 h-fit">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)]">
            <h2 className="font-bold text-slate-900">Booking summary</h2>
            <div className="mt-3 text-sm space-y-1.5 text-slate-600">
              <SumRow label="Centre" value={draft.centre.name} />
              {draft.floorName && <SumRow label="Floor" value={draft.floorName} />}
              <SumRow label="Area" value={draft.centre.area} />
              {draft.bookingDates?.length > 1 ? (
                <div className="flex justify-between gap-3">
                  <span className="text-slate-400">Dates ({draft.bookingDates.length})</span>
                  <span className="font-medium text-slate-700 text-right">
                    {draft.bookingDates.map((d) => (
                      <span key={d.date} className="block">{d.date} · {sessionLabel(d.session_type)}</span>
                    ))}
                  </span>
                </div>
              ) : (
                <>
                  <SumRow label="Date" value={draft.eventDate} />
                  <SumRow label="Session" value={sessionLabel(draft.sessionType)} />
                </>
              )}
              <SumRow label="Guests" value={draft.guestCount} />
              <SumRow label="Event" value={draft.eventType} />
              {draft.menuName && <SumRow label="Menu" value={draft.menuName} />}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 text-sm space-y-1.5">
              <SumRow label="Venue" value={taka(q.venue_amount)} />
              <SumRow label="Food" value={taka(q.food_amount)} />
              <SumRow label="Service charge" value={taka(q.service_charge)} />
              <SumRow label="VAT" value={taka(q.vat_amount)} />
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900">
              <span>Total</span>
              <span>{taka(q.total_amount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Paying now ({payOption === "advance" ? "advance" : payOption === "later" ? "pay later" : "full"})</span>
              <span className="font-extrabold text-brand-700">{taka(payNow)}</span>
            </div>
            {dueLater > 0 && (
              <div className="flex justify-between text-xs text-slate-400">
                <span>Due at / before event</span>
                <span>{taka(dueLater)}</span>
              </div>
            )}

            <button
              type="button"
              onClick={openPreview}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-100"
            >
              <Eye className="h-4 w-4" /> View booking details
            </button>
            <button
              disabled={submitting}
              className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
            >
              {!user ? "Sign in to continue" : payOption === "later" ? "Review & reserve slot" : `Review & pay ${taka(payNow)}`}
            </button>
            <Link to={`/centres/${draft.centre.slug}`} className="mt-2 block text-center text-xs text-slate-400">
              ← Edit booking
            </Link>
          </div>
        </div>
      </form>

      <AuthModal open={authOpen} defaultMode="register" onClose={() => setAuthOpen(false)} />
      <BookingPreviewModal
        open={previewOpen}
        draft={draft}
        customer={{ name: form.name, phone: user?.phone, email: form.email }}
        method={method}
        payOption={payOption}
        payNow={payNow}
        dueLater={dueLater}
        busy={submitting}
        onConfirm={confirmBooking}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08)]">
      <h2 className="font-bold text-slate-900 mb-3">{title}</h2>
      {children}
    </div>
  );
}
function Labeled({ label, children }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
function SumRow({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 text-right">{value}</span>
    </div>
  );
}
