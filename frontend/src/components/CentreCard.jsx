import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Star, MapPin, BadgeCheck, Users, ArrowRight } from "lucide-react";
import { taka } from "../lib/format";
import { facilityIcon } from "../lib/facilityIcons";

const FALLBACK = "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=900&q=70";

export default function CentreCard({ centre, priority = false }) {
  const nav = useNavigate();
  const go = () => nav(`/centres/${centre.slug}`);

  // Build a de-duplicated slideshow from the cover image + gallery.
  // Hosted (http) photos lead; locally-uploaded /storage images (often placeholders)
  // are pushed to the end so the card opens on a real venue photo.
  const slides = useMemo(() => {
    const unique = [...new Set([centre.cover_image, ...(centre.images || [])].filter(Boolean))];
    const isLocal = (s) => typeof s === "string" && s.startsWith("/storage");
    const ordered = [...unique.filter((s) => !isLocal(s)), ...unique.filter(isLocal)];
    return ordered.length ? ordered : [FALLBACK];
  }, [centre.cover_image, centre.images]);

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [broken, setBroken] = useState({});
  const timer = useRef(null);

  // Keep mobile cards still so browsing and scrolling are predictable.
  useEffect(() => {
    if (slides.length <= 1 || paused || !window.matchMedia("(min-width: 640px) and (prefers-reduced-motion: no-preference)").matches) return undefined;
    timer.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 3500);
    return () => clearInterval(timer.current);
  }, [slides.length, paused]);

  const srcFor = (s, i) => (broken[i] ? FALLBACK : s);

  return (
    <article
      onClick={go}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go()}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label={`${centre.name}, ${centre.area}`}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-lg bg-white ring-1 ring-slate-200/70 shadow-[0_1px_3px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_44px_-22px_rgba(15,23,42,0.3)] hover:ring-brand-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      {/* ---- media ---- */}
      <div className="relative h-52 overflow-hidden bg-slate-100 sm:h-64">
        {slides.map((s, i) => (
          <img
            key={i}
            src={srcFor(s, i)}
            alt={`${centre.name} venue ${i + 1}`}
            loading={priority && i === 0 ? "eager" : "lazy"}
            onError={() => setBroken((b) => (b[i] ? b : { ...b, [i]: true }))}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-[1200ms] ease-out group-hover:scale-105 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-black/10" />

        {centre.is_verified && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm backdrop-blur">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {Number(centre.rating).toFixed(1)}
        </span>

        {slides.length > 1 && (
          <div className="absolute inset-x-0 bottom-3 hidden justify-center gap-1.5 sm:flex">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={(e) => { e.stopPropagation(); setIndex(i); }}
                aria-label={`Show image ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-white" : "w-1.5 bg-white/70 hover:bg-white"}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- body ---- */}
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3 sm:px-5 sm:pb-5 sm:pt-4">
        <h3 className="text-lg font-bold leading-tight text-slate-900 transition-colors group-hover:text-brand-700">
          {centre.name}
        </h3>
        <p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
          <MapPin className="h-4 w-4 text-brand-500" /> {centre.area}
        </p>

        <div className="mt-3.5 flex flex-wrap gap-1.5">
          {(centre.facilities || []).slice(0, 3).map((f) => {
            const label = typeof f === "string" ? f : f.name;
            const Icon = facilityIcon(label, typeof f === "string" ? null : f.icon);
            return (
              <span key={label} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200/70">
                <Icon className="h-3 w-3 text-brand-600" />
                {label}
              </span>
            );
          })}
        </div>

        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
              <Users className="h-3.5 w-3.5" /> up to {centre.capacity} guests
            </div>
            <div className="mt-0.5">
              <span className="text-xs text-slate-400">from </span>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">{taka(centre.starting_price)}</span>
            </div>
          </div>

          <span className="relative inline-flex shrink-0 items-center gap-1.5 overflow-hidden rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-brand-600/25 transition-all group-hover:shadow-lg group-hover:shadow-brand-600/35 group-active:scale-[0.97]">
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
            Book
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </article>
  );
}
