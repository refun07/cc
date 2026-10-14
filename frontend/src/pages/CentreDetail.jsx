import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getCentre, getCentreReviews, quoteBooking, saveCentreReview } from "../services/api";
import { useBookingStore } from "../store/bookingStore";
import { useAuthStore } from "../store/authStore";
import { taka, sessionLabel } from "../lib/format";
import { facilityIcon } from "../lib/facilityIcons";
import { sanitizeHtml } from "../lib/sanitizeHtml";
import { clientKey } from "../lib/clientKey";
import { addCalendarDays } from "../lib/bookingDates";
import { tourUrl } from "../lib/tourUrl";
import { useT } from "../store/langStore";
import AvailabilityCalendarPicker from "../components/AvailabilityCalendarPicker";
import Lightbox from "../components/Lightbox";
import BookingLoadError from "../components/BookingLoadError";
import { Expand, Plus, Trash2, CalendarDays, ChevronLeft, ChevronRight, Play, ArrowUpRight, MapPin, Phone, Search, ArrowLeft, Star, BadgeCheck } from "lucide-react";

const FALLBACK_IMG = "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1200&q=70";

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

const newDateRow = (date = "", session_type = "") => ({ key: clientKey(), date, session_type });
const fmtDate = (v, lang) => new Date(`${v}T00:00:00`).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "short", day: "2-digit", month: "short" });

