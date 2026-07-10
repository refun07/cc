import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck, CalendarDays, UtensilsCrossed, Wallet, Boxes,
  Recycle, ArrowRight, MapPin, Leaf, TrendingUp, Users, Star, CheckCircle2,
} from "lucide-react";
import { getCentres, getHomepage } from "../services/api";
import CentreCard from "../components/CentreCard";
import SearchPanel from "../components/SearchPanel";
import { Reveal, Stagger, item, useCountUp, EASE } from "../components/motion";
import { useT } from "../store/langStore";

const STATS = [
  { key: "stats.verifiedCentres", value: 120, suffix: "+", icon: ShieldCheck },
  { key: "stats.eventsHosted", value: 8400, suffix: "+", icon: CalendarDays },
  { key: "stats.areasCovered", value: 25, suffix: "", icon: MapPin },
  { key: "stats.tonnesRecycled", value: 32, suffix: "T", icon: Recycle },
];

const FEATURES = [
  [ShieldCheck, "features.verified.t", "features.verified.d"],
  [CalendarDays, "features.day.t", "features.day.d"],
  [UtensilsCrossed, "features.food.t", "features.food.d"],
  [Wallet, "features.pay.t", "features.pay.d"],
  [Boxes, "features.owner.t", "features.owner.d"],
  [Recycle, "features.waste.t", "features.waste.d"],
];

const STEPS = [
  ["steps.browse.t", "steps.browse.d"],
  ["steps.pick.t", "steps.pick.d"],
  ["steps.review.t", "steps.review.d"],
  ["steps.confirm.t", "steps.confirm.d"],
];

