import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck, CalendarDays, UtensilsCrossed, Wallet, Boxes,
  Recycle, ArrowRight, MapPin, Sparkles, Leaf, TrendingUp, Users,
} from "lucide-react";
import { getCentres } from "../services/api";
import CentreCard from "../components/CentreCard";
import SearchPanel from "../components/SearchPanel";
import { Reveal, Stagger, item, useCountUp, EASE } from "../components/motion";

const STATS = [
  { label: "Verified Centres", value: 120, suffix: "+", icon: ShieldCheck },
  { label: "Events Hosted", value: 8400, suffix: "+", icon: CalendarDays },
  { label: "Areas Covered", value: 25, suffix: "", icon: MapPin },
  { label: "Tonnes Recycled", value: 32, suffix: "T", icon: Recycle },
];

const FEATURES = [
  [ShieldCheck, "Verified Centres", "Every DSCC centre is verified with trade license & fire safety clearance."],
  [CalendarDays, "Full / Half Day", "Book the entire day or just a morning or evening session."],
  [UtensilsCrossed, "Food Menus", "Bangla, premium wedding, corporate or vegetarian packages."],
  [Wallet, "Local Payments", "bKash, Nagad, Rocket, Upay, SSLCommerz, card & bank transfer."],
  [Boxes, "Owner Tools", "Inventory, HRM, payroll & expense management for owners."],
  [Recycle, "Zero Waste", "Event waste routed to verified recycling & compost partners."],
];

const STEPS = [
  ["Browse & filter", "Search verified centres by area, date, capacity and budget."],
  ["Pick session & menu", "Choose full or half day and a food package for your guests."],
  ["Review & pay", "See a transparent breakdown with VAT, then pay locally."],
  ["Get confirmed", "Receive a booking number and track your event status."],
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    getCentres({ sort: "rating" }).then((d) => setFeatured(d.slice(0, 3))).catch(() => {});
  }, []);

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
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.07] bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=1600&q=60')" }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 py-24 md:py-32">
          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-xs font-semibold backdrop-blur"
          >
            <Sparkles className="h-3.5 w-3.5 text-brand-300" />
            Dhaka South City Corporation · Official Marketplace
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.05 }}
            className="mt-6 max-w-4xl text-4xl md:text-7xl font-extrabold leading-[1.05] tracking-tight"
          >
            Book verified community centres for{" "}
            <span className="bg-gradient-to-r from-brand-300 via-emerald-300 to-teal-200 bg-clip-text text-transparent">
              every occasion
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            className="mt-5 max-w-2xl text-lg text-slate-300"
          >
            Weddings, corporate events & gatherings — full or half day, with food
            menus, local payments and built-in zero waste management.
          </motion.p>

          {/* search */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.25 }}
            className="mt-9"
          >
            <SearchPanel />
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400"
          >
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-brand-400" /> 100% verified venues</span>
            <span className="inline-flex items-center gap-1.5"><Wallet className="h-4 w-4 text-brand-400" /> Local payment support</span>
            <span className="inline-flex items-center gap-1.5"><Leaf className="h-4 w-4 text-brand-400" /> Zero waste ready</span>
          </motion.div>
        </div>

        {/* stat strip */}
        <div className="relative border-t border-white/10 bg-white/[0.03] backdrop-blur">
          <Stagger className="mx-auto grid max-w-7xl grid-cols-2 gap-px px-4 sm:px-6 md:grid-cols-4">
            {STATS.map((s) => (
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
            Everything for a smooth event
          </h2>
          <p className="mt-2 max-w-xl text-slate-500">
            One marketplace serving citizens, centre owners and DSCC admin.
          </p>
        </Reveal>

        <Stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3" gap={0.07}>
          {FEATURES.map(([Icon, title, desc]) => (
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

          <Stagger className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" gap={0.08}>
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
            How it works
          </h2>
        </Reveal>

        <Stagger className="relative mt-12 grid gap-6 md:grid-cols-4" gap={0.1}>
          {/* connecting line */}
          <div aria-hidden className="absolute left-0 right-0 top-5 hidden h-px bg-gradient-to-r from-brand-200 via-brand-300 to-transparent md:block" />
          {STEPS.map(([t, d], i) => (
            <motion.div key={t} variants={item} className="relative">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-bold text-white ring-4 ring-white">
                {i + 1}
              </div>
              <h3 className="mt-4 font-bold text-slate-900">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{d}</p>
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
