import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookOpen, Building2, CalendarCheck2, CreditCard, MapPin, Play, Search, ShieldCheck, Smartphone, UserRound, UsersRound, Video, X } from "lucide-react";
import { getGuide, getGuides } from "../services/api";
import { youtubeVideoId } from "../lib/youtube";
import { useT } from "../store/langStore";

function copy(guide, field, lang) {
  return lang === "bn" ? (guide[`${field}_bn`] || guide[field]) : guide[field];
}

const BOOKING_STEPS = [
  { slug: "find-a-centre", icon: Building2, detailIcon: MapPin, art: "bg-emerald-100 text-emerald-800", badge: "bg-emerald-700", en: "Choose a centre", bn: "সেন্টার বাছুন" },
  { slug: "create-account", icon: Smartphone, detailIcon: UserRound, art: "bg-sky-100 text-sky-800", badge: "bg-sky-700", en: "Create an account", bn: "অ্যাকাউন্ট খুলুন" },
  { slug: "place-a-booking", icon: CalendarCheck2, detailIcon: UsersRound, art: "bg-amber-100 text-amber-900", badge: "bg-amber-700", en: "Place a booking", bn: "বুকিং করুন" },
  { slug: "payment-and-status", icon: CreditCard, detailIcon: ShieldCheck, art: "bg-rose-100 text-rose-800", badge: "bg-rose-700", en: "Pay and track", bn: "পেমেন্ট দেখুন" },
];

