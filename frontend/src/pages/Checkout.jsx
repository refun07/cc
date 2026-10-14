import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock, UserCircle2, LogIn, Eye } from "lucide-react";
import { useBookingStore } from "../store/bookingStore";
import { useAuthStore } from "../store/authStore";
import { createBooking, getMyAccount, initiatePayment, paymentAvailability } from "../services/api";
import { taka, sessionLabel } from "../lib/format";
import AuthModal from "../components/AuthModal";
import BookingPreviewModal from "../components/BookingPreviewModal";
import ekpayLogo from "../assets/ekpay-logo.png";
import { isPlausibleNid } from "../lib/nid";
import { EKPAY_CHANNELS } from "../lib/paymentChannels";
import { useT } from "../store/langStore";

const CHECKOUT_CHANNELS = EKPAY_CHANNELS.filter(({ name }) => ["Visa", "Mastercard", "bKash", "Nagad", "Rocket"].includes(name));

export default function Checkout() {
  const { lang } = useT();
  const nav = useNavigate();
  const draft = useBookingStore((s) => s.draft);
  const clearDraft = useBookingStore((s) => s.clearDraft);
  const user = useAuthStore((s) => s.user);

  const [form, setForm] = useState({ name: "", nidNumber: "", eventManagerName: "", eventManagerPhone: "" });
  const [payOption, setPayOption] = useState("full");
  const [onlineAvailable, setOnlineAvailable] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Prefill from the signed-in account.
  useEffect(() => {
    if (user) setForm((f) => ({ ...f, name: f.name || user.name }));
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;
    getMyAccount().then((account) => useAuthStore.setState({ user: account })).catch(() => {});
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setOnlineAvailable(null);
    paymentAvailability().then((available) => { if (active) setOnlineAvailable(available); })
      .catch(() => { if (active) setOnlineAvailable(false); });
    return () => { active = false; };
  }, [user?.id]);

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
  const isCash = payOption === "cash";
  const payNow = isCash ? 0 : payOption === "advance" ? advance : q.total_amount;
  const dueLater = q.total_amount - payNow;

  // Step 1: open the details popup (no money moves yet). The popup is the review step,
  // so it must open BEFORE the "I have reviewed" confirmation — not after.
  const openPreview = () => {
    setError("");
    if (!user) { setAuthOpen(true); return; }
    if (!isCash && onlineAvailable !== true) { setError("Online payment is not available for this account yet."); return; }
    if (!form.name) { setError("Please enter your name."); return; }
    if (!user.nid_saved && !isPlausibleNid(form.nidNumber)) {
      setError(lang === "bn"
        ? "১০, ১৩ বা ১৭ সংখ্যার এনআইডি দিন। একই বা ক্রমানুসার সংখ্যা গ্রহণ করা হবে না।"
        : "Enter a 10, 13 or 17 digit NID number. Repeated and sequential digits are not accepted.");
      return;
    }
    if ((form.eventManagerName.trim() || form.eventManagerPhone.trim()) && (!form.eventManagerName.trim() || !/^01[0-9]{9}$/.test(form.eventManagerPhone.trim()))) {
      setError("Enter both the event contact's name and a valid mobile number, or leave both blank.");
      return;
    }
    setPreviewOpen(true);
  };
  const review = (e) => { e.preventDefault(); openPreview(); };

  // Step 2: actually create the booking + take payment.
  const confirmBooking = async () => {
    setSubmitting(true);
    setError("");
    let createdBookingNo = null;
    try {
      const booking = await createBooking({
        centre_slug: draft.centre.slug,
        centre_floor_id: draft.floorId ?? undefined,
        customer_name: form.name,
        nid_number: user.nid_saved ? undefined : form.nidNumber,
        decorator_id: draft.decoratorId ?? undefined,
        event_date: draft.eventDate,
        session_type: draft.sessionType,
        booking_dates: draft.bookingDates?.length ? draft.bookingDates : undefined,
        guest_count: draft.guestCount,
        event_type: draft.eventType,
        event_manager_name: form.eventManagerName.trim() || null,
        event_manager_phone: form.eventManagerPhone.trim() || null,
        payment_option: isCash ? "full" : payOption,
        expected_total_amount: q.total_amount,
        payment_method: isCash ? "Cash" : "ekPay",
      });
      createdBookingNo = booking.booking_no;
      if (!user.nid_saved) {
        useAuthStore.setState((state) => ({ user: { ...state.user, nid_saved: true } }));
      }
      if (isCash) {
        clearDraft();
        nav(`/booking/${createdBookingNo}`);
        return;
      }
      const result = await initiatePayment({
        booking_no: booking.booking_no,
        payment_option: payOption,
      });
      clearDraft();
      window.location.assign(result.redirect_url);
    } catch (err) {
      if (createdBookingNo) {
        clearDraft();
        nav(`/booking/${createdBookingNo}?payment=unavailable`);
        return;
      }
      setError(err.response?.data?.errors?.expected_total_amount?.[0] || err.response?.data?.message || "Could not submit booking. Please try again.");
      setSubmitting(false);
      setPreviewOpen(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">Review & confirm booking</h1>
      <p className="text-slate-500 mt-1">{lang === "bn" ? "ধাপ ৩ · তথ্য যাচাই করে পেমেন্টের মাধ্যম বাছুন।" : "Step 3 · Review details and choose a payment method."}</p>

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
              </div>
              {!user.nid_saved && (
                <div className="mt-3 max-w-sm">
                  <Labeled label={lang === "bn" ? "এনআইডি নম্বর * (শুধু প্রথম বুকিংয়ে)" : "NID number * (first booking only)"}>
                    <input
                      inputMode="numeric"
                      autoComplete="off"
                      value={form.nidNumber}
                      onChange={set("nidNumber")}
                      className="input"
                      placeholder={lang === "bn" ? "এনআইডি নম্বর দিন" : "Enter NID number"}
                      maxLength={17}
                    />
                  </Labeled>
                  <p className="mt-1 text-xs text-slate-500">{lang === "bn"
                    ? "১০, ১৩ বা ১৭ সংখ্যা। এখানে শুধু নম্বরের ধরন যাচাই হয়; নির্বাচন কমিশনের তথ্যের সঙ্গে পরিচয় যাচাই হয় না।"
                    : "10, 13 or 17 digits. This format check does not verify identity against the NID authority."}</p>
                </div>
              )}
              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold text-slate-800">Person responsible for the event (optional)</h3><button type="button" onClick={() => setForm((current) => ({ ...current, eventManagerName: current.name || user.name, eventManagerPhone: user.phone }))} className="text-xs font-semibold text-brand-700 hover:underline">Use my details</button></div>
                <p className="mt-1 text-xs text-slate-500">Who should the centre contact about event arrangements? Add another person's details, use your own, or leave blank if undecided.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Labeled label="Name"><input className="input" value={form.eventManagerName} onChange={set("eventManagerName")} maxLength={255} placeholder="Optional" /></Labeled>
                  <Labeled label="Mobile number"><input type="tel" inputMode="tel" className="input" value={form.eventManagerPhone} onChange={set("eventManagerPhone")} maxLength={11} placeholder="01XXXXXXXXX" /></Labeled>
                </div>
              </div>
            </Card>
          )}

          {/* Payment option */}
          <Card title="How much to pay now">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                disabled={!onlineAvailable}
                onClick={() => setPayOption("full")}
                className={`rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                  payOption === "full" ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-900">Pay in full</div>
                <div className="text-sm text-slate-500">Settle the entire amount now.</div>
                <div className="mt-2 font-extrabold text-brand-700">{taka(q.total_amount)}</div>
              </button>
              <button
                type="button"
                disabled={!onlineAvailable}
                onClick={() => setPayOption("advance")}
                className={`rounded-xl border p-4 text-left disabled:cursor-not-allowed disabled:opacity-50 ${
                  payOption === "advance" ? "border-brand-500 bg-brand-50" : "border-slate-200"
                }`}
              >
                <div className="font-semibold text-slate-900">Pay advance (30%)</div>
                <div className="text-sm text-slate-500">Confirm now, pay the rest later.</div>
                <div className="mt-2 font-extrabold text-brand-700">{taka(advance)}</div>
                <div className="text-xs text-slate-400">{lang === "bn" ? "পরে পরিশোধযোগ্য:" : "Due later:"} {taka(q.total_amount - advance)}</div>
              </button>
            </div>
          </Card>

          <Card title={lang === "bn" ? "কেন্দ্রে নগদ পরিশোধ" : "Cash at centre"}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4">
              <input type="radio" name="cash-payment" checked={isCash} onChange={() => setPayOption("cash")} className="mt-1 h-5 w-5 shrink-0 accent-emerald-600" />
              <span className="min-w-0">
                <span className="block font-semibold">{lang === "bn" ? "নগদ / কেন্দ্রে পরিশোধ করুন" : "Cash / Pay at centre"}</span>
                <span className="mt-1 block text-sm text-slate-600">{lang === "bn" ? "এখন কোনো টাকা কাটা হবে না। কেন্দ্রের কর্মী টাকা গ্রহণের রেকর্ড না করা পর্যন্ত বুকিং পেমেন্ট অপেক্ষমাণ থাকবে।" : "Nothing is charged now. Your booking stays payment pending until centre staff record the cash received."}</span>
              </span>
            </label>
          </Card>

          <Card title="Payment gateway">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <img src={ekpayLogo} alt="ekPay" className="h-10 w-[104px] shrink-0 object-contain" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={`text-xs font-semibold ${onlineAvailable ? "text-emerald-700" : "text-amber-700"}`}>
                    {onlineAvailable === null ? "Checking availability" : onlineAvailable ? "ekPay payment option enabled" : "Online payment unavailable"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {onlineAvailable
                    ? "Choose full or advance payment above. You will be sent to ekPay after review; payment counts only after gateway verification."
                    : lang === "bn" ? "অনলাইন পেমেন্ট এখন উপলব্ধ নয়। নগদ / কেন্দ্রে পরিশোধ বেছে বুকিং করতে পারেন।" : "Online payment is unavailable. You can book using Cash / Pay at centre."}
                </p>
              </div>
            </div>
            {onlineAvailable && <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-semibold text-slate-700">
                {lang === "bn" ? "ekPay-এ প্রদর্শিত পেমেন্ট মাধ্যম" : "Payment channels shown by ekPay"}
              </p>
              <div className="flex flex-wrap gap-2" aria-label={lang === "bn" ? "পেমেন্ট মাধ্যমের লোগো" : "Payment channel logos"}>
                {CHECKOUT_CHANNELS.map(({ name, image }) => (
                  <span key={name} className="inline-flex h-10 w-[74px] items-center justify-center rounded border border-slate-200 bg-white px-1.5" title={name}>
                    <img src={`${import.meta.env.BASE_URL}payment-logos/${image}`} alt={name} className="max-h-7 max-w-full object-contain" loading="lazy" />
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                {lang === "bn" ? "কোন মাধ্যম পাওয়া যাবে, তা ekPay-এর পেমেন্ট পেজে নিশ্চিত হবে।" : "Available methods are confirmed on the ekPay payment page."}
              </p>
            </div>}
          </Card>

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
              {draft.decorator && <SumRow label={lang === "bn" ? "ডেকরেটর" : "Decorator"} value={`${draft.decorator.name} · ${draft.decorator.phone}`} />}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-3 text-sm space-y-1.5">
              <SumRow label="Venue" value={taka(q.venue_amount)} />
              <SumRow label="Service charge" value={taka(q.service_charge)} />
              <SumRow label="VAT" value={taka(q.vat_amount)} />
            </div>
            <div className="mt-3 border-t border-slate-200 pt-3 flex justify-between font-bold text-slate-900">
              <span>Total</span>
              <span>{taka(q.total_amount)}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">{isCash ? (lang === "bn" ? "এখন পরিশোধ" : "Paying now") : lang === "bn"
                ? `এখন পরিশোধ (${payOption === "advance" ? "অগ্রিম" : "পূর্ণ"})`
                : `Paying now (${payOption === "advance" ? "advance" : "full"})`}</span>
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
              disabled={submitting || (Boolean(user) && !isCash && onlineAvailable !== true)}
              className="mt-2 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
            >
              {!user ? "Sign in to continue" : isCash ? (lang === "bn" ? "বুকিং যাচাই করুন" : "Review booking") : `Review & pay ${taka(payNow)}`}
            </button>
            <Link to={`/centres/${draft.centre.slug}/book`} className="mt-2 block text-center text-xs text-slate-400">
              ← Edit booking
            </Link>
          </div>
        </div>
      </form>

      <AuthModal open={authOpen} defaultMode="register" onClose={() => setAuthOpen(false)} />
      <BookingPreviewModal
        open={previewOpen}
        draft={draft}
        customer={{ name: form.name, phone: user?.phone }}
        eventManager={{ name: form.eventManagerName.trim(), phone: form.eventManagerPhone.trim() }}
        method={isCash ? "Cash" : "ekPay"}
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
