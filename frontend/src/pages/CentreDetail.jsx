import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getCentre, quoteBooking } from "../services/api";
import { useBookingStore } from "../store/bookingStore";
import { taka, sessionLabel } from "../lib/format";
import BookingCalendar from "../components/BookingCalendar";
import Lightbox from "../components/Lightbox";
import { Expand } from "lucide-react";

const SESSIONS = [
  { value: "full_day", label: "Full Day", note: "Whole-day access" },
  { value: "half_day_morning", label: "Half Day · Morning", note: "Morning session" },
  { value: "half_day_evening", label: "Half Day · Evening", note: "Evening session" },
];

export default function CentreDetail() {
  const { slug } = useParams();
  const nav = useNavigate();
  const setDraft = useBookingStore((s) => s.setDraft);

  const [centre, setCentre] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [dateError, setDateError] = useState(false);

  const [sessionType, setSessionType] = useState("full_day");
  const [eventDate, setEventDate] = useState("");
  const [dayAvail, setDayAvail] = useState(null); // {full_day, half_day_morning, half_day_evening}
  const [guestCount, setGuestCount] = useState(100);
  const [eventType, setEventType] = useState("Wedding");
  const [selectedMenu, setSelectedMenu] = useState(null);
  const [quote, setQuote] = useState(null);
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    getCentre(slug).then((c) => {
      setCentre(c);
      setGuestCount(Math.min(100, c.capacity));
    });
  }, [slug]);

  const foodSelections = useMemo(
    () => (selectedMenu ? [{ food_menu_id: selectedMenu, quantity: Number(guestCount) }] : []),
    [selectedMenu, guestCount]
  );

  // live quote
  useEffect(() => {
    if (!centre || !guestCount) return;
    setQuoting(true);
    const t = setTimeout(() => {
      quoteBooking({
        centre_slug: centre.slug,
        session_type: sessionType,
        guest_count: Number(guestCount),
        food_selections: foodSelections,
      })
        .then(setQuote)
        .finally(() => setQuoting(false));
    }, 250);
    return () => clearTimeout(t);
  }, [centre, sessionType, guestCount, foodSelections]);

  if (!centre) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-slate-400">Loading…</div>;
  }

  const images = centre.images?.length
    ? centre.images.map((i) => i.image_path)
    : [centre.cover_image];

  const proceed = () => {
    if (!eventDate) {
      setDateError(true);
      document.getElementById("booking-widget")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setDateError(false);
    setDraft({
      centre: { slug: centre.slug, name: centre.name, area: centre.area },
      sessionType,
      eventDate,
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
        <button
          type="button"
          onClick={() => setLightboxIndex(activeImg)}
          aria-label="View larger image"
          className="group relative h-72 md:h-96 rounded-2xl overflow-hidden cursor-zoom-in"
        >
          <img
            src={images[activeImg]}
            alt={centre.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {centre.is_verified && (
            <span className="absolute top-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow">
              ✓ DSCC Verified
            </span>
          )}
          <span className="absolute bottom-4 right-4 inline-flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-xs font-medium text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
            <Expand className="h-4 w-4" /> Click to enlarge
          </span>
        </button>
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
              <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
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
                <div className="text-xs text-slate-400">Capacity {centre.capacity} guests</div>
              </div>
            </div>
            <p className="mt-4 text-slate-600 leading-relaxed">{centre.description}</p>
          </div>

          {/* Virtual tour */}
          {centre.virtual_tour_url && (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 p-5 flex items-center justify-between flex-wrap gap-3">
              <div>
                <div className="font-bold text-brand-800">🎥 Virtual Tour Available</div>
                <p className="text-sm text-brand-700/80">Explore the venue in 360° before you book.</p>
              </div>
              <a
                href={centre.virtual_tour_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Open Virtual Tour ↗
              </a>
            </div>
          )}

          {/* Facilities */}
          <Section title="Venue facilities">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {centre.facilities.map((f) => (
                <div key={f.name} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                  <span className="text-brand-600">✓</span> {f.name}
                </div>
              ))}
            </div>
          </Section>

          {/* Session packages */}
          <Section title="Session packages">
            <div className="grid sm:grid-cols-2 gap-3">
              <PriceTile label="Half Day" price={centre.half_day_price} note="Morning or evening" />
              <PriceTile label="Full Day" price={centre.full_day_price} note="Entire day access" />
            </div>
          </Section>

          {/* Food menus */}
          <Section title="Food menu options">
            <div className="grid sm:grid-cols-2 gap-3">
              {centre.food_menus.map((m) => (
                <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">Starting from</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {taka(centre.starting_price)}
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <span className="text-xs font-medium text-slate-500">Pick an event date</span>
                <div className="mt-1">
                  <BookingCalendar
                    slug={centre.slug}
                    value={eventDate}
                    onSelect={(ds, info) => {
                      setEventDate(ds);
                      setDateError(false);
                      setDayAvail(info);
                      // If the chosen session is no longer open for this date, switch.
                      if (info && info[sessionType] === false) {
                        const next = SESSIONS.find((s) => info[s.value]);
                        if (next) setSessionType(next.value);
                      }
                    }}
                  />
                </div>
              </div>

              <div>
                <span className="text-xs font-medium text-slate-500">Session</span>
                <div className="mt-1 grid gap-2">
                  {SESSIONS.map((s) => {
                    const open = !dayAvail || dayAvail[s.value] !== false;
                    return (
                      <button
                        key={s.value}
                        disabled={!open}
                        onClick={() => setSessionType(s.value)}
                        className={`text-left rounded-lg border px-3 py-2 text-sm ${
                          sessionType === s.value
                            ? "border-brand-500 bg-brand-50 text-brand-800"
                            : open
                            ? "border-slate-200"
                            : "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                      >
                        <div className="font-semibold">
                          {s.label} {!open && <span className="text-[10px]">· booked</span>}
                        </div>
                        <div className="text-[11px] text-slate-400">{s.note}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Guests</span>
                  <input
                    type="number"
                    min={1}
                    max={centre.capacity}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className="input mt-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-500">Event type</span>
                  <input value={eventType} onChange={(e) => setEventType(e.target.value)} className="input mt-1" />
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
              <Row label={`Venue (${sessionLabel(sessionType)})`} value={quote?.venue_amount} loading={quoting} />
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
                <span aria-hidden>📅</span> Please pick an event date to continue.
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
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
