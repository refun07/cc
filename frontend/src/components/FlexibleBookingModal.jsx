import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign, CalendarCheck2, CalendarPlus, CalendarDays, Check,
  Plus, ReceiptText, Trash2, UserRound, X,
} from "lucide-react";
import {
  adminCreateBooking, coordinatorCreateBooking, getAvailability, getCentre, getCentres, ownerFloors,
  ownerCreateBooking, ownerProfile, quoteBooking,
} from "../services/api";
import { taka } from "../lib/format";
import { clientKey } from "../lib/clientKey";
import { addCalendarDays } from "../lib/bookingDates";
import { toast } from "../store/toastStore";
import AvailabilityCalendarPicker from "./AvailabilityCalendarPicker";

const SESSIONS = [
  ["full_day", "Full day"],
  ["half_day_morning", "Morning half-day"],
  ["half_day_evening", "Evening half-day"],
];
const METHODS = ["Cash", "Bank Transfer"];
const EVENT_TYPES = ["Wedding", "Reception", "Corporate event", "Conference", "Seminar", "Birthday", "Community programme", "Other"];
const EMPTY_CENTRES = [];
const newScheduleRow = (date = "", session_type = "full_day") => ({ key: clientKey(), date, session_type });

const initialForm = (mode) => ({
  centre_slug: "",
  centre_floor_id: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  event_type: "Wedding",
  event_manager_name: "",
  event_manager_phone: "",
  booking_dates: [newScheduleRow()],
  guest_count: 100,
  payment_mode: mode === "coordinator" ? "none" : mode === "owner" ? "advance" : "full",
  payment_method: "Cash",
  custom_payment_amount: "",
  has_adjustment: false,
  adjustment_type: "discount",
  adjustment_value: "",
  adjustment_reason: "",
  notes: "",
});

