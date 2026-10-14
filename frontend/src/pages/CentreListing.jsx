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
import { useT } from "../store/langStore";

const SORTS = [
  { value: "rating", label: "Top rated" },
  { value: "price_low", label: "Price: low → high" },
  { value: "price_high", label: "Price: high → low" },
];

export default function CentreListing() {
  const { lang } = useT();
  const [params, setParams] = useSearchParams();
  const [centres, setCentres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  const [filters, setFilters] = useState({
    q: params.get("q") || "",
    area: params.get("area") || "",
    guests: params.get("guests") || "",
    max_price: params.get("max_price") || "",
    sort: params.get("sort") || "rating",
    verified: params.get("verified") === "true",
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const queryString = params.toString();
  useEffect(() => {
    const query = new URLSearchParams(queryString);
    const next = {
      q: query.get("q") || "", area: query.get("area") || "",
      guests: query.get("guests") || "", max_price: query.get("max_price") || "",
      sort: query.get("sort") || "rating", verified: query.get("verified") === "true",
    };
    setFilters(next);
    setAppliedFilters(next);
    setLoading(true);
    setError(false);
    let active = true;
    getCentres(Object.fromEntries(query))
      .then((rows) => { if (active) setCentres(rows); })
      .catch(() => { if (active) { setCentres([]); setError(true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [queryString, retry]);

  const apply = (e, next = filters) => {
    e?.preventDefault();
    const clean = {};
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== false) clean[k] = v === true ? "true" : v;
    });
    setParams(clean);
    setAppliedFilters(next);
    setFiltersOpen(false);
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
  if (appliedFilters.q) chips.push(["q", `“${appliedFilters.q}”`]);
  if (appliedFilters.area) chips.push(["area", appliedFilters.area]);
  if (appliedFilters.guests) chips.push(["guests", `${appliedFilters.guests}+ guests`]);
  if (appliedFilters.max_price) chips.push(["max_price", `≤ ${taka(appliedFilters.max_price)}`]);
  if (appliedFilters.verified) chips.push(["verified", "Verified only"]);

  const removeChip = (key) => {
    const next = { ...appliedFilters, [key]: key === "verified" ? false : "" };
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
        <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-14">
          <p className="text-xs font-semibold uppercase text-brand-300 sm:text-sm">Browse venues</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:mt-2 sm:text-3xl md:text-5xl">
            Find your perfect community centre
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-300 sm:mt-3 sm:text-base">
            {loading ? "Loading verified ICCMS venues…" : error ? (lang === "bn" ? "সেন্টারের তথ্য লোড করা যায়নি।" : "Centre information is unavailable.") : `${centres.length} verified venues for weddings, corporate & social events.`}
          </p>

          {/* quick search bar */}
          <form
            onSubmit={apply}
            className="mt-4 flex max-w-xl items-center gap-2 rounded-lg bg-white p-1.5 shadow-lg sm:mt-6 sm:p-2"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 px-3">
              <Search aria-hidden="true" className="hidden h-5 w-5 shrink-0 text-slate-400 sm:block" />
              <input
                value={filters.q}
                onChange={set("q")}
                placeholder={lang === "bn" ? "কেন্দ্রের নাম বা এলাকা" : "Centre name or area"}
                enterKeyHint="search"
                aria-label={lang === "bn" ? "কেন্দ্রের নাম বা এলাকা দিয়ে খুঁজুন" : "Search by centre name or area"}
                className="min-w-0 w-full bg-transparent py-2.5 text-base text-slate-800 outline-none placeholder:text-slate-400"
              />
            </div>
            <button type="submit" aria-label={lang === "bn" ? "অনুসন্ধান" : "Search"} title={lang === "bn" ? "অনুসন্ধান" : "Search"}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-brand-600 font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto sm:px-5">
              <Search aria-hidden="true" className="h-5 w-5 sm:hidden" />
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>
      </section>

      {/* Sticky filter toolbar */}
      <form
        onSubmit={apply}
        className="sticky top-16 z-30 border-b border-slate-200 bg-white/90 backdrop-blur"
      >
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-center justify-between gap-3 sm:hidden">
            <span className="text-sm font-semibold text-slate-800">{loading ? "Finding centres…" : error ? "—" : lang === "bn" ? `${centres.length.toLocaleString("bn-BD")}টি কেন্দ্র` : `${centres.length} ${centres.length === 1 ? "centre" : "centres"}`}</span>
            <button type="button" aria-expanded={filtersOpen} aria-controls="mobile-centre-filters"
              onClick={() => { if (filtersOpen) setFilters(appliedFilters); setFiltersOpen(!filtersOpen); }}
              className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-800">
              <SlidersHorizontal className="h-4 w-4 text-brand-600" /> Filters{chips.length > 0 ? ` (${chips.length})` : ""}
            </button>
          </div>
          <div id="mobile-centre-filters" className={`${filtersOpen ? "mt-3 grid" : "hidden"} grid-cols-2 gap-3 sm:mt-0 sm:flex sm:flex-wrap sm:items-end`}>
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

            <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <input type="checkbox" checked={filters.verified} onChange={set("verified")} className="h-4 w-4 accent-brand-600" />
              <ShieldCheck className="h-4 w-4 text-brand-600" /> Verified
            </label>

            <button className="min-h-11 rounded-md bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]">
              Apply
            </button>
            {chips.length > 0 && (
              <button type="button" onClick={clearAll} className="min-h-11 px-2 text-sm font-semibold text-brand-700 hover:underline">
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
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 transition hover:bg-brand-100"
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
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-8">
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
        ) : error ? (
          <div role="alert" className="py-8 text-center">
            <p className="text-sm text-red-700">{lang === "bn" ? "সেন্টারের তথ্য লোড করা যায়নি। আবার চেষ্টা করুন।" : "Could not load centres. Please try again."}</p>
            <button onClick={() => setRetry((value) => value + 1)} className="mt-4 min-h-11 rounded-md bg-brand-600 px-5 font-semibold text-white">{lang === "bn" ? "আবার চেষ্টা করুন" : "Try again"}</button>
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
            {centres.map((c, index) => (
              <motion.div key={c.id} variants={item}>
                <CentreCard centre={c} priority={index === 0} />
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
    <label className="block min-w-0 flex-1 sm:min-w-[140px] sm:max-w-[200px]">
      <span className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </span>
      <div className="mt-0.5">{children}</div>
    </label>
  );
}
