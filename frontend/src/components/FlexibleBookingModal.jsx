import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign, CalendarCheck2, CalendarPlus, CalendarDays, Check,
  Plus, ReceiptText, Trash2, UserRound, UtensilsCrossed, X,
} from "lucide-react";
import {
  adminCreateBooking, getAvailability, getCentre, getCentres, ownerCentreMenus,
  ownerCreateBooking, ownerProfile, quoteBooking,
} from "../services/api";
import { taka } from "../lib/format";
import { toast } from "../store/toastStore";
import AvailabilityCalendarPicker from "./AvailabilityCalendarPicker";

const SESSIONS = [
  ["full_day", "Full day"],
  ["half_day_morning", "Morning half-day"],
  ["half_day_evening", "Evening half-day"],
];
const METHODS = ["Cash", "bKash", "Nagad", "Bank Transfer", "Card", "SSLCommerz"];
const EVENT_TYPES = ["Wedding", "Reception", "Corporate event", "Conference", "Seminar", "Birthday", "Community programme", "Other"];
const newScheduleRow = (date = "", session_type = "full_day") => ({ key: crypto.randomUUID(), date, session_type });

const initialForm = (mode) => ({
  centre_slug: "",
  customer_name: "",
  customer_phone: "",
  customer_email: "",
  event_type: "Wedding",
  booking_dates: [newScheduleRow()],
  guest_count: 100,
  payment_mode: mode === "owner" ? "advance" : "full",
  payment_method: "Cash",
  custom_payment_amount: "",
  has_adjustment: false,
  adjustment_type: "discount",
  adjustment_value: "",
  adjustment_reason: "",
  notes: "",
});