export default function CentreDetail() {
  const { lang } = useT();
  const { slug } = useParams();
  const nav = useNavigate();
  const location = useLocation();
  const bookingMode = location.pathname.endsWith("/book");
  const detailsStep = new URLSearchParams(location.search).get("step") === "details";
  const setDraft = useBookingStore((s) => s.setDraft);
  const user = useAuthStore((s) => s.user);

  const [centre, setCentre] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [loadRetry, setLoadRetry] = useState(0);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [galleryPaused, setGalleryPaused] = useState(false);
  const [brokenImg, setBrokenImg] = useState({});
  const [dateError, setDateError] = useState(false);

  const [bookingDates, setBookingDates] = useState(() => [newDateRow()]);
  const [activeKey, setActiveKey] = useState(null);
  const [guestCount, setGuestCount] = useState(100);
  const [eventType, setEventType] = useState("Wedding");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [floorId, setFloorId] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [nextReviewPage, setNextReviewPage] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const [decoratorQuery, setDecoratorQuery] = useState("");
  const [decoratorId, setDecoratorId] = useState("");

  useEffect(() => {
    let active = true;
    setCentre(null);
    setLoadError(null);
    setDecoratorQuery("");
    setDecoratorId("");
    getCentre(slug).then((c) => {
      if (!active) return;
      setCentre(c);
      const firstFloor = c.floors?.[0] || null;
      setFloorId(firstFloor?.id ?? null);
      setGuestCount(Math.min(100, firstFloor?.capacity || c.capacity));
      const saved = useBookingStore.getState().draft;
      if (bookingMode && saved?.centre?.slug === slug) {
        setFloorId(saved.floorId ?? firstFloor?.id ?? null);
        setGuestCount(saved.guestCount);
        setEventType(saved.eventType);
        setDecoratorId(saved.decoratorId == null ? "" : String(saved.decoratorId));
        setBookingDates(saved.bookingDates?.length
          ? saved.bookingDates.map((row) => newDateRow(row.date, saved.sessionSelectionVersion === 1 ? row.session_type : ""))
          : [newDateRow(saved.eventDate, saved.sessionSelectionVersion === 1 ? saved.sessionType : "")]);
      }
    }).catch((error) => { if (active) setLoadError({ status: error.response?.status }); });
    return () => { active = false; };
  }, [slug, bookingMode, loadRetry]);

  useEffect(() => {
    getCentreReviews(slug).then((result) => {
      setReviews(result.data);
      setNextReviewPage(result.next_page_url ? 2 : null);
    }).catch(() => setReviews([]));
  }, [slug]);

  const loadMoreReviews = async () => {
    if (!nextReviewPage) return;
    const result = await getCentreReviews(slug, nextReviewPage);
    setReviews((current) => [...current, ...result.data]);
    setNextReviewPage(result.next_page_url ? nextReviewPage + 1 : null);
  };

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewBusy(true);
    setReviewError("");
    try {
      await saveCentreReview(slug, { rating: reviewRating, comment: reviewComment });
      setReviewComment("");
      const result = await getCentreReviews(slug);
      setReviews(result.data);
      setNextReviewPage(result.next_page_url ? 2 : null);
    } catch (error) {
      setReviewError(error.response?.data?.message || "Could not save review.");
    } finally {
      setReviewBusy(false);
    }
  };

  // A floor, when the venue has them, overrides capacity and pricing.
  const floors = centre?.floors || [];
  const selectedFloor = floors.find((f) => f.id === floorId) || null;
  const effCapacity = selectedFloor?.capacity || centre?.capacity || 0;
  const effHalfDay = selectedFloor?.half_day_price ?? centre?.half_day_price;
  const effFullDay = selectedFloor?.full_day_price ?? centre?.full_day_price;

  const validSchedule = useMemo(
    () => bookingDates.filter((r) => r.date && SESSIONS.some((s) => s.value === r.session_type)).map(({ date, session_type }) => ({ date, session_type })),
    [bookingDates]
  );
  const scheduleKey = useMemo(() => JSON.stringify(validSchedule), [validSchedule]);
  const activeRow = bookingDates.find((r) => r.key === activeKey) || bookingDates[0];

  // live quote
  useEffect(() => {
    if (!centre || !guestCount || !validSchedule.length || validSchedule.length !== bookingDates.length) { setQuote(null); setQuoteError(""); setQuoting(false); return; }
    let active = true;
    setQuote(null);
    setQuoteError("");
    setQuoting(true);
    const t = setTimeout(() => {
      quoteBooking({
        centre_slug: centre.slug,
        centre_floor_id: floorId,
        session_type: validSchedule[0].session_type,
        guest_count: Number(guestCount),
        booking_dates: validSchedule,
      })
        .then((result) => { if (active) setQuote(result); })
        .catch(() => { if (active) setQuoteError("Could not calculate the booking price. Please try again."); })
        .finally(() => { if (active) setQuoting(false); });
    }, 250);
    return () => { active = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centre, guestCount, scheduleKey, floorId, bookingDates.length]);

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

  const dateList = bookingDates.map((r) => r.date).filter(Boolean);
  const hasDuplicates = new Set(dateList).size !== dateList.length;
  const hasEmptyRow = bookingDates.some((r) => !r.date || !SESSIONS.some((s) => s.value === r.session_type));

  useEffect(() => {
    if (bookingMode) window.scrollTo({ top: 0, behavior: "instant" });
  }, [bookingMode, location.search]);

  useEffect(() => {
    if (centre?.slug === slug && bookingMode && detailsStep && (!validSchedule.length || hasEmptyRow || hasDuplicates)) {
      nav(`/centres/${slug}/book`, { replace: true });
    }
  }, [centre, bookingMode, detailsStep, validSchedule.length, hasEmptyRow, hasDuplicates, nav, slug]);

  if (loadError) return <BookingLoadError status={loadError.status} subject="Centre" onRetry={() => setLoadRetry((value) => value + 1)} />;
  if (!centre || centre.slug !== slug) {
    return <div className="mx-auto max-w-7xl px-4 py-20 text-slate-400">Loading…</div>;
  }

  const configuredTourUrl = tourUrl(centre.virtual_tour_url);

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
      next = [...taken].sort().pop();
      do { next = addCalendarDays(next); } while (taken.has(next));
    }
    const row = newDateRow(next);
    setBookingDates((rows) => [...rows, row]);
    setActiveKey(row.key);
  };

  const proceed = () => {
    if (!validSchedule.length || hasEmptyRow || hasDuplicates) {
      setDateError(true);
      document.getElementById("booking-widget")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!quote || quoting) {
      setQuoteError("Could not calculate the booking price. Please try again.");
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
      sessionSelectionVersion: 1,
      guestCount: Number(guestCount),
      eventType,
      decoratorId: decoratorId === "" ? null : Number(decoratorId),
      decorator: decoratorId === "0"
        ? { name: centre.decorator_name, phone: centre.decorator_phone }
        : centre.decorators?.find((item) => String(item.id) === decoratorId) || null,
      quote,
    });
    nav(detailsStep ? "/checkout" : `/centres/${centre.slug}/book?step=details`);
  };

  return (
    <div className={`mx-auto max-w-7xl px-4 pt-5 sm:px-6 sm:py-8 ${bookingMode ? "pb-8" : "pb-28 lg:pb-8"}`}>
      {bookingMode && <div className="mx-auto max-w-3xl"><button type="button" onClick={() => nav(`/centres/${centre.slug}`)} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" />{lang === "bn" ? "কেন্দ্রের বিবরণে ফিরুন" : "Back to centre details"}</button><h1 className="mt-4 text-2xl font-extrabold text-slate-900">{lang === "bn" ? "বুকিংয়ের তথ্য বাছুন" : "Choose your booking details"}</h1><p className="mt-1 text-sm text-slate-500">{centre.name} · {centre.area}</p></div>}
      {/* Gallery */}
      <div className={bookingMode ? "hidden" : "grid gap-3 lg:grid-cols-[2fr_1fr]"}>
        <div
          onMouseEnter={() => setGalleryPaused(true)}
          onMouseLeave={() => setGalleryPaused(false)}
          className="group relative h-64 overflow-hidden rounded-lg bg-slate-100 md:h-96"
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
            <span className="pointer-events-none absolute top-4 left-4 inline-flex items-center gap-1 rounded-md bg-white/95 px-3 py-1 text-xs font-semibold text-brand-700 shadow">
              <BadgeCheck className="h-4 w-4" /> ICCMS Verified
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
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveImg((i) => (i + 1) % images.length)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-700 shadow transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute inset-x-0 bottom-4 hidden justify-center gap-1.5 sm:flex">
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
        <div className="grid grid-cols-4 gap-2 lg:grid-cols-2 lg:gap-3">
          {images.slice(0, 4).map((img, i) => (
            <button
              key={i}
              onClick={() => { setActiveImg(i); setLightboxIndex(i); }}
              aria-label={`View image ${i + 1} enlarged`}
              className={`group relative h-16 cursor-zoom-in overflow-hidden rounded-md border-2 transition lg:h-[11.25rem] ${
                activeImg === i ? "border-brand-500" : "border-transparent hover:border-slate-200"
              }`}
            >
              <img src={brokenImg[i] ? FALLBACK_IMG : img} alt="" onError={() => setBrokenImg((b) => (b[i] ? b : { ...b, [i]: true }))} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
            </button>
          ))}
        </div>
      </div>

      {!bookingMode && <Lightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndex={(i) => { setLightboxIndex(i); setActiveImg(i); }}
      />}

      <div className={bookingMode ? "mx-auto mt-6 max-w-3xl" : "mt-8 grid gap-8 lg:grid-cols-[1fr_380px]"}>
        {/* Main */}
        <div className={bookingMode ? "hidden" : "space-y-8"}>
          <div>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{centre.name}</h1>
                <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-500 sm:text-base"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /> {centre.address}</p>
              </div>
              <div className="text-left sm:text-right">
                <div className="inline-flex items-center gap-1 font-bold text-amber-600"><Star className="h-4 w-4 fill-current" /> {Number(centre.rating).toFixed(1)}</div>
                <div className="text-xs text-slate-400">Capacity {effCapacity} guests{selectedFloor ? ` · ${selectedFloor.name}` : ""}</div>
              </div>
            </div>
            <div
              className="rich-text mt-4 text-slate-600 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(centre.description || "") }}
            />
          </div>

          {/* Virtual tour */}
          {configuredTourUrl && <div className="relative flex flex-wrap items-center justify-between gap-4 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-brand-900 p-5 shadow-lg shadow-slate-900/20 sm:p-6">
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
              href={configuredTourUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open 360 degree virtual tour for ${centre.name}`}
              className="relative inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition hover:scale-[1.02] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-900 active:scale-95 sm:w-auto"
            >
              Open Virtual Tour <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>}

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

          <Section id="decorators" title="Decorators">
            {centre.decorators?.length > 2 && <label className="relative mb-4 block max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input className="input w-full pl-10" value={decoratorQuery} onChange={(event) => setDecoratorQuery(event.target.value)} placeholder="Search decorator or area" /></label>}
            {centre.decorators?.length ? <div className="grid gap-3 sm:grid-cols-2">
              {centre.decorators.filter((decorator) => `${decorator.name} ${decorator.service_area} ${decorator.address || ""}`.toLowerCase().includes(decoratorQuery.trim().toLowerCase())).map((decorator) => <div key={decorator.id} className="flex flex-col rounded-lg border border-slate-200 bg-white p-4">
                <h3 className="font-bold text-slate-900">{decorator.name}</h3>
                <p className="mt-1 inline-flex items-start gap-1.5 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{decorator.service_area}{decorator.address ? ` · ${decorator.address}` : ""}</p>
                {decorator.description && <p className="mt-3 flex-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{decorator.description}</p>}
                <a href={`tel:${decorator.phone}`} className="mt-4 inline-flex min-h-10 items-center gap-2 self-start rounded-lg bg-brand-50 px-3 text-sm font-semibold text-brand-700 hover:bg-brand-100"><Phone className="h-4 w-4" />{decorator.phone}</a>
              </div>)}
              {centre.decorators.length > 2 && !centre.decorators.some((decorator) => `${decorator.name} ${decorator.service_area} ${decorator.address || ""}`.toLowerCase().includes(decoratorQuery.trim().toLowerCase())) && <p className="text-sm text-slate-500">No decorators match this area.</p>}
            </div> : <div><p className="text-sm text-slate-700">{centre.decorator_name || "No decorator contact listed."}</p>{centre.decorator_phone && <a href={`tel:${centre.decorator_phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"><Phone className="h-4 w-4" />{centre.decorator_phone}</a>}</div>}
          </Section>

          <Section title="Customer reviews">
            <div className="space-y-4">
              {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
              {reviews.map((review) => <div key={review.id} className="border-b border-slate-100 pb-3 last:border-0">
                <div className="flex items-center gap-2 text-sm"><span className="font-semibold text-slate-800">{review.name}</span><span className="text-amber-600">{"★".repeat(review.rating)}</span><span className="text-slate-400">{review.created_at}</span></div>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-wrap break-words">{review.comment}</p>
              </div>)}
              {nextReviewPage && <button type="button" onClick={loadMoreReviews} className="text-sm font-semibold text-brand-700 hover:underline">Show more reviews</button>}
              {user?.role === "customer" && <form onSubmit={submitReview} className="border-t border-slate-200 pt-4">
                <p className="mb-2 text-sm font-semibold text-slate-800">Review this centre after your completed booking</p>
                <div className="flex gap-1" role="group" aria-label="Rating">{[1, 2, 3, 4, 5].map((value) => <button type="button" key={value} onClick={() => setReviewRating(value)} aria-label={`${value} stars`} aria-pressed={reviewRating === value} className={`p-1 text-2xl ${value <= reviewRating ? "text-amber-500" : "text-slate-300"}`}>★</button>)}</div>
                <textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} minLength={10} maxLength={1000} required rows={3} className="input mt-2 w-full" placeholder="Share your experience" />
                {reviewError && <p role="alert" className="mt-1 text-sm text-red-600">{reviewError}</p>}
                <button disabled={reviewBusy} className="mt-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Post review</button>
              </form>}
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
        <div id="booking-widget" className={bookingMode ? "h-fit" : "h-fit lg:sticky lg:top-20"}>
          {bookingMode ? (
          <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200/70 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] sm:p-5">
            <div className="text-sm text-slate-500">Starting from</div>
            <div className="text-2xl font-extrabold text-slate-900">
              {taka(centre.starting_price)}
            </div>

            <div className="mt-4 space-y-3">
              <div hidden={detailsStep}>
                <h2 className="mb-3 text-lg font-bold text-slate-900">{lang === "bn" ? "১. তারিখ ও সেশন" : "1. Date and session"}</h2>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-800">When is your event?</span>
                  <button
                    type="button"
                    onClick={addRow}
                    disabled={bookingDates.length >= 30 || hasEmptyRow || hasDuplicates}
                    title={hasEmptyRow ? "Pick the current date first" : hasDuplicates ? "Remove the duplicate date first" : undefined}
                    className="inline-flex min-h-11 items-center gap-1 rounded-md bg-brand-50 px-3 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 disabled:opacity-40"
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
                        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={() => setActiveKey(row.key)}
                            className="flex min-h-11 min-w-0 flex-[1_1_100%] items-center gap-1.5 text-left text-sm sm:flex-1"
                          >
                            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className={row.date ? "font-semibold text-slate-800" : "text-slate-400"}>
                              {row.date ? fmtDate(row.date, lang) : `Choose a date for day ${i + 1}…`}
                            </span>
                          </button>
                          {bookingDates.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeRow(row.key)}
                              className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600"
                              aria-label={`Remove date ${i + 1}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <fieldset className="mt-2">
                          <legend className="mb-2 text-sm font-semibold text-slate-800">{lang === "bn" ? "সেশন নির্বাচন করুন (আবশ্যক)" : "Choose a session (required)"}</legend>
                          <div className="grid grid-cols-3 gap-2">
                            {SESSIONS.map((s) => (
                              <label key={s.value} className={`flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border px-1 py-2 text-center text-sm font-semibold ${row.session_type === s.value ? "border-brand-600 bg-brand-100 text-brand-800" : "border-slate-300 bg-white text-slate-700 hover:border-brand-500"}`}>
                                <input type="radio" name={`session-${row.key}`} value={s.value} checked={row.session_type === s.value} required onChange={() => { setActiveKey(row.key); updateRow(row.key, "session_type", s.value); setDateError(false); }} className="h-4 w-4 accent-emerald-700" />
                                {lang === "bn" ? ({ full_day: "পুরো দিন", half_day_morning: "সকাল", half_day_evening: "সন্ধ্যা" })[s.value] : s.label.replace("Half Day · ", "")}
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        {duplicate && <div className="mt-1 text-[11px] font-medium text-rose-600">This date is already selected.</div>}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
                  <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                  {activeRow?.date
                    ? <>{lang === "bn" ? "তারিখ বাছাই হচ্ছে " : "Choosing for "}<b className="font-bold">{fmtDate(activeRow.date, lang)}</b>{lang === "bn" ? " — পরিবর্তন করতে অন্য তারিখে চাপ দিন।" : " — tap another date to change it."}</>
                    : <>{lang === "bn" ? "নিচে তারিখ বাছুন: " : "Pick a date below for "}<b className="font-bold">{lang === "bn" ? `দিন ${bookingDates.findIndex((r) => r.key === activeRow?.key) + 1}` : `Day ${bookingDates.findIndex((r) => r.key === activeRow?.key) + 1}`}</b>.</>}
                </div>
                <div className="mt-2">
                  <AvailabilityCalendarPicker
                    slug={centre.slug}
                    floorId={floorId}
                    value={activeRow?.date || ""}
                    sessionType={activeRow?.session_type || "any"}
                    selectedDates={bookingDates.map((r) => r.date)}
                    onSelect={(ds) => {
                      if (activeRow) updateRow(activeRow.key, "date", ds);
                      setDateError(false);
                    }}
                  />
                </div>
              </div>

              <div hidden={!detailsStep}>
              <button type="button" onClick={() => nav(`/centres/${centre.slug}/book`)} className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700"><ArrowLeft className="h-4 w-4" />{lang === "bn" ? "তারিখ ও সেশনে ফিরুন" : "Back to date and session"}</button>
              <h2 className="mb-3 text-lg font-bold text-slate-900">{lang === "bn" ? "২. অনুষ্ঠানের বিবরণ" : "2. Event details"}</h2>
              <div className="space-y-3">
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
                          <span className="block text-[11px] text-slate-400">{lang === "bn" ? "সর্বোচ্চ " : "up to "}{f.capacity} {lang === "bn" ? "অতিথি" : "guests"}{f.description ? ` · ${f.description}` : ""}</span>
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
              <div className="flex flex-wrap gap-2" aria-label="Quick guest count">
                {[...new Set([50, 100, 200, 300, effCapacity])].filter((count) => count > 0 && count <= effCapacity).map((count) =>
                  <button key={count} type="button" onClick={() => setGuestCount(count)} aria-pressed={Number(guestCount) === count} className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${Number(guestCount) === count ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{count}</button>
                )}
              </div>

              <div>
                <label htmlFor="booking-decorator" className="text-xs font-medium text-slate-500">{lang === "bn" ? "ডেকরেটর (ঐচ্ছিক)" : "Decorator (optional)"}</label>
                <select id="booking-decorator" value={decoratorId} onChange={(event) => setDecoratorId(event.target.value)} className="input mt-1">
                  <option value="">{lang === "bn" ? "নিজে ব্যবস্থা করব" : "I will arrange my own"}</option>
                  {centre.decorators?.map((decorator) => <option key={decorator.id} value={decorator.id}>{decorator.name} · {decorator.service_area}</option>)}
                  {centre.decorator_name && centre.decorator_phone && <option value="0">{centre.decorator_name}</option>}
                </select>
                {!centre.decorators?.length && !(centre.decorator_name && centre.decorator_phone) && <p className="mt-1 text-xs text-slate-500">{lang === "bn" ? "এই সেন্টারে এখনো ডেকরেটর যোগ করা হয়নি।" : "No decorators have been added for this centre yet."}</p>}
                {decoratorId !== "" && <p className="mt-1 text-xs text-slate-600">{lang === "bn" ? "যোগাযোগ: " : "Contact: "}{decoratorId === "0" ? centre.decorator_phone : centre.decorators?.find((item) => String(item.id) === decoratorId)?.phone}</p>}
                {centre.decorators?.length > 0 && <a href="#decorators" className="mt-1 inline-block text-xs font-semibold text-brand-700 hover:underline">{lang === "bn" ? "ডেকরেটরের বিস্তারিত দেখুন" : "View decorator details"}</a>}
              </div>
              </div>
              </div>
            </div>

            {/* Live breakdown */}
            <div hidden={!detailsStep} className="mt-4 rounded-xl bg-slate-50 p-3 text-sm space-y-1.5">
              <Row label={`Venue${quote?.date_count > 1 ? ` · ${quote.date_count} dates` : ` (${sessionLabel(validSchedule[0]?.session_type || "full_day")})`}`} value={quote?.venue_amount} loading={quoting} />
              <Row label="Service charge (5%)" value={quote?.service_charge} loading={quoting} />
              <Row label="VAT (7.5%)" value={quote?.vat_amount} loading={quoting} />
              <div className="border-t border-slate-200 pt-1.5 flex justify-between font-extrabold text-slate-900">
                <span>Total payable</span>
                <span>{quote ? taka(quote.total_amount) : "—"}</span>
              </div>
            </div>

            {dateError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                <CalendarDays className="h-4 w-4" /> {hasDuplicates ? "Remove duplicate dates to continue." : lang === "bn" ? "প্রতিটি দিনের তারিখ ও সেশন নির্বাচন করুন।" : "Select a date and session for every day to continue."}
              </div>
            )}
            {quoteError && <p role="alert" className="mt-3 text-sm text-red-700">{quoteError}</p>}

            <button
              onClick={proceed}
              disabled={quoting}
              className="mt-4 w-full rounded-lg bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-50"
            >
              {detailsStep ? (lang === "bn" ? "পেমেন্ট ধাপে যান →" : "Continue to payment →") : (lang === "bn" ? "পরবর্তী: অনুষ্ঠানের বিবরণ →" : "Next: Event details →")}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              You can review everything before submitting.
            </p>
          </div>
          ) : (
            <div className="border-t border-slate-200 pt-4 lg:border-t-0 lg:pt-0">
              <p className="text-sm text-slate-500">{lang === "bn" ? "শুরু" : "Starting from"}</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">{taka(centre.starting_price)}</p>
              <button type="button" onClick={() => nav(`/centres/${centre.slug}/book`)} className="mt-4 hidden min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 font-semibold text-white hover:bg-brand-700 lg:inline-flex">{lang === "bn" ? "বুক করুন" : "Book now"}<ArrowUpRight className="h-4 w-4" /></button>
            </div>
          )}
        </div>
      </div>
      {!bookingMode && <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(15,23,42,0.08)] lg:hidden">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">{lang === "bn" ? "শুরু" : "Starting from"}</div>
            <div className="text-lg font-extrabold tabular-nums text-slate-900">{taka(centre.starting_price)}</div>
          </div>
          <button type="button" onClick={() => nav(`/centres/${centre.slug}/book`)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-brand-600 px-5 font-semibold text-white hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
            {lang === "bn" ? "বুক করুন" : "Book now"}<ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>}
    </div>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id}>
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
