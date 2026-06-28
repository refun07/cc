import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, MapPin, Star, Loader2, ArrowRight, TrendingUp, Clock, Sparkles, Users } from "lucide-react";
import { getCentres } from "../services/api";
import { taka } from "../lib/format";

const POPULAR_AREAS = ["Gulshan", "Dhanmondi", "Motijheel", "Wari", "Lalbagh", "Jatrabari"];
const RECENT_KEY = "dscc-recent-search";

function highlight(text, q) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i === -1) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded bg-brand-100 px-0.5 text-brand-800">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  );
}

export default function SearchPanel() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [top, setTop] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const term = q.trim();

  // preload top-rated suggestions + recent searches
  useEffect(() => {
    getCentres({ sort: "rating" }).then((d) => setTop(d.slice(0, 3))).catch(() => {});
    try { setRecent(JSON.parse(localStorage.getItem(RECENT_KEY)) || []); } catch { /* ignore */ }
  }, []);

  // debounced live search
  useEffect(() => {
    if (term.length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const t = setTimeout(() => {
      getCentres({ q: term })
        .then((d) => { setResults(d.slice(0, 6)); setActive(-1); })
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onClick = (e) => boxRef.current && !boxRef.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const remember = (text) => {
    const next = [text, ...recent.filter((r) => r !== text)].slice(0, 4);
    setRecent(next);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  };

  const goListing = (text = term) => {
    if (text) remember(text);
    nav(`/centres?q=${encodeURIComponent(text)}`);
    setOpen(false);
  };
  const goCentre = (c) => { remember(c.name); nav(`/centres/${c.slug}`); setOpen(false); };
  const goArea = (area) => { setQ(area); nav(`/centres?area=${encodeURIComponent(area)}`); setOpen(false); };

  const onSubmit = (e) => {
    e.preventDefault();
    if (active >= 0 && results[active]) goCentre(results[active]);
    else goListing();
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    if (e.key === "Escape") setOpen(false);
  };

  const showResults = term.length >= 2;

  return (
    <div ref={boxRef} className="relative max-w-xl">
      <form
        onSubmit={onSubmit}
        className={`flex flex-col sm:flex-row gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-black/30 transition ${
          open ? "ring-2 ring-brand-400/60" : ""
        }`}
      >
        <div className="flex flex-1 items-center gap-2 px-3">
          {loading ? <Loader2 className="h-5 w-5 animate-spin text-brand-500" /> : <Search className="h-5 w-5 text-slate-400" />}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Search by centre name or area…"
            className="w-full bg-transparent py-3 text-slate-800 outline-none placeholder:text-slate-400"
            aria-label="Search community centres"
            autoComplete="off"
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="text-xs font-medium text-slate-400 hover:text-slate-600">
              Clear
            </button>
          )}
        </div>
        <button className="rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]">
          Search
        </button>
      </form>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-2xl"
          >
            {showResults ? (
              loading && results.length === 0 ? (
                <div className="space-y-2 p-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-12 w-12 animate-pulse rounded-xl bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200" />
                        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-slate-400">
                    <Search className="h-5 w-5" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-700">No centres match “{term}”.</p>
                  <p className="mt-0.5 text-xs text-slate-400">Try an area like Gulshan or Dhanmondi.</p>
                </div>
              ) : (
                <>
                  <SectionLabel icon={Sparkles}>{results.length} matching centres</SectionLabel>
                  <ul className="max-h-[22rem] overflow-y-auto pb-1">
                    {results.map((c, i) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => goCentre(c)}
                          className={`flex w-full items-center gap-3 px-3 py-2.5 transition ${active === i ? "bg-brand-50" : "hover:bg-slate-50"}`}
                        >
                          <img src={c.cover_image} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover ring-1 ring-black/5" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-semibold text-slate-900">{highlight(c.name, term)}</div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {highlight(c.area, term)}</span>
                              <span className="inline-flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(c.rating).toFixed(1)}</span>
                              <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{c.capacity}</span>
                            </div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="text-slate-400">from</div>
                            <div className="font-bold text-slate-900">{taka(c.starting_price)}</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <FooterButton onClick={() => goListing()}>See all results for “{term}”</FooterButton>
                </>
              )
            ) : (
              // ---- Empty state: recent + popular areas + top picks ----
              <div className="p-3">
                {recent.length > 0 && (
                  <>
                    <SectionLabel icon={Clock}>Recent searches</SectionLabel>
                    <div className="mb-2 flex flex-wrap gap-2 px-1">
                      {recent.map((r) => (
                        <button key={r} onClick={() => goListing(r)} className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50">
                          {r}
                        </button>
                      ))}
                    </div>
                  </>
                )}

                <SectionLabel icon={MapPin}>Popular areas</SectionLabel>
                <div className="mb-2 flex flex-wrap gap-2 px-1">
                  {POPULAR_AREAS.map((a) => (
                    <button key={a} onClick={() => goArea(a)} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100">
                      {a}
                    </button>
                  ))}
                </div>

                {top.length > 0 && (
                  <>
                    <SectionLabel icon={TrendingUp}>Top rated</SectionLabel>
                    <ul>
                      {top.map((c) => (
                        <li key={c.id}>
                          <button onClick={() => goCentre(c)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-slate-50">
                            <img src={c.cover_image} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover ring-1 ring-black/5" />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                              <div className="text-xs text-slate-500">{c.area}</div>
                            </div>
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-xs font-semibold text-slate-600">{Number(c.rating).toFixed(1)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SectionLabel({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-1.5 px-3 pb-1.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      <Icon className="h-3.5 w-3.5" /> {children}
    </div>
  );
}

function FooterButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between border-t border-slate-100 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
    >
      {children}
      <ArrowRight className="h-4 w-4" />
    </button>
  );
}