/** Map an icon name saved by the admin to a lucide component. */
const ICONS = { ShieldCheck, CalendarDays, UtensilsCrossed, Wallet, Boxes, Recycle, MapPin, Leaf, TrendingUp, Users, Star, CheckCircle2 };
const iconFor = (name, fallback = CheckCircle2) => ICONS[name] || fallback;

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [cms, setCms] = useState(null); // admin-editable content
  const reduce = useReducedMotion();
  const { t } = useT();

  useEffect(() => {
    getCentres({ sort: "rating" }).then((d) => setFeatured(d.slice(0, 6))).catch(() => {});
    getHomepage().then(setCms).catch(() => setCms(null));
  }, []);

  // Admin content wins; otherwise fall back to the translated defaults.
  const hero = cms?.hero || {};
  const stats = cms?.stats?.length ? cms.stats.map((s) => ({ ...s, icon: iconFor(s.icon) })) : STATS.map((s) => ({ ...s, label: t(s.key) }));
  const features = cms?.features?.length
    ? cms.features.map((f) => [iconFor(f.icon), f.title, f.description])
    : FEATURES.map(([Icon, tk, dk]) => [Icon, t(tk), t(dk)]);
  const steps = cms?.steps?.length
    ? cms.steps.map((s) => [s.title, s.description])
    : STEPS.map(([tk, dk]) => [t(tk), t(dk)]);

  return (
    <div className="overflow-hidden">
      {/* ---------- HERO ---------- */}
      <section className="relative isolate bg-slate-950 text-white">
        {/* animated gradient blobs */}
        {!reduce && (
          <>
            <motion.div
              aria-hidden
              className="absolute -top-32 -left-24 h-96 w-96 rounded-full bg-brand-500/30 blur-3xl"
              animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
              transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              aria-hidden
              className="absolute top-20 right-0 h-96 w-96 rounded-full bg-emerald-400/20 blur-3xl"
              animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
            />
          </>
        )}
        {/* layered background: venue photo + brand wash + readability gradient */}
        <div aria-hidden className="absolute inset-0 -z-10">
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=70')" }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/90 to-slate-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/60" />
          <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#fff 1px,transparent 0)", backgroundSize: "26px 26px" }} />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 py-20 md:py-28 lg:grid-cols-[1.1fr_.9fr]">
          {/* ---- left: copy + search ---- */}
          <div>
            <motion.span
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold backdrop-blur"
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-400" />
              </span>
              {hero.badge || t("hero.badge")}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
              className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl xl:text-6xl"
            >
              {hero.title_lead || t("hero.titleA")}{" "}
              <span className="relative whitespace-nowrap">
                <span className="bg-gradient-to-r from-brand-300 via-emerald-300 to-teal-200 bg-clip-text text-transparent">{hero.title_highlight || t("hero.titleB")}</span>
                <svg className="absolute -bottom-2 left-0 w-full" height="10" viewBox="0 0 200 10" fill="none" preserveAspectRatio="none">
                  <path d="M2 7C40 3 160 3 198 7" stroke="url(#u)" strokeWidth="3" strokeLinecap="round" />
                  <defs><linearGradient id="u" x1="0" y1="0" x2="200" y2="0"><stop stopColor="#5eead4" /><stop offset="1" stopColor="#34d399" /></linearGradient></defs>
                </svg>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
              className="mt-6 max-w-xl text-lg text-slate-300"
            >
              {hero.subtitle || t("hero.subtitle")}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
              className="mt-8"
            >
              <SearchPanel />
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400"
            >
              {(hero.trust_badges || ["100% verified venues", "Local payment support", "Zero waste ready"]).map((badge, i) => {
                const Icon = [ShieldCheck, Wallet, Leaf][i] || CheckCircle2;
                return <span key={badge} className="inline-flex items-center gap-1.5"><Icon className="h-4 w-4 text-brand-400" /> {badge}</span>;
              })}
            </motion.div>
          </div>

          {/* ---- right: floating venue showcase ---- */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="relative overflow-hidden rounded-[2rem] border border-white/10 shadow-2xl shadow-black/40">
              <img
                src="https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=900&q=70"
                alt="Elegant community centre event hall"
                className="h-[30rem] w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

              {/* verified chip */}
              <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-lg">
                <CheckCircle2 className="h-4 w-4" /> DSCC Verified
              </div>

              {/* rating badge */}
              <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-white backdrop-blur">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.8
              </div>

              {/* bottom info card */}
              <div className="absolute inset-x-4 bottom-4 rounded-2xl bg-white/10 p-4 backdrop-blur-md ring-1 ring-white/15">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Grand Hall, Gulshan</div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-300"><MapPin className="h-3.5 w-3.5" /> Up to 800 guests</div>
                  </div>
                  <Link to="/centres" className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700">
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* floating social-proof pill */}
            <motion.div
              animate={reduce ? undefined : { y: [0, -10, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -left-6 top-24 flex items-center gap-3 rounded-2xl bg-white p-3 pr-4 shadow-2xl"
            >
              <div className="flex -space-x-2">
                {["#10b981", "#6366f1", "#f59e0b"].map((c) => (
                  <span key={c} className="grid h-8 w-8 place-items-center rounded-full ring-2 ring-white" style={{ backgroundColor: c }}>
                    <Users className="h-4 w-4 text-white" />
                  </span>
                ))}
              </div>
              <div>
                <div className="text-sm font-extrabold text-slate-900">8,400+ events</div>
                <div className="text-[11px] text-slate-500">hosted across Dhaka</div>
              </div>
            </motion.div>

            {/* floating zero-waste pill */}
            <motion.div
              animate={reduce ? undefined : { y: [0, 10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-5 bottom-28 flex items-center gap-2 rounded-2xl bg-white p-3 shadow-2xl"
            >
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-100 text-emerald-600"><Leaf className="h-5 w-5" /></span>
              <div>
                <div className="text-sm font-extrabold text-slate-900">32T recycled</div>
                <div className="text-[11px] text-slate-500">zero waste ready</div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* stat strip */}
        <div className="relative border-t border-white/10 bg-white/[0.03] backdrop-blur">
          <Stagger className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4">
            {stats.map((s) => (
              <StatTile key={s.label} {...s} />
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------- FEATURES ---------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Why book here</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            {cms?.features_heading || "Everything for a smooth event"}
          </h2>
          <p className="mt-2 max-w-xl text-slate-500">
            {cms?.features_subheading || "One marketplace serving citizens, centre owners and DSCC admin."}
          </p>
        </Reveal>

        <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
          {features.map(([Icon, title, desc]) => (
            <motion.div
              key={title}
              variants={item}
              whileHover={reduce ? undefined : { y: -6 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-xl hover:shadow-slate-200/70"
            >
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</p>
            </motion.div>
          ))}
        </Stagger>
      </section>

      {/* ---------- FEATURED ---------- */}
      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
          <Reveal className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Top rated</p>
              <h2 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
                Featured centres
              </h2>
            </div>
            <Link
              to="/centres"
              className="group inline-flex items-center gap-1 text-sm font-semibold text-brand-700"
            >
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>

          <Stagger className="mt-10 grid gap-7 sm:grid-cols-2" gap={0.08}>
            {featured.map((c) => (
              <motion.div key={c.id} variants={item}>
                <CentreCard centre={c} />
              </motion.div>
            ))}
          </Stagger>
        </div>
      </section>

      {/* ---------- HOW IT WORKS ---------- */}
      <section id="how" className="mx-auto max-w-7xl px-4 sm:px-6 py-20">
        <Reveal>
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Simple process</p>
          <h2 className="mt-2 text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
            {cms?.steps_heading || t("section.stepsTitle")}
          </h2>
        </Reveal>

        <Stagger className="relative mt-12 grid gap-6 md:grid-cols-4" gap={0.1}>
          {/* connecting line */}
          <div aria-hidden className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-brand-200 via-brand-300 to-transparent md:block" />
          {steps.map(([title, desc], i) => (
            <motion.div key={title} variants={item} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white ring-4 ring-white">
                {i + 1}
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{desc}</p>
            </motion.div>
          ))}
        </Stagger>
      </section>

      {/* ---------- ZERO WASTE ---------- */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 pb-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-brand-700 to-teal-900 p-10 text-white md:p-16">
            {!reduce && (
              <motion.div
                aria-hidden
                className="absolute -right-10 -top-10 h-64 w-64 rounded-full bg-white/10 blur-2xl"
                animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <div className="relative max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                <Recycle className="h-4 w-4" /> Zero Waste Management
              </span>
              <h2 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
                Every event leaves less behind
              </h2>
              <p className="mt-3 text-emerald-50/90">
                Organic waste, plastics, paper, cardboard and reusable décor are sorted
                and routed to verified zero waste partners for recycling, composting and reuse.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                {[[Leaf, "Composted"], [Recycle, "Recycled"], [TrendingUp, "Carbon tracked"], [Users, "Verified partners"]].map(([Icon, label]) => (
                  <span key={label} className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-medium backdrop-blur">
                    <Icon className="h-4 w-4" /> {label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- FINAL CTA ---------- */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-20 text-center">
          <Reveal>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900">
              Ready to book your centre?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-slate-500">
              Find the perfect venue, choose your menu and confirm in minutes.
            </p>
            <Link
              to="/centres"
              className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-8 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.98]"
            >
              Start Booking
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

function StatTile({ label, value, suffix, icon: Icon }) {
  const [ref, animated] = useCountUp(value);
  const display = value >= 1000 ? Math.round(animated).toLocaleString() : Math.round(animated);
  return (
    <motion.div ref={ref} variants={item} className="flex items-center gap-3 px-4 py-6">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/10 text-brand-300">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-extrabold tabular-nums text-white">
          {display}
          {suffix}
        </div>
        <div className="text-xs text-slate-400">{label}</div>
      </div>
    </motion.div>
  );
}