export default function Guides() {
  const { slug } = useParams();
  const { lang } = useT();
  const [items, setItems] = useState(null);
  const [guide, setGuide] = useState(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [videosOnly, setVideosOnly] = useState(false);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const tr = (en, bn) => lang === "bn" ? bn : en;

  useEffect(() => {
    let active = true;
    setError(false);
    setGuide(null);
    setItems(null);
    if (slug) {
      getGuide(slug).then((result) => { if (active) setGuide(result); }).catch(() => { if (active) setError(true); });
      getGuides().then((result) => { if (active) setItems(result); }).catch(() => {});
    } else {
      getGuides().then((result) => { if (active) setItems(result); }).catch(() => { if (active) setError(true); });
    }
    window.scrollTo(0, 0);
    return () => { active = false; };
  }, [slug]);

  if (error) return <div className="mx-auto max-w-4xl px-4 py-16 text-center"><p className="text-slate-700">{tr("This guide is unavailable.", "গাইডটি এখন পাওয়া যাচ্ছে না।")}</p><Link to="/how-it-works" className="mt-4 inline-block font-semibold text-brand-700">{tr("All guides", "সব গাইড")}</Link></div>;
  if (slug && !guide) return <div className="mx-auto max-w-4xl px-4 py-16 text-slate-500">{tr("Loading guide…", "গাইড লোড হচ্ছে…")}</div>;
  if (!slug && !items) return <div className="mx-auto max-w-6xl px-4 py-16 text-slate-500">{tr("Loading guides…", "গাইড লোড হচ্ছে…")}</div>;

  if (slug) {
    const currentIndex = items?.findIndex((item) => item.slug === slug) ?? -1;
    const nextGuide = currentIndex >= 0 ? items?.[currentIndex + 1] : null;
    return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <Link to="/how-it-works" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"><ArrowLeft className="h-4 w-4" />{tr("All guides", "সব গাইড")}</Link>
      <article className="mt-5 sm:mt-7">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpen className="h-4 w-4" />{tr("Booking guide", "বুকিং গাইড")}</div>
        <h1 className="mt-3 text-2xl font-bold leading-tight text-slate-900 sm:text-4xl">{copy(guide, "title", lang)}</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 sm:mt-4 sm:text-lg">{copy(guide, "summary", lang)}</p>
        {guide.video_url && <GuideVideo url={guide.video_url} title={copy(guide, "title", lang)} lang={lang} />}
        <div className="mt-7 space-y-5 border-t border-slate-200 pt-6 text-base leading-7 text-slate-700 sm:mt-9 sm:pt-8 sm:leading-8">
          {copy(guide, "body", lang).split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <p key={index} className="whitespace-pre-line">{paragraph}</p>)}
        </div>
      </article>
      <div className="mt-12 flex flex-wrap gap-3 border-t border-slate-200 pt-6">
        <Link to="/how-it-works" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"><BookOpen className="h-4 w-4" />{tr("All guides", "সব গাইড")}</Link>
        <Link to={nextGuide ? `/how-it-works/${nextGuide.slug}` : "/centres"} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{nextGuide ? `${tr("Next: ", "পরের ধাপ: ")}${copy(nextGuide, "title", lang)}` : tr("Browse centres", "সেন্টার খুঁজুন")}<ArrowRight className="h-4 w-4 shrink-0" /></Link>
      </div>
    </div>
  );
  }

  const visible = items.filter((item) => {
    const matchesQuery = `${item.title} ${item.title_bn || ""} ${item.summary} ${item.summary_bn || ""}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesQuery && (!videosOnly || youtubeVideoId(item.video_url));
  });
  const stepGuides = BOOKING_STEPS.map((step) => ({ ...step, guide: items.find((item) => item.slug === step.slug) })).filter((step) => step.guide);
  const selectedStep = stepGuides[Math.min(activeStepIndex, stepGuides.length - 1)];

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-brand-700"><BookOpen className="h-4 w-4" />ICCMS</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-4xl">{tr("How it works", "যেভাবে কাজ করে")}</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">{tr("Booking guides and videos for planning your visit, choosing a centre and managing payment.", "সেন্টার বাছাই, বুকিং ও পেমেন্টের ধাপ বুঝতে লেখা ও ভিডিও গাইড।")}</p>
      </div>
      {selectedStep && <section aria-labelledby="booking-path-title" className="mt-8 border-y border-slate-200 py-6 sm:mt-10 sm:py-8">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="booking-path-title" className="text-lg font-bold text-slate-900 sm:text-xl">{tr("Your booking path", "বুকিংয়ের ধাপ")}</h2>
            <p className="mt-1 text-sm text-slate-600">{tr("From finding a centre to tracking payment.", "সেন্টার খোঁজা থেকে পেমেন্টের অবস্থা দেখা পর্যন্ত।")}</p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-brand-700">{String(Math.min(activeStepIndex, stepGuides.length - 1) + 1).padStart(2, "0")} / {String(stepGuides.length).padStart(2, "0")}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={tr("Booking steps", "বুকিংয়ের ধাপসমূহ")}>
          {stepGuides.map((step, index) => {
            const Icon = step.icon;
            const DetailIcon = step.detailIcon;
            const selected = selectedStep.slug === step.slug;
            return <button key={step.slug} type="button" onClick={() => setActiveStepIndex(index)} aria-pressed={selected} className={`flex min-h-[112px] flex-col items-start justify-between gap-2 rounded-md border px-3 py-3 text-left transition-colors sm:min-h-[96px] sm:flex-row sm:items-center ${selected ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-slate-50"} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600`}>
              <span className={`relative grid h-14 w-14 shrink-0 place-items-center rounded-md ${step.art}`} aria-hidden="true">
                <Icon className="h-8 w-8" strokeWidth={1.8} />
                <span className={`absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-md border-2 border-white text-white ${step.badge}`}><DetailIcon className="h-4 w-4" strokeWidth={2.2} /></span>
              </span>
              <span className="min-w-0 text-sm font-semibold leading-5">{lang === "bn" ? step.bn : step.en}</span>
            </button>;
          })}
        </div>
        <div className="mt-4 flex flex-col gap-4 rounded-md bg-slate-50 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5" aria-live="polite">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold text-brand-700">{tr("Step", "ধাপ")} {String(Math.min(activeStepIndex, stepGuides.length - 1) + 1).padStart(2, "0")}</p>
            <h3 className="mt-1 text-lg font-bold text-slate-900">{copy(selectedStep.guide, "title", lang)}</h3>
            <p className="mt-1 text-sm leading-6 text-slate-600">{copy(selectedStep.guide, "summary", lang)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to={`/how-it-works/${selectedStep.slug}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{tr("Read this guide", "গাইডটি পড়ুন")}<ArrowRight className="h-4 w-4" /></Link>
            {activeStepIndex < stepGuides.length - 1 && <button type="button" onClick={() => setActiveStepIndex((index) => index + 1)} className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">{tr("Next step", "পরের ধাপ")}</button>}
          </div>
        </div>
      </section>}
      <section aria-labelledby="guide-list-title" className="mt-8 sm:mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="guide-list-title" className="text-lg font-bold text-slate-900 sm:text-xl">{tr("Booking guides", "বুকিং গাইড")}</h2>
            <p className="mt-1 text-sm text-slate-600">{tr("Read at your own pace or watch a published video.", "নিজের সুবিধামতো পড়ুন বা প্রকাশিত ভিডিও দেখুন।")}</p>
          </div>
          <div className="inline-flex rounded-md border border-slate-200 bg-white p-1" aria-label={tr("Guide type", "গাইডের ধরন")}>
            <button type="button" onClick={() => setVideosOnly(false)} aria-pressed={!videosOnly} className={`min-h-11 rounded px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${!videosOnly ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}>{tr("All", "সব")}</button>
            <button type="button" onClick={() => setVideosOnly(true)} aria-pressed={videosOnly} className={`inline-flex min-h-11 items-center gap-2 rounded px-3 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600 ${videosOnly ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}><Video className="h-4 w-4" />{tr("Videos", "ভিডিও")}</button>
          </div>
        </div>
        <div className="mt-5 max-w-md">
          <label htmlFor="guide-search" className="mb-2 block text-sm font-semibold text-slate-700">{tr("Search guides", "গাইড খুঁজুন")}</label>
          <span className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input id="guide-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={tr("Centre, booking, payment...", "সেন্টার, বুকিং, পেমেন্ট...")} className="input w-full pl-10 pr-12 text-base" />
            {query && <button type="button" onClick={() => setQuery("")} aria-label={tr("Clear search", "খোঁজা মুছুন")} className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-600"><X className="h-4 w-4" /></button>}
          </span>
        </div>
      {visible.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">
        {visible.map((item) => {
          const Icon = BOOKING_STEPS.find((step) => step.slug === item.slug)?.icon || BookOpen;
          return <Link key={item.slug} to={`/how-it-works/${item.slug}`} className="group flex min-h-40 flex-col overflow-hidden rounded-md border border-slate-200 bg-white transition hover:border-brand-400 hover:shadow-sm">
            {youtubeVideoId(item.video_url) && <div className="relative aspect-video overflow-hidden bg-slate-900">
              <img src={`https://i.ytimg.com/vi/${youtubeVideoId(item.video_url)}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-85" />
              <span className="absolute inset-0 grid place-items-center"><Play className="h-12 w-12 rounded-full bg-white p-3 text-brand-700" /></span>
            </div>}
            <div className="flex flex-1 flex-col p-4 sm:p-5">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500"><span className="inline-flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-md bg-brand-50 text-brand-700"><Icon className="h-5 w-5" aria-hidden="true" /></span>{String(items.indexOf(item) + 1).padStart(2, "0")}</span>{youtubeVideoId(item.video_url) && <span className="inline-flex items-center gap-1"><Video className="h-3.5 w-3.5" />{tr("Video", "ভিডিও")}</span>}</div>
            <h3 className="mt-3 text-lg font-bold text-slate-900 group-hover:text-brand-700">{copy(item, "title", lang)}</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{copy(item, "summary", lang)}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">{tr("Read guide", "গাইড পড়ুন")}<ArrowRight className="h-4 w-4" /></span>
            </div>
          </Link>;
        })}
      </div> : <div className="py-12 text-center text-slate-500">
        <p>{videosOnly && !query ? tr("No videos are published yet.", "এখনো কোনো ভিডিও প্রকাশ করা হয়নি।") : tr("No guides match your search.", "আপনার খোঁজার সঙ্গে কোনো গাইড মেলেনি।")}</p>
        {videosOnly && <button type="button" onClick={() => setVideosOnly(false)} className="mt-3 min-h-11 font-semibold text-brand-700 hover:underline">{tr("View all guides", "সব গাইড দেখুন")}</button>}
      </div>}
      </section>
    </div>
  );
}

function GuideVideo({ url, title, lang }) {
  const id = youtubeVideoId(url);
  const [playing, setPlaying] = useState(false);
  if (!id) return null;

  return <div className="mt-8 overflow-hidden rounded-lg bg-slate-950">
    <div className="aspect-video">
      {playing ? <iframe className="h-full w-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1`} title={title} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /> :
        <button type="button" onClick={() => setPlaying(true)} className="relative h-full w-full text-white" aria-label={lang === "bn" ? "ভিডিও চালান" : "Play video"}>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-70" />
          <span className="absolute inset-0 grid place-items-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-rose-600 shadow-lg"><Play className="h-8 w-8 fill-current" /></span></span>
        </button>}
    </div>
  </div>;
}
