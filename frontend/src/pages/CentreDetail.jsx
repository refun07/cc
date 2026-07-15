import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCentre, quoteBooking } from "../services/api";
import { useBookingStore } from "../store/bookingStore";
import { taka, sessionLabel } from "../lib/format";
import { facilityIcon } from "../lib/facilityIcons";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { clientKey } from "../lib/clientKey";
import AvailabilityCalendarPicker from "../components/AvailabilityCalendarPicker";
import Lightbox from "../components/Lightbox";
import { Expand, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight, Play, ArrowUpRight } from "lucide-react";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=70";
const VIRTUAL_TOUR_URL = "https://fourcornersbd.com/360/bbq/";

const EVENT_TYPES = [
  "Wedding", "Reception", "Holud / Mehendi", "Engagement", "Anniversary",
  "Birthday", "Aqiqah", "Corporate Event", "Conference", "Seminar",
  "Workshop", "Product Launch", "Cultural Programme", "Community Gathering",
  "Charity / Fundraiser", "Religious Programme", "Reunion", "Other",
];

const SESSIONS = [
  { value: "full_day", label: "Full Day", note: "Whole-day access" },
  { value: "half_day_morning", label: "Half Day · Morning", note: "Morning session" },
  { value: "half_day_evening", label: "Half Day · Evening", note: "Evening session" },
];

