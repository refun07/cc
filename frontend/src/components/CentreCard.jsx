import { useNavigate } from "react-router-dom";
import { Star, MapPin, BadgeCheck, Users, ArrowRight } from "lucide-react";
import { taka } from "../lib/format";

export default function CentreCard({ centre }) {
  const nav = useNavigate();
  const go = () => nav(`/centres/${centre.slug}`);

  return (
    <article
      onClick={go}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && go()}
      aria-label={`${centre.name}, ${centre.area}`}
      className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-brand-200 hover:shadow-2xl hover:shadow-slate-300/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      <div className="relative h-52 overflow-hidden">
        <img
          src={centre.cover_image}
          alt={`${centre.name} venue`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />

        {centre.is_verified && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-brand-700 shadow-sm backdrop-blur">
            <BadgeCheck className="h-3.5 w-3.5" /> Verified
          </span>
        )}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {Number(centre.rating).toFixed(1)}
        </span>

        {/* name overlaid on image bottom for a richer look */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-lg font-bold leading-tight text-white drop-shadow-sm">
            {centre.name}
          </h3>
          <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-white/85">
            <MapPin className="h-3.5 w-3.5" /> {centre.area}
          </p>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-1.5">
          {(centre.facilities || []).slice(0, 3).map((f) => (
            <span key={f} className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {f}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3">
          <div>
            <div className="inline-flex items-center gap-1 text-[11px] text-slate-400">
              <Users className="h-3 w-3" /> up to {centre.capacity} guests
            </div>
            <div className="text-sm">
              <span className="text-slate-400">from </span>
              <span className="text-lg font-extrabold text-slate-900">{taka(centre.starting_price)}</span>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all group-hover:bg-brand-700 group-hover:shadow-md group-hover:shadow-brand-600/25">
            Book
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}