export default function FlexibleBookingModal({ open, onClose, onCreated, mode }) {
  const [form, setForm] = useState(() => initialForm(mode));
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [menus, setMenus] = useState([]);
  const [foods, setFoods] = useState([]);
  const [quote, setQuote] = useState(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [availability, setAvailability] = useState({});
  const [contextBusy, setContextBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [activeScheduleKey, setActiveScheduleKey] = useState(null);

  useEffect(() => {
    if (!open) return;
    const fresh = initialForm(mode);
    setForm(fresh);
    setActiveScheduleKey(fresh.booking_dates[0].key);
    setFoods([]);
    setQuote(null);
    setQuoteError("");
    setAvailability({});
    setContextBusy(true);

    if (mode === "owner") {
      Promise.all([ownerProfile(), ownerCentreMenus()])
        .then(([centre, rows]) => {
          const active = rows.filter((item) => item.status === "active");
          setSelectedCentre({ ...centre, food_menus: active });
          setMenus(active);
          setForm((current) => ({ ...current, centre_slug: centre.slug }));
        })
        .catch(() => toast.error("Could not load centre booking options."))
        .finally(() => setContextBusy(false));
    } else {
      getCentres({ sort: "rating" })
        .then(setCentres)
        .catch(() => setCentres([]))
        .finally(() => setContextBusy(false));
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "admin" || !form.centre_slug) {
      if (mode === "admin") { setSelectedCentre(null); setMenus([]); }
      return;
    }
    setContextBusy(true);
    getCentre(form.centre_slug)
      .then((centre) => {
        setSelectedCentre(centre);
        setMenus((centre.food_menus || []).filter((item) => item.status !== "inactive"));
        setFoods([]);
      })
      .catch(() => { setSelectedCentre(null); setMenus([]); })
      .finally(() => setContextBusy(false));
  }, [open, mode, form.centre_slug]);

  const adjustmentAmount = useMemo(() => {
    if (!form.has_adjustment || !form.adjustment_value) return 0;
    const value = Math.abs(Number(form.adjustment_value) || 0);
    return form.adjustment_type === "discount" ? -value : value;
  }, [form.has_adjustment, form.adjustment_type, form.adjustment_value]);

  const foodSelections = useMemo(
    () => foods.filter((row) => row.food_menu_id).map((row) => ({
      food_menu_id: Number(row.food_menu_id),
      quantity: Math.max(1, Number(row.quantity) || Number(form.guest_count) || 1),
    })),
    [foods, form.guest_count]
  );

  const validSchedule = useMemo(
    () => form.booking_dates.filter((row) => row.date).map(({ date, session_type }) => ({ date, session_type })),
    [form.booking_dates]
  );

  useEffect(() => {
    if (!open || !form.centre_slug || !form.guest_count) { setQuote(null); return; }
    const timer = setTimeout(() => {
      setQuoteBusy(true);
      setQuoteError("");
      quoteBooking({
        centre_slug: form.centre_slug,
        session_type: validSchedule[0]?.session_type || "full_day",
        guest_count: Number(form.guest_count),
        food_selections: foodSelections,
        adjustment_amount: adjustmentAmount,
        booking_dates: validSchedule.length ? validSchedule : undefined,
      })
        .then(setQuote)
        .catch((error) => { setQuote(null); setQuoteError(apiError(error)); })
        .finally(() => setQuoteBusy(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, form.centre_slug, form.guest_count, foodSelections, adjustmentAmount, validSchedule]);

  useEffect(() => {
    if (!open || !form.centre_slug || !validSchedule.length) { setAvailability({}); return; }
    const dates = validSchedule.map((row) => row.date).sort();
    setAvailability(Object.fromEntries(form.booking_dates.filter((row) => row.date).map((row) => [row.key, { loading: true }])));
    getAvailability(form.centre_slug, { from: dates[0], to: dates[dates.length - 1] })
      .then((slots) => {
        setAvailability(Object.fromEntries(form.booking_dates.filter((row) => row.date).map((row) => {
          const taken = (type) => slots.some((slot) => slot.date === row.date && slot.session_type === type && ["blocked", "booked"].includes(slot.status));
          const available = row.session_type === "full_day"
            ? !taken("full_day") && !taken("half_day_morning") && !taken("half_day_evening")
            : !taken(row.session_type) && !taken("full_day");
          return [row.key, { available }];
        })));
      })
      .catch(() => setAvailability(Object.fromEntries(form.booking_dates.filter((row) => row.date).map((row) => [row.key, { available: null }]))));
  }, [open, form.centre_slug, validSchedule, form.booking_dates]);

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
  const canSubmit = !busy && !contextBusy && !!quote && !quoteBusy && scheduleComplete && !hasDuplicateDates && !scheduleUnavailable && !scheduleChecking && !customPaymentInvalid;

  const addFood = () => {
    const used = new Set(foods.map((row) => String(row.food_menu_id)));
    const first = menus.find((menu) => !used.has(String(menu.id)));
    if (!first) return toast.info("All active menus are already selected.");
    setFoods((rows) => [...rows, { key: crypto.randomUUID(), food_menu_id: String(first.id), quantity: Number(form.guest_count) || 1 }]);
  };
  const updateFood = (key, field, value) => setFoods((rows) => rows.map((row) => row.key === key ? { ...row, [field]: value } : row));
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
      const date = new Date(`${dates[dates.length - 1]}T00:00:00`);
      date.setDate(date.getDate() + 1);
      next = date.toISOString().slice(0, 10);
    }
    const row = newScheduleRow(next, form.booking_dates.at(-1)?.session_type || "full_day");
    setForm((current) => ({ ...current, booking_dates: [...current.booking_dates, row] }));
    setActiveScheduleKey(row.key);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!scheduleComplete) return toast.error("Choose every booking date.");
    if (hasDuplicateDates) return toast.error("Each booking date must be unique.");
    if (scheduleUnavailable) return toast.error("One or more selected dates are not available.");
    if (customPaymentInvalid) return toast.error("Enter a custom payment between ৳1 and the booking total.");
    if (adjustmentAmount && !form.adjustment_reason.trim()) return toast.error("Add a reason for the manual adjustment.");

    const payload = {
      centre_slug: form.centre_slug,
      customer_name: form.customer_name.trim(),
      customer_phone: form.customer_phone.trim(),
      customer_email: form.customer_email.trim() || null,
      event_date: form.booking_dates[0].date,
      session_type: form.booking_dates[0].session_type,
      booking_dates: form.booking_dates.map(({ date, session_type }) => ({ date, session_type })),
      guest_count: Number(form.guest_count),
      event_type: form.event_type.trim() || null,
      food_selections: foodSelections,
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
      const booking = mode === "admin" ? await adminCreateBooking(payload) : await ownerCreateBooking(payload);
      toast.success(`Booking ${booking.booking_no} created.`);
      onCreated?.();
      onClose();
    } catch (error) {
      toast.error(apiError(error));
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/65 p-2 backdrop-blur-sm sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form onSubmit={submit} className="flex max-h-[96dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl" role="dialog" aria-modal="true" aria-labelledby="booking-modal-title">
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
              {mode === "admin" && <Section icon={CalendarCheck2} title="Venue">
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
                <Field label="Email"><input type="email" className="input min-h-11" value={form.customer_email} onChange={set("customer_email")} autoComplete="email" /></Field>
                <Field label="Event type"><input className="input min-h-11" list="event-types" value={form.event_type} onChange={set("event_type")} /><datalist id="event-types">{EVENT_TYPES.map((type) => <option key={type} value={type} />)}</datalist></Field>
              </Section>

              <Section icon={CalendarCheck2} title="Event schedule" action={<button type="button" onClick={addScheduleDate} disabled={form.booking_dates.length >= 30} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-40"><Plus className="h-4 w-4" /> Add date</button>}>
                <div className="col-span-full grid items-start gap-4 xl:grid-cols-[minmax(0,.85fr)_minmax(340px,1.15fr)]">
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
                  <AvailabilityCalendarPicker
                    slug={form.centre_slug}
                    value={activeSchedule?.date || ""}
                    sessionType={activeSchedule?.session_type || "full_day"}
                    selectedDates={form.booking_dates.map((row) => row.date)}
                    onSelect={(date) => activeSchedule && updateSchedule(activeSchedule.key, "date", date)}
                  />
                </div>
                <Field label="Guests per date" required full><input type="number" className="input min-h-11" min="1" max={selectedCentre?.capacity || undefined} value={form.guest_count} onChange={set("guest_count")} required /><Help>{selectedCentre?.capacity ? `Venue capacity: ${Number(selectedCentre.capacity).toLocaleString()} guests. Catering quantities are charged for every selected date.` : "Enter the expected attendance for each date."}</Help></Field>
              </Section>

              <Section icon={UtensilsCrossed} title="Catering" action={<button type="button" onClick={addFood} disabled={!menus.length || foods.length >= menus.length} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand-50 px-3 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> Add menu</button>}>
                <div className="col-span-full space-y-2">
                  {!foods.length ? <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No catering selected. Add one or several menus with independent quantities.</div> : foods.map((row, index) => (
                    <div key={row.key} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_130px_44px]">
                      <label><span className="text-xs font-semibold text-slate-500">Menu {index + 1}</span><select className="input mt-1 min-h-11 bg-white" value={row.food_menu_id} onChange={(event) => updateFood(row.key, "food_menu_id", event.target.value)}>{menus.map((menu) => <option key={menu.id} value={menu.id} disabled={foods.some((item) => item.key !== row.key && String(item.food_menu_id) === String(menu.id))}>{menu.name} · {taka(menu.price_per_person)}/person</option>)}</select></label>
                      <label><span className="text-xs font-semibold text-slate-500">Quantity</span><input type="number" min="1" className="input mt-1 min-h-11 bg-white" value={row.quantity} onChange={(event) => updateFood(row.key, "quantity", event.target.value)} /></label>
                      <button type="button" onClick={() => setFoods((rows) => rows.filter((item) => item.key !== row.key))} className="mt-auto grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove menu ${index + 1}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </Section>

              <Section icon={BadgeDollarSign} title="Manual adjustment">
                <label className="col-span-full flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
                  <span><span className="block text-sm font-semibold text-slate-800">Add a discount or extra charge</span><span className="block text-xs text-slate-500">The reason is stored on the booking for auditability.</span></span>
                  <input type="checkbox" checked={form.has_adjustment} onChange={set("has_adjustment")} className="h-5 w-5 accent-brand-600" />
                </label>
                {form.has_adjustment && <>
                  <Field label="Adjustment type"><select className="input min-h-11" value={form.adjustment_type} onChange={set("adjustment_type")}><option value="discount">Discount</option><option value="surcharge">Extra charge</option></select></Field>
                  <Field label="Amount" required><input type="number" min="0.01" step="0.01" className="input min-h-11" value={form.adjustment_value} onChange={set("adjustment_value")} required /></Field>
                  <Field label="Reason" required full><input className="input min-h-11" value={form.adjustment_reason} onChange={set("adjustment_reason")} placeholder="e.g. DSCC partner discount" required /></Field>
                </>}
              </Section>

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
                <div className="grid grid-cols-2 gap-2">
                  <PaymentChoice value="none" label="Pay later" hint="৳0 now" form={form} setForm={setForm} />
                  <PaymentChoice value="advance" label="Advance" hint={`${quote?.advance_rate || 30}% now`} form={form} setForm={setForm} />
                  <PaymentChoice value="full" label="Full payment" hint="Clear balance" form={form} setForm={setForm} />
                  <PaymentChoice value="custom" label="Custom amount" hint="Choose amount" form={form} setForm={setForm} />
                </div>
                {form.payment_mode === "custom" && <Field label="Amount to collect now" required full><input type="number" min="1" max={quote?.total_amount || undefined} step="0.01" className={`input min-h-11 bg-white ${customPaymentInvalid ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100" : ""}`} value={form.custom_payment_amount} onChange={set("custom_payment_amount")} required />{customPaymentInvalid && <p className="mt-1 text-xs font-medium text-rose-600">Enter an amount up to {taka(quote?.total_amount || 0)}.</p>}</Field>}
                {form.payment_mode !== "none" && <Field label="Payment method" required full><select className="input min-h-11 bg-white" value={form.payment_method} onChange={set("payment_method")}>{METHODS.map((method) => <option key={method}>{method}</option>)}</select></Field>}

                <div className="rounded-2xl border border-slate-200 bg-white p-4" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider text-slate-400">Price summary</span>{quoteBusy && <span className="text-xs text-slate-400">Updating…</span>}</div>
                  {quoteError ? <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{quoteError}</p> : !quote ? <p className="py-8 text-center text-sm text-slate-400">Select a centre and package to calculate pricing.</p> : <div className="space-y-2 text-sm">
                    <MoneyRow label={`Venue · ${quote.date_count || 1} date${Number(quote.date_count || 1) > 1 ? "s" : ""}`} value={quote.venue_amount} />
                    <MoneyRow label={`Catering${quote.food_lines?.length ? ` · ${quote.food_lines.length} menu${quote.food_lines.length > 1 ? "s" : ""}` : ""}`} value={quote.food_amount} />
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
          <div className="flex gap-2"><button type="button" onClick={onClose} disabled={busy} className="min-h-11 flex-1 rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 sm:flex-none">Cancel</button><button disabled={!canSubmit} className="min-h-11 flex-1 rounded-xl bg-brand-600 px-6 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-none">{busy ? "Creating…" : form.payment_mode === "none" ? "Create booking" : `Create & collect ${taka(paymentAmount)}`}</button></div>
        </footer>
      </form>
    </div>
  );
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