export default function FlexibleBookingModal({ open, onClose, onCreated, mode, assignedCentres = EMPTY_CENTRES }) {
  const [form, setForm] = useState(() => initialForm(mode));
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quotedKey, setQuotedKey] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [availability, setAvailability] = useState({});
  const [contextBusy, setContextBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [activeScheduleKey, setActiveScheduleKey] = useState(null);

  useEffect(() => {
    if (!open) return;
    const fresh = initialForm(mode);
    setForm(fresh);
    setActiveScheduleKey(fresh.booking_dates[0].key);
    setQuote(null);
    setQuotedKey(null);
    setQuoteError("");
    setAvailability({});
    setContextBusy(true);

    if (mode === "owner") {
      Promise.all([ownerProfile(), ownerFloors().catch(() => [])])
        .then(([centre, floorRows]) => {
          const activeFloors = (floorRows || []).filter((f) => f.status === "active");
          setSelectedCentre({ ...centre, floors: activeFloors });
          setForm((current) => ({ ...current, centre_slug: centre.slug, centre_floor_id: activeFloors[0]?.id ?? "" }));
        })
        .catch(() => toast.error("Could not load centre booking options."))
        .finally(() => setContextBusy(false));
    } else if (mode === "coordinator") {
      setCentres(assignedCentres);
      setContextBusy(false);
    } else {
      getCentres({ sort: "rating" })
        .then(setCentres)
        .catch(() => setCentres([]))
        .finally(() => setContextBusy(false));
    }
  }, [open, mode, assignedCentres]);

  useEffect(() => {
    if (!open || mode === "owner" || !form.centre_slug) {
      if (mode !== "owner") setSelectedCentre(null);
      return;
    }
    setContextBusy(true);
    let active = true;
    getCentre(form.centre_slug)
      .then((centre) => {
        if (!active) return;
        setSelectedCentre(centre);
        // Default to the venue's first floor (if it books by floor).
        setForm((current) => ({ ...current, centre_floor_id: centre.floors?.[0]?.id ?? "" }));
      })
      .catch(() => { if (active) setSelectedCentre(null); })
      .finally(() => { if (active) setContextBusy(false); });
    return () => { active = false; };
  }, [open, mode, form.centre_slug]);

  // A selected floor overrides the venue's capacity for validation and hints.
  const selectedFloor = (selectedCentre?.floors || []).find((f) => String(f.id) === String(form.centre_floor_id)) || null;
  const effCapacity = Number(selectedFloor?.capacity || selectedCentre?.capacity || 0);

  const adjustmentAmount = useMemo(() => {
    if (!form.has_adjustment || !form.adjustment_value) return 0;
    const value = Math.abs(Number(form.adjustment_value) || 0);
    return form.adjustment_type === "discount" ? -value : value;
  }, [form.has_adjustment, form.adjustment_type, form.adjustment_value]);

  const validSchedule = useMemo(
    () => form.booking_dates.filter((row) => row.date).map(({ date, session_type }) => ({ date, session_type })),
    [form.booking_dates]
  );
  const quoteKey = JSON.stringify([open, form.centre_slug, form.centre_floor_id, form.guest_count, adjustmentAmount, validSchedule]);

  useEffect(() => {
    let active = true;
    setQuote(null);
    setQuotedKey(null);
    setQuoteError("");
    if (!open || !form.centre_slug || !form.guest_count) { setQuoteBusy(false); return; }
    setQuoteBusy(true);
    const timer = setTimeout(() => {
      quoteBooking({
        centre_slug: form.centre_slug,
        centre_floor_id: form.centre_floor_id || undefined,
        session_type: validSchedule[0]?.session_type || "full_day",
        guest_count: Number(form.guest_count),
        adjustment_amount: adjustmentAmount,
        booking_dates: validSchedule.length ? validSchedule : undefined,
      })
        .then((value) => { if (active) { setQuote(value); setQuotedKey(quoteKey); } })
        .catch((error) => { if (active) { setQuote(null); setQuoteError(apiError(error)); } })
        .finally(() => { if (active) setQuoteBusy(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [open, form.centre_slug, form.centre_floor_id, form.guest_count, adjustmentAmount, validSchedule, quoteKey]);

  useEffect(() => {
    if (!open || !form.centre_slug || !validSchedule.length) { setAvailability({}); return; }
    let active = true;
    const dates = validSchedule.map((row) => row.date).sort();
    setAvailability(Object.fromEntries(form.booking_dates.filter((row) => row.date).map((row) => [row.key, { loading: true }])));
    getAvailability(form.centre_slug, { from: dates[0], to: dates[dates.length - 1], floor_id: form.centre_floor_id || undefined })
      .then((slots) => {
        if (!active) return;
        setAvailability(Object.fromEntries(form.booking_dates.filter((row) => row.date).map((row) => {
          const taken = (type) => slots.some((slot) => slot.date === row.date && slot.session_type === type && ["blocked", "booked"].includes(slot.status));
          const available = row.session_type === "full_day"
            ? !taken("full_day") && !taken("half_day_morning") && !taken("half_day_evening")
            : !taken(row.session_type) && !taken("full_day");
          return [row.key, { available }];
        })));
      })
      .catch(() => { if (active) setAvailability(Object.fromEntries(form.booking_dates.filter((row) => row.date).map((row) => [row.key, { available: null }]))); });
    return () => { active = false; };
  }, [open, form.centre_slug, form.centre_floor_id, validSchedule, form.booking_dates]);

  useEffect(() => {
    if (!open) return undefined;
    const keydown = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    document.addEventListener("keydown", keydown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", keydown); document.body.style.overflow = previous; };
  }, [open, busy, onClose]);

  if (!open) return null;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const paymentAmount = !quote ? 0 : form.payment_mode === "none" ? 0
    : form.payment_mode === "advance" ? Number(quote.advance_amount)
      : form.payment_mode === "custom" ? Number(form.custom_payment_amount || 0)
        : Number(quote.total_amount);
  const customPaymentInvalid = form.payment_mode === "custom" && (!paymentAmount || paymentAmount > Number(quote?.total_amount || 0));
  const dueLater = Math.max(Number(quote?.total_amount || 0) - paymentAmount, 0);
  const dateValues = form.booking_dates.map((row) => row.date).filter(Boolean);
  const hasDuplicateDates = new Set(dateValues).size !== dateValues.length;
  const scheduleComplete = form.booking_dates.length > 0 && form.booking_dates.every((row) => row.date);
  const scheduleUnavailable = form.booking_dates.some((row) => availability[row.key]?.available === false);
  const scheduleChecking = form.booking_dates.some((row) => row.date && availability[row.key]?.loading);
  const activeSchedule = form.booking_dates.find((row) => row.key === activeScheduleKey) || form.booking_dates[0];
  const floorMissing = !!selectedCentre?.floors?.length && !form.centre_floor_id;
  const canSubmit = !busy && !contextBusy && !!quote && quotedKey === quoteKey && !quoteBusy && scheduleComplete && !hasDuplicateDates && !scheduleUnavailable && !scheduleChecking && !customPaymentInvalid && !floorMissing;

  const updateSchedule = (key, field, value) => setForm((current) => ({ ...current, booking_dates: current.booking_dates.map((row) => row.key === key ? { ...row, [field]: value } : row) }));
  const removeSchedule = (key) => {
    const remaining = form.booking_dates.filter((row) => row.key !== key);
    if (!remaining.length) return;
    setForm((current) => ({ ...current, booking_dates: current.booking_dates.filter((row) => row.key !== key) }));
    if (activeScheduleKey === key) setActiveScheduleKey(remaining[0].key);
  };
  const addScheduleDate = () => {
    const dates = form.booking_dates.map((row) => row.date).filter(Boolean).sort();
    let next = "";
    if (dates.length) {
      next = addCalendarDays(dates[dates.length - 1]);
    }
    const row = newScheduleRow(next, form.booking_dates[form.booking_dates.length - 1]?.session_type || "full_day");
    setForm((current) => ({ ...current, booking_dates: [...current.booking_dates, row] }));
    setActiveScheduleKey(row.key);
  };

  // Step 1 — validate then show the preview (no booking is created yet).
  const submit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    if (!form.customer_name.trim()) return toast.error("Enter the customer name.");
    if (!form.customer_phone.trim()) return toast.error("Enter the customer phone.");
    if ((form.event_manager_name.trim() || form.event_manager_phone.trim()) && (!form.event_manager_name.trim() || !/^01[0-9]{9}$/.test(form.event_manager_phone.trim()))) return toast.error("Enter the event manager's name and a valid mobile number, or leave both blank.");
    if (!scheduleComplete) return toast.error("Choose every booking date.");
    if (hasDuplicateDates) return toast.error("Each booking date must be unique.");
    if (scheduleUnavailable) return toast.error("One or more selected dates are not available.");
    if (customPaymentInvalid) return toast.error("Enter a custom payment between ৳1 and the booking total.");
    if (adjustmentAmount && !form.adjustment_reason.trim()) return toast.error("Add a reason for the manual adjustment.");
    setPreview(true);
  };

  // Step 2 — actually create the booking after the preview is confirmed.
  const doCreate = async () => {
    if (!canSubmit) return toast.error("Wait for the current booking price and availability before confirming.");
    const payload = {
      centre_slug: form.centre_slug,
      centre_floor_id: form.centre_floor_id || undefined,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim() || null,
      event_date: form.booking_dates[0].date,
      session_type: form.booking_dates[0].session_type,
      booking_dates: form.booking_dates.map(({ date, session_type }) => ({ date, session_type })),
      guest_count: Number(form.guest_count),
      event_type: form.event_type.trim() || null,
      event_manager_name: form.event_manager_name.trim() || null,
      event_manager_phone: form.event_manager_phone.trim() || null,
      adjustment_amount: adjustmentAmount,
      adjustment_reason: adjustmentAmount ? form.adjustment_reason.trim() : null,
      notes: form.notes.trim() || null,
      mark_paid: form.payment_mode !== "none",
      payment_option: form.payment_mode === "full" ? "full" : "advance",
      payment_method: form.payment_method,
      custom_payment_amount: form.payment_mode === "custom" ? paymentAmount : null,
    };

    setBusy(true);
    try {
      const booking = mode === "admin" ? await adminCreateBooking(payload) : mode === "coordinator" ? await coordinatorCreateBooking(payload) : await ownerCreateBooking(payload);
      toast.success(`Booking ${booking.booking_no} created.`);
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(apiError(error));
      setPreview(false);
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} className="relative flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-6">
          <div>
            <h2 id="booking-modal-title" className="flex items-center gap-2 font-display text-xl font-bold text-slate-950 sm:text-2xl"><CalendarPlus className="h-6 w-6 text-brand-600" /> New booking</h2>
            <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">Build the package, verify availability, and choose exactly how much to collect.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50" aria-label="Close booking form"><X className="h-5 w-5" /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-[minmax(0,1.55fr)_minmax(320px,.85fr)]">
            <div className="space-y-6 p-4 sm:p-6 lg:border-r lg:border-slate-200">
              {mode !== "owner" && <Section icon={CalendarCheck2} title="Venue">
                <Field label="Community centre" required full>
                  <select className="input min-h-11" value={form.centre_slug} onChange={set("centre_slug")} required disabled={contextBusy}>
                    <option value="">Select a centre…</option>
                    {centres.map((centre) => <option key={centre.id} value={centre.slug}>{centre.name} · {centre.area}</option>)}
                  </select>
                </Field>
              </Section>}

              <Section icon={UserRound} title="Customer">
                <Field label="Customer name" required><input autoFocus className="input min-h-11" value={form.customer_name} onChange={set("customer_name")} autoComplete="name" required /></Field>
                <Field label="Customer phone" required><input type="tel" className="input min-h-11" value={form.customer_phone} onChange={set("customer_phone")} placeholder="01XXXXXXXXX" autoComplete="tel" required /></Field>
                <Field label="Event type"><select className="input min-h-11" value={form.event_type} onChange={set("event_type")}>{EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
                <Field label="Event manager name"><input className="input min-h-11" value={form.event_manager_name} onChange={set("event_manager_name")} maxLength={255} /></Field>
                <Field label="Event manager phone"><input type="tel" inputMode="tel" pattern="01[0-9]{9}" className="input min-h-11" value={form.event_manager_phone} onChange={set("event_manager_phone")} maxLength={11} placeholder="01XXXXXXXXX" /></Field>
              </Section>

              <Section icon={CalendarCheck2} title="Event schedule" action={<button type="button" onClick={addScheduleDate} disabled={form.booking_dates.length >= 30} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-40"><Plus className="h-4 w-4" /> Add date</button>}>
                <div className="col-span-full grid items-start gap-4 xl:grid-cols-[minmax(340px,1.15fr)_minmax(0,.85fr)]">
                  <AvailabilityCalendarPicker
                    slug={form.centre_slug}
                    floorId={form.centre_floor_id}
                    value={activeSchedule?.date || ""}
                    sessionType={activeSchedule?.session_type || "full_day"}
                    selectedDates={form.booking_dates.map((row) => row.date)}
                    onSelect={(date) => activeSchedule && updateSchedule(activeSchedule.key, "date", date)}
                  />
                  <div className="space-y-2">
                  {form.booking_dates.map((row, index) => {
                    const status = availability[row.key];
                    const duplicate = row.date && form.booking_dates.some((item) => item.key !== row.key && item.date === row.date);
                    const active = activeSchedule?.key === row.key;
                    return <div key={row.key} className={`rounded-xl border p-3 transition ${active ? "border-brand-400 bg-brand-50/40 ring-2 ring-brand-100" : duplicate || status?.available === false ? "border-rose-200 bg-rose-50/50" : "border-slate-200 bg-slate-50"}`}>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_44px]">
                        <label><span className="text-xs font-semibold text-slate-600">Date {index + 1}<span className="ml-0.5 text-rose-500">*</span></span><button type="button" onClick={() => setActiveScheduleKey(row.key)} className={`mt-1 flex min-h-11 w-full items-center justify-between rounded-lg border bg-white px-3 text-left text-sm transition ${active ? "border-brand-500 ring-2 ring-brand-100" : "border-slate-300 hover:border-brand-300"}`} aria-label={`Choose booking date ${index + 1} from availability calendar`}><span className={row.date ? "font-semibold text-slate-800" : "text-slate-400"}>{row.date ? formatDate(row.date) : "Select from calendar"}</span><CalendarDays className="h-4 w-4 text-slate-400" /></button><input type="hidden" value={row.date} required /></label>
                        <label><span className="text-xs font-semibold text-slate-600">Session<span className="ml-0.5 text-rose-500">*</span></span><select className="input mt-1 min-h-11 bg-white" value={row.session_type} onFocus={() => setActiveScheduleKey(row.key)} onChange={(event) => { setActiveScheduleKey(row.key); updateSchedule(row.key, "session_type", event.target.value); }}>{SESSIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                        <button type="button" onClick={() => removeSchedule(row.key)} disabled={form.booking_dates.length === 1} className="mt-auto grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-rose-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-25" aria-label={`Remove date ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 min-h-5 text-xs">
                        {!row.date ? <span className="text-slate-400">Choose a date to check availability.</span>
                          : duplicate ? <span className="font-semibold text-rose-700">This date is already in the schedule.</span>
                            : status?.loading ? <span className="text-slate-500">Checking availability…</span>
                              : status?.available === true ? <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> Available</span>
                                : status?.available === false ? <span className="font-semibold text-rose-700">Blocked or already booked.</span>
                                  : <span className="text-amber-700">Availability will be rechecked on submit.</span>}
                      </div>
                    </div>;
                  })}
                  </div>
                </div>
                {!!selectedCentre?.floors?.length && (
                  <Field label="Floor" required full>
                    <select className="input min-h-11" value={form.centre_floor_id} onChange={set("centre_floor_id")} required>
                      <option value="">Select a floor…</option>
                      {selectedCentre.floors.map((f) => (
                        <option key={f.id} value={f.id}>{f.name} — up to {f.capacity} guests · ৳{Number(f.full_day_price).toLocaleString()} full day</option>
                      ))}
                    </select>
                    <Help>This venue books by floor. Each floor has its own capacity, pricing and availability.</Help>
                  </Field>
                )}
                <Field label="Guests per date" required full><div className="flex flex-wrap gap-2">{[50, 100, 200, 300].filter((count) => !effCapacity || count <= effCapacity).map((count) => <button key={count} type="button" onClick={() => setForm((current) => ({ ...current, guest_count: count }))} aria-pressed={Number(form.guest_count) === count} className={`min-h-10 rounded-lg border px-3 text-sm font-semibold ${Number(form.guest_count) === count ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:border-brand-300"}`}>{count}</button>)}</div><input type="number" className="input mt-2 min-h-11" min="1" max={effCapacity || undefined} value={form.guest_count} onChange={set("guest_count")} required /><Help>{effCapacity ? `${selectedFloor ? `${selectedFloor.name} capacity` : "Venue capacity"}: ${Number(effCapacity).toLocaleString()} guests.` : "Enter the expected attendance for each date."}</Help></Field>
              </Section>

              {mode !== "coordinator" && <Section icon={BadgeDollarSign} title="Manual adjustment">
                <label className="col-span-full flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <span><span className="block text-sm font-semibold text-slate-800">Add a discount or extra charge</span><span className="block text-xs text-slate-500">The reason is stored on the booking for auditability.</span></span>
                  <input type="checkbox" checked={form.has_adjustment} onChange={set("has_adjustment")} className="h-5 w-5 accent-brand-600" />
                </label>
                {form.has_adjustment && <>
                  <Field label="Adjustment type"><select className="input min-h-11" value={form.adjustment_type} onChange={set("adjustment_type")}><option value="discount">Discount</option><option value="surcharge">Extra charge</option></select></Field>
                  <Field label="Amount" required><input type="number" min="0.01" step="0.01" className="input min-h-11" value={form.adjustment_value} onChange={set("adjustment_value")} required /></Field>
                  <Field label="Reason" required full><input className="input min-h-11" value={form.adjustment_reason} onChange={set("adjustment_reason")} placeholder="e.g. ICCMS partner discount" required /></Field>
                </>}
              </Section>}

              <Section icon={ReceiptText} title="Internal note">
                <Field label="Booking note" full><textarea rows="3" className="input resize-none" value={form.notes} onChange={set("notes")} placeholder="Setup instructions, contact preference, special access requirements…" /></Field>
              </Section>
            </div>

            <aside className="bg-slate-50 p-4 sm:p-6">
              <div className="space-y-5 lg:sticky lg:top-0">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">Payment plan</h3>
                  <p className="mt-0.5 text-xs text-slate-500">The booking can be created without collecting payment.</p>
                </div>
                {mode !== "coordinator" && <div className="grid grid-cols-2 gap-2">
                  <PaymentChoice value="none" label="Pay later" hint="৳0 now" form={form} setForm={setForm} />
                  <PaymentChoice value="advance" label="Advance" hint={`${quote?.advance_rate || 30}% now`} form={form} setForm={setForm} />
                  <PaymentChoice value="full" label="Full payment" hint="Clear balance" form={form} setForm={setForm} />
                  <PaymentChoice value="custom" label="Custom amount" hint="Choose amount" form={form} setForm={setForm} />
                </div>}
                {mode !== "coordinator" && form.payment_mode === "custom" && <Field label="Amount to collect now" required full><input type="number" min="1" max={quote?.total_amount || undefined} step="0.01" className={`input min-h-11 bg-white ${customPaymentInvalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : ""}`} value={form.custom_payment_amount} onChange={set("custom_payment_amount")} required />{customPaymentInvalid && <p className="mt-1 text-xs font-medium text-rose-600">Enter an amount up to {taka(quote?.total_amount || 0)}.</p>}</Field>}
                {mode !== "coordinator" && form.payment_mode !== "none" && <Field label="Payment method" required full><select className="input min-h-11 bg-white" value={form.payment_method} onChange={set("payment_method")}>{METHODS.map((method) => <option key={method}>{method}</option>)}</select></Field>}

                <div className="rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Price summary</span>{quoteBusy && <span className="text-xs text-slate-400">Updating…</span>}</div>
                  {quoteError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{quoteError}</p> : !quote ? <p className="py-8 text-center text-sm text-slate-400">Select a centre and package to calculate pricing.</p> : <div className="space-y-2 text-sm">
                    <MoneyRow label={`Venue · ${quote.date_count || 1} date${Number(quote.date_count || 1) > 1 ? "s" : ""}`} value={quote.venue_amount} />
                    <MoneyRow label={`Service fee · ${quote.commission_rate}%`} value={quote.service_charge} />
                    <MoneyRow label="VAT" value={quote.vat_amount} />
                    {!!Number(quote.adjustment_amount) && <MoneyRow label={Number(quote.adjustment_amount) < 0 ? "Discount" : "Extra charge"} value={quote.adjustment_amount} accent={Number(quote.adjustment_amount) < 0 ? "discount" : "charge"} signed />}
                    <div className="border-t border-slate-200 pt-2"><MoneyRow label="Booking total" value={quote.total_amount} strong /></div>
                    <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-emerald-900"><MoneyRow label="Collecting now" value={paymentAmount} strong /></div>
                    {dueLater > 0 && <MoneyRow label="Due later" value={dueLater} muted />}
                  </div>}
                </div>
              </div>
            </aside>
          </div>
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="text-sm text-slate-500"><span className="font-semibold text-slate-800">{quote ? taka(quote.total_amount) : "Pricing pending"}</span>{` · ${validSchedule.length || 1} date${(validSchedule.length || 1) > 1 ? "s" : ""}`}{form.payment_mode === "none" ? " · payment due later" : ` · collecting ${taka(paymentAmount)} now`}</div>
          <div className="flex gap-2"><button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">Cancel</button><button disabled={!canSubmit} className="min-h-11 flex-1 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">Review booking</button></div>
        </footer>

        {/* Preview / confirmation step */}
        {preview && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setPreview(false); }}>
            <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900">Confirm new booking</h3>
                  <p className="text-xs text-slate-500">Review the details before creating.</p>
                </div>
                <button type="button" onClick={() => setPreview(false)} disabled={busy} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4 text-sm">
                <PreviewRow label="Customer" value={form.customer_name} />
                <PreviewRow label="Phone" value={form.customer_phone} />
                {form.customer_email && <PreviewRow label="Email" value={form.customer_email} />}
                {selectedFloor && <PreviewRow label="Floor" value={selectedFloor.name} />}
                <PreviewRow label="Event" value={`${form.event_type || "—"} · ${form.guest_count} guests`} />
                {form.event_manager_name && <PreviewRow label="Event manager" value={`${form.event_manager_name} · ${form.event_manager_phone}`} />}

                <div className="my-3 rounded-xl bg-slate-50 p-3">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule ({validSchedule.length || 1})</div>
                  {(validSchedule.length ? validSchedule : form.booking_dates).map((d, i) => (
                    <div key={i} className="flex justify-between py-0.5"><span className="font-semibold text-slate-700">{d.date || "—"}</span><span className="capitalize text-slate-500">{(d.session_type || "").replaceAll("_", " ") || "—"}</span></div>
                  ))}
                </div>

                {quote && (
                  <div className="space-y-1 rounded-xl border border-slate-200 p-3">
                    <div className="flex justify-between text-slate-600"><span>Venue</span><span>{taka(quote.venue_amount)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>Service charge</span><span>{taka(quote.service_charge)}</span></div>
                    <div className="flex justify-between text-slate-600"><span>VAT</span><span>{taka(quote.vat_amount)}</span></div>
                    <div className="mt-1 flex justify-between border-t border-slate-100 pt-1 text-base font-extrabold text-slate-900"><span>Total</span><span>{taka(quote.total_amount)}</span></div>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-brand-700">{form.payment_mode === "none" ? "Pay later" : `Collecting now · ${form.payment_method}`}</div>
                    <div className="text-lg font-extrabold text-brand-800">{form.payment_mode === "none" ? "৳0" : taka(paymentAmount)}</div>
                  </div>
                  {form.payment_mode !== "none" && quote && paymentAmount < Number(quote.total_amount) && (
                    <div className="text-right text-xs text-slate-500">Due later<div className="font-semibold text-amber-700">{taka(Number(quote.total_amount) - paymentAmount)}</div></div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setPreview(false)} disabled={busy} className="min-h-11 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Back</button>
                <button type="button" onClick={doCreate} disabled={busy} className="min-h-11 flex-1 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">{busy ? "Creating…" : form.payment_mode === "none" ? "Confirm & create" : `Confirm & collect ${taka(paymentAmount)}`}</button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

function PreviewRow({ label, value }) {
  return <div className="flex justify-between border-b border-slate-50 py-1.5"><span className="text-slate-400">{label}</span><span className="font-semibold text-slate-800">{value}</span></div>;
}

function Section({ icon: Icon, title, action, children }) {
  return <fieldset><legend className="mb-3 flex w-full items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-sm font-bold text-slate-900"><span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></span>{title}</span>{action}</legend><div className="grid gap-3 sm:grid-cols-2">{children}</div></fieldset>;
}
function Field({ label, required, full, children }) { return <label className={full ? "block sm:col-span-2" : "block"}><span className="text-xs font-semibold text-slate-600">{label}{required && <span className="ml-0.5 text-rose-500" aria-hidden="true">*</span>}</span><div className="mt-1">{children}</div></label>; }
function Help({ children }) { return <p className="mt-1 text-xs text-slate-400">{children}</p>; }
function PaymentChoice({ value, label, hint, form, setForm }) { const selected = form.payment_mode === value; return <label className={`cursor-pointer rounded-xl border p-3 transition ${selected ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 bg-white hover:border-slate-300"}`}><input type="radio" name="payment_mode" value={value} checked={selected} onChange={(event) => setForm((current) => ({ ...current, payment_mode: event.target.value }))} className="sr-only" /><span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold text-slate-800">{label}</span>{selected && <Check className="h-4 w-4 text-brand-600" />}</span><span className="mt-1 block text-xs text-slate-500">{hint}</span></label>; }
function MoneyRow({ label, value, strong, muted, signed, accent }) { const numeric = Number(value || 0); const shown = signed && numeric > 0 ? `+${taka(numeric)}` : taka(numeric); return <div className={`flex items-center justify-between gap-3 tabular-nums ${strong ? "text-base font-extrabold text-slate-950" : muted ? "text-slate-400" : accent === "discount" ? "text-emerald-700" : accent === "charge" ? "text-amber-700" : "text-slate-600"}`}><span>{label}</span><span>{shown}</span></div>; }
function formatDate(value) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }); }
function apiError(error) { return error.response?.data?.errors ? Object.values(error.response.data.errors)[0][0] : error.response?.data?.message || "Could not create booking."; }