const newDateRow = (date = "", session_type = "full_day") => ({ key: clientKey(), date, session_type });
const fmtDate = (v) => new Date(`${v}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" });

export default function CentreDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const setDraft = useBookingStore((s) => s.setDraft);

  const [centre, setCentre] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [brokenImg, setBrokenImg] = useState({});
  const [dateError, setDateError] = useState(false);

  const [bookingDates, setBookingDates] = useState(() => [newDateRow()]);
  const [activeKey, setActiveKey] = useState(null);
  const [guestCount, setGuestCount] = useState(100);
  const [eventType, setEventType] = useState("Wedding");
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);
  const [floorId, setFloorId] = useState(null);

  useEffect(() => {
    getCentre(slug).then((c) => {
      setCentre(c);
      const firstFloor = c.floors?.[0] || null;
      setFloorId(firstFloor?.id ?? null);
      setGuestCount(Math.min(100, firstFloor?.capacity || c.capacity));
    });
  }, [slug]);

  // A floor, when the venue has them, overrides capacity and pricing.
  const floors = centre?.floors || [];
  const selectedFloor = floors.find((f) => f.id === floorId) || null;
  const effCapacity = selectedFloor?.capacity || centre?.capacity || 0;
  const effHalfDay = selectedFloor?.half_day_price ?? centre?.half_day_price;
  const effFullDay = selectedFloor?.full_day_price ?? centre?.full_day_price;

  const foodSelections = useMemo(
    () => (selectedMenu ? [{ food_menu_id: selectedMenu, quantity: Number(guestCount) }] : []),
    [selectedMenu, guestCount]
  );

  const validSchedule = useMemo(
    () => bookingDates.filter((r) => r.date).map(({ date, session_type }) => ({ date, session_type })),
    [bookingDates]
  );
  const scheduleKey = useMemo(() => JSON.stringify(validSchedule), [validSchedule]);
  const activeRow = bookingDates.find((r) => r.key === activeKey) || bookingDates[0];

  // live quote
  useEffect(() => {
    if (!centre || !guestCount || !validSchedule.length) { setQuote(null); return; }
    setQuoting(true);
    const t = setTimeout(() => {
      quoteBooking({
        centre_slug: centre.slug,
        centre_floor_id: floorId,
        session_type: validSchedule[0].session_type,
        guest_count: Number(guestCount),
        food_selections: foodSelections,
        booking_dates: validSchedule,
      })
        .then(setQuote)
        .finally(() => setQuoting(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre, guestCount, foodSelections, scheduleKey, floorId]);

  // Keep the guest count inside the selected floor's capacity.
  useEffect(() => {
    if (effCapacity > 0 && guestCount > effCapacity) setGuestCount(effCapacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effCapacity]);

  // Auto-advance the main gallery image one after another.
  const imageCount = centre?.images?.length || (centre?.cover_image ? 1 : 0);
  useEffect(() => {
    if (imageCount <= 1 || galleryPaused || lightboxIndex !== null) return undefined;
    const id = setInterval(() => setActiveImg((i) => (i + 1) % imageCount), 4000);
    return () => clearInterval(id);
  }, [imageCount, galleryPaused, lightboxIndex]);

  if (!centre) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-slate-400">Loading…</div>;
  }

  const images = centre.images?.length
    ? centre.images.map((i) => i.image_path)
    : [centre.cover_image];

  const updateRow = (key, field, value) =>
    setBookingDates((rows) => rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  const removeRow = (key) =>
    setBookingDates((rows) => (rows.length > 1 ? rows.filter((r) => r.key !== key) : rows));
  const addRow = () => {
    const taken = new Set(bookingDates.map((r) => r.date).filter(Boolean));
    let next = "";
    if (taken.size) {
      const d = new Date(`${[...taken].sort().pop()}T00:00:00`);
      do { d.setDate(d.getDate() + 1); next = d.toISOString().slice(0, 10); } while (taken.has(next));
    }
    const row = newDateRow(next, bookingDates[bookingDates.length - 1]?.session_type || "full_day");
    setBookingDates((rows) => [...rows, row]);
    setActiveKey(row.key);
  };

  const dateList = bookingDates.map((r) => r.date).filter(Boolean);
  const hasDuplicates = new Set(dateList).size !== dateList.length;
  const hasEmptyRow = bookingDates.some((r) => !r.date);

  const proceed = () => {
    if (!validSchedule.length || hasDuplicates) {
      setDateError(true);
      document.getElementById("booking-widget")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setDateError(false);
    setDraft({
      centre: { slug: centre.slug, name: centre.name, area: centre.area },
      floorId,
      floorName: selectedFloor?.name || null,
      sessionType: validSchedule[0].session_type,
      eventDate: validSchedule[0].date,
      bookingDates: validSchedule,
      guestCount: Number(guestCount),
      eventType,
      foodSelections,
      menuName: centre.food_menus.find((m) => m.id === selectedMenu)?.name || null,
      quote,
    });
    nav("/checkout");
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      {/* Gallery */}
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div
          onMouseEnter={() => setGalleryPaused(true)}
          onMouseLeave={() => setGalleryPaused(false)}
          className="group relative h-72 md:h-96 rounded-2xl overflow-hidden bg-slate-100"
        >
          <button
            type="button"
            onClick={() => setLightboxIndex(activeImg)}
            aria-label="View larger image"
            className="absolute inset-0 h-full w-full cursor-zoom-in"
          >
            {images.map((img, i) => (
              <img
                key={i}
                src={brokenImg[i] ? FALLBACK_IMG : img}
                alt={`${centre.name} ${i + 1}`}
                onError={() => setBrokenImg((b) => (b[i] ? b : { ...b, [i]: true }))}
                className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out group-hover:scale-105 ${i === activeImg ? "opacity-100" : "opacity-0"}`}
              />
            ))}
          </button>

          {centre.is_verified && (
            <span className="pointer-events-none absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow">
              ✓ DSCC Verified
            </span>
          )}
          <span className="pointer-events-none absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
            <Expand className="h-4 w-4" /> Click to enlarge
          </span>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveImg((i) => (i - 1 + images.length) % images.length)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-slate-700 opacity-0 shadow transition hover:bg-white group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    aria-label={`Show image ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === activeImg ? "w-6 bg-white" : "w-1.5 bg-white/60 hover:bg-white/90"}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="grid grid-cols-4 lg:grid-cols-2 gap-3">
          {images.slice(0, 4).map((img, i) => (
            <button
              key={i}
              onClick={() => { setActiveImg(i); setLightboxIndex(i); }}
              aria-label={`View image ${i + 1} enlarged`}
              className={`group relative h-20 lg:h-[11.25rem] cursor-zoom-in overflow-hidden rounded-xl border-2 transition ${
                activeImg === i ? "border-brand-500" : "border-transparent hover:border-slate-200"
              }`}
            >
              <img src={brokenImg[i] ? FALLBACK_IMG : img} alt="" onError={() => setBrokenImg((b) => (b[i] ? b : { ...b, [i]: true }))} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
            </button>
          ))}
        </div>
      </div>

      <Lightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndex={(i) => { setLightboxIndex(i); setActiveImg(i); }}
      />

      <div className="mt-8 grid lg:grid-cols-[1fr_380px] gap-8">
        {/* Main */}
        <div className="space-y-8">
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-3xl font-extrabold text-slate-900">{centre.name}</h1>
                <p className="text-slate-500 mt-1">📍 {centre.address}</p>
              </div>
              <div className="text-right">
                <div className="text-amber-500 font-bold">★ {Number(centre.rating).toFixed(1)}</div>
                <div className="text-xs text-slate-400">Capacity {effCapacity} guests{selectedFloor ? ` · ${selectedFloor.name}` : ""}</div>
              </div>
            </div>
            <div
              className="rich-text mt-4 text-slate-600 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(centre.description || "") }}
            />
          </div>

          {/* Virtual tour */}
          <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-5 shadow-lg shadow-slate-900/20 sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-500/30 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <span className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/10 text-white ring-1 ring-white/15">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-xl bg-brand-400/30 motion-reduce:animate-none" />
                <Play className="relative h-5 w-5 fill-white" />
              </span>
              <div>
                <div className="inline-flex items-center gap-2">
                  <span className="font-bold text-white">Virtual Tour Available</span>
                  <span className="rounded-full bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-200 ring-1 ring-brand-400/30">360°</span>
                </div>
                <p className="mt-0.5 text-sm text-slate-300">Step inside and explore the venue before you book.</p>
              </div>
            </div>
            <a
              href={VIRTUAL_TOUR_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open 360 degree virtual tour for ${centre.name}`}
              className="relative inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900 active:scale-95 sm:w-auto"
            >
              Open Virtual Tour <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>

          {/* Facilities */}
          <Section title="Venue facilities">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {centre.facilities.map((f) => {
                const Icon = facilityIcon(f.name, f.icon);
                return (
                  <div key={f.name} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm ring-1 ring-slate-200/70">
                    <Icon className="h-4 w-4 shrink-0 text-brand-600" /> {f.name}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Session packages */}
          <Section title="Session packages">
            <div className="grid sm:grid-cols-2 gap-3">
              <PriceTile label="Half Day" price={effHalfDay} note={selectedFloor ? `${selectedFloor.name} · morning or evening` : "Morning or evening"} />
              <PriceTile label="Full Day" price={effFullDay} note={selectedFloor ? `${selectedFloor.name} · entire day` : "Entire day access"} />
            </div>
          </Section>

          {/* Food menus */}
          <Section title="Food menu options">
            <div className="grid sm:grid-cols-2 gap-3">
              {centre.food_menus.map((m) => (
                <div key={m.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200/70 transition-shadow hover:shadow-[0_8px_24px_-14px_rgba(15,23,42,0.25)]">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold text-slate-900">{m.name}</div>
                    <span className="text-xs rounded-full bg-slate-100 px-2 py-0.5">{m.menu_type}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{m.items}</p>
                  <div className="mt-2 text-sm font-bold text-brand-700">
                    {taka(m.price_per_person)}{" "}
                    <span className="font-normal text-slate-400">/ person · min {m.min_guest_count}</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Booking policies">
            <ul className="text-sm text-slate-600 space-y-1.5 list-disc pl-5">
              <li>A full-day booking blocks the entire date; half-day blocks only the chosen session.</li>
              <li>Booking requests are reviewed by the centre owner before confirmation.</li>
              <li>VAT (7.5%) and service charge (5%) are applied automatically.</li>
              <li>Reusable décor is returned to inventory after the event.</li>
            </ul>
          </Section>
        </div>

        {/* Booking widget */}
        <div id="booking-widget" className="lg:sticky lg:top-20 h-fit">
          <div className="rounded-2xl bg-white p-5 ring-1 ring-slate-200/70 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)]">
            <div className="text-sm text-slate-500">Starting from</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {taka(centre.starting_price)}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-800">When is your event?</span>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={bookingDates.length >= 30 || hasEmptyRow || hasDuplicates}
                    title={hasEmptyRow ? "Pick the current date first" : hasDuplicates ? "Remove the duplicate date first" : undefined}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add another day
                  </button>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  {bookingDates.length > 1
                    ? "Booking multiple days — pick a date from the calendar for each row, and choose its session."
                    : "Tap a green date in the calendar below, then pick your session. Need more than one day? Use “Add another day”."}
                </p>

                <div className="mt-1.5 space-y-2">
                  {bookingDates.map((row, i) => {
                    const active = activeRow?.key === row.key;
                    const duplicate = row.date && bookingDates.some((r) => r.key !== row.key && r.date === row.date);
                    return (
                      <div
                        key={row.key}
                        className={`rounded-xl border p-2 transition ${
                          active ? "border-brand-400 bg-brand-50/50 ring-1 ring-brand-200" : duplicate ? "border-rose-200 bg-rose-50/50" : "border-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveKey(row.key)}
                            className="flex flex-1 items-center gap-1.5 text-left text-sm"
                          >
                            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className={row.date ? "font-semibold text-slate-800" : "text-slate-400"}>
                              {row.date ? fmtDate(row.date) : `Choose a date for day ${i + 1}…`}
                            </span>
                          </button>
                          <select
                            value={row.session_type}
                            onFocus={() => setActiveKey(row.key)}
                            onChange={(e) => updateRow(row.key, "session_type", e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {SESSIONS.map((s) => (
                              <option key={s.value} value={s.value}>{s.label.replace("Half Day · ", "")}</option>
                            ))}
                          </select>
                          {bookingDates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Remove date ${i + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        {duplicate && <div className="mt-1 text-[11px] font-medium text-rose-600">This date is already selected.</div>}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {activeRow?.date
                    ? <>Choosing for <b className="font-bold">{fmtDate(activeRow.date)}</b> — tap another date to change it.</>
                    : <>Pick a date below for <b className="font-bold">Day {bookingDates.findIndex((r) => r.key === activeRow?.key) + 1}</b>.</>}
                </div>
                <div className="mt-2">
                  <AvailabilityCalendarPicker
                    slug={centre.slug}
                    value={activeRow?.date || ""}
                    sessionType={activeRow?.session_type || "full_day"}
                    selectedDates={bookingDates.map((r) => r.date)}
                    onSelect={(ds) => {
                      if (activeRow) updateRow(activeRow.key, "date", ds);
                      setDateError(false);
                    }}
                  />
                </div>
              </div>

              {floors.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-slate-500">Choose a floor</span>
                  <div className="mt-1 space-y-1.5">
                    {floors.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setFloorId(f.id)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition ${floorId === f.id ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500" : "border-slate-200 hover:bg-slate-50"}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-800">{f.name}</span>
                          <span className="block text-[11px] text-slate-400">up to {f.capacity} guests{f.description ? ` · ${f.description}` : ""}</span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-sm font-bold text-slate-900">৳{Number(f.full_day_price).toLocaleString()}</span>
                          <span className="block text-[10px] text-slate-400">full day</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Guests</span>
                  <input
                    type="number"
                    min={1}
                    max={effCapacity}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Event type</span>
                  <select value={eventType} onChange={(e) => setEventType(e.target.value)} className="input mt-1">
                    {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-500">Food menu (optional)</span>
                <select
                  value={selectedMenu || ""}
                  onChange={(e) => setSelectedMenu(e.target.value ? Number(e.target.value) : null)}
                  className="input mt-1"
                >
                  <option value="">No catering</option>
                  {centre.food_menus.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {taka(m.price_per_person)}/person
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Live breakdown */}
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm space-y-1.5">
              <Row label={`Venue${quote?.date_count > 1 ? ` · ${quote.date_count} dates` : ` (${sessionLabel(validSchedule[0]?.session_type || "full_day")})`}`} value={quote?.venue_amount} loading={quoting} />
              <Row label="Food" value={quote?.food_amount} loading={quoting} />
              <Row label="Service charge (5%)" value={quote?.service_charge} loading={quoting} />
              <Row label="VAT (7.5%)" value={quote?.vat_amount} loading={quoting} />
              <div className="border-t border-slate-200 pt-1.5 flex justify-between font-extrabold text-slate-900">
                <span>Total payable</span>
                <span>{quote ? taka(quote.total_amount) : "—"}</span>
              </div>
            </div>

            {dateError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <span aria-hidden>📅</span> {hasDuplicates ? "Remove duplicate dates to continue." : "Please pick at least one event date to continue."}
              </div>
            )}

            <button
              onClick={proceed}
              className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99]"
            >
              Continue booking →
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              You can review everything before submitting.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function PriceTile({ label, price, note }) {
  return (
    <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200/70">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-xl font-extrabold text-slate-900">{taka(price)}</div>
      <div className="text-xs text-slate-400">{note}</div>
    </div>
  );
}

function Row({ label, value, loading }) {
  return (
    <div className="flex justify-between text-slate-600">
      <span>{label}</span>
      <span>{loading ? "…" : value != null ? taka(value) : "—"}</span>
    </div>
  );
}
