import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, MapPin, Users, Wallet, SlidersHorizontal, ShieldCheck, X, ArrowUpDown,
} from "lucide-react";
import { getCentres } from "../services/api";
import CentreCard from "../components/CentreCard";
import { Stagger, item } from "../components/motion";
import { taka } from "../lib/format";

const SORTS = [
  { value: "rating", label: "Top rated" },
  { value: "price_low", label: "Price: low → high" },
  { value: "price_high", label: "Price: high → low" },
];

export default function CentreListing() {
  const [params, setParams] = useSearchParams();
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    q: params.get("q") || "",
    area: params.get("area") || "",
    guests: params.get("guests") || "",
    max_price: params.get("max_price") || "",
    sort: params.get("sort") || "rating",
    verified: params.get("verified") === "true",
  });

  const load = (f) => {
    setLoading(true);
    const query = {};
    Object.entries(f).forEach(([k, v]) => {
      if (v === "" || v === false) return;
      query[k] = v === true ? "true" : v;
    });
    getCentres(query)
      .then(setCentres)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (e, next = filters) => {
    e?.preventDefault();
    const clean = {};
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== false) clean[k] = v === true ? "true" : v;
    });
    setParams(clean);
    load(next);
  };

  const set = (k) => (e) =>
    setFilters((f) => ({
      ...f,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const clearAll = () => {
    const cleared = { q: "", area: "", guests: "", max_price: "", sort: "rating", verified: false };
    setFilters(cleared);
    apply(null, cleared);
  };

  // active filter chips
  const chips = [];
  if (filters.q) chips.push(["q", `“${filters.q}”`]);
  if (filters.area) chips.push(["area", filters.area]);
  if (filters.guests) chips.push(["guests", `${filters.guests}+ guests`]);
  if (filters.max_price) chips.push(["max_price", `≤ ${taka(filters.max_price)}`]);
  if (filters.verified) chips.push(["verified", "Verified only"]);

  const removeChip = (key) => {
    const next = { ...filters, [key]: key === "verified" ? false : "" };
    setFilters(next);
    apply(null, next);
  };

  return (
    <div>
      {/* Hero header */}
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.08] bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1600&q=60')" }}
        />
        <div className="absolute -top-24 left-1/3 -z-10 h-72 w-72 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-14">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-300">Browse venues</p>
          <h1 className="mt-2 text-3xl md:text-5xl font-extrabold tracking-tight">
            Find your perfect community centre
          </h1>
          <p className="mt-3 max-w-xl text-slate-300">
            {loading ? "Loading verified DSCC venues…" : `${centres.length} verified venues for weddings, corporate & social events.`}
          </p>

          {/* quick search bar */}
          <form
            onSubmit={apply}
            className="mt-6 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/30"
          >
            <div className="flex flex-1 items-center gap-2 px-3">
              <Search className="h-5 w-5 text-slate-400" />
              <input
                value={filters.q}
                onChange={set("q")}
                placeholder="Search by centre name or area…"
                className="w-full bg-transparent py-2.5 text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            <button className="rounded-xl bg-brand-600 px-5 py-2.5 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]">
              Search
            </button>
          </form>
        </div>
      </section>

      {/* Sticky filter toolbar */}
      <form
        onSubmit={apply}
        className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
          <div className="flex flex-wrap items-end gap-3">
            <span className="hidden items-center gap-1.5 self-center pr-1 font-bold text-slate-900 sm:inline-flex">
              <SlidersHorizontal className="h-4 w-4 text-brand-600" /> Filters
            </span>
            <BarField label="Area" icon={MapPin}>
              <input value={filters.area} onChange={set("area")} placeholder="e.g. Gulshan" className="input min-w-0" />
            </BarField>
            <BarField label="Min guests" icon={Users}>
              <input type="number" min="0" value={filters.guests} onChange={set("guests")} placeholder="e.g. 200" className="input min-w-0" />
            </BarField>
            <BarField label="Max half-day budget" icon={Wallet}>
              <input type="number" min="0" value={filters.max_price} onChange={set("max_price")} placeholder="e.g. 40000" className="input min-w-0" />
            </BarField>
            <BarField label="Sort by" icon={ArrowUpDown}>
              <select value={filters.sort} onChange={set("sort")} className="input min-w-0">
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </BarField>

            <label className="flex h-[42px] cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <input type="checkbox" checked={filters.verified} onChange={set("verified")} className="h-4 w-4 accent-brand-600" />
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Verified
            </label>

            <button className="h-[42px] rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]">
              Apply
            </button>
            {chips.length > 0 && (
              <button type="button" onClick={clearAll} className="h-[42px] px-2 text-sm font-semibold text-brand-700 hover:underline">
                Clear all
              </button>
            )}
          </div>

          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {chips.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => removeChip(key)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
                >
                  {label}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      </form>

      {/* Results — full width */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
        {loading ? (
          <div className="grid gap-6 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="h-60 skeleton bg-slate-200 sm:h-64" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-2/3 skeleton rounded bg-slate-200" />
                  <div className="h-3 w-1/2 skeleton rounded bg-slate-200" />
                  <div className="h-8 w-full skeleton rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : centres.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
              <Search className="h-7 w-7" />
            </div>
            <p className="mt-4 font-semibold text-slate-700">No centres match your filters</p>
            <p className="mt-1 text-sm text-slate-500">Try widening your budget or clearing some filters.</p>
            <button onClick={clearAll} className="mt-4 rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
              Clear filters
            </button>
          </div>
        ) : (
          <Stagger className="grid gap-6 sm:grid-cols-2" gap={0.06}>
            {centres.map((c) => (
              <motion.div key={c.id} variants={item}>
                <CentreCard centre={c} />
              </motion.div>
            ))}
          </Stagger>
        )}
      </div>
    </div>
  );
}

function BarField({ label, icon: Icon, children }) {
  return (
    <label className="block min-w-[140px] flex-1 sm:max-w-[200px]">
      <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
