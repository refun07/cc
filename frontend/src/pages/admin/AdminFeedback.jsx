import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarDays, ChevronDown, LoaderCircle, MessageSquare, Phone, RotateCw, Star } from "lucide-react";
import { adminSoftwareFeedback } from "../../services/api";
import { useT } from "../../store/langStore";
import { PageHead, Loading } from "./ui";

export default function AdminFeedback() {
  const { lang } = useT();
  const tr = (en, bn) => lang === "bn" ? bn : en;
  const locale = lang === "bn" ? "bn-BD" : "en-BD";
  const [items, setItems] = useState(null);
  const [total, setTotal] = useState(0);
  const [nextPage, setNextPage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [failedPage, setFailedPage] = useState(null);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  const loadPage = useCallback(async (page = 1) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setFailedPage(null);
    try {
      const result = await adminSoftwareFeedback(page);
      if (!mounted.current) return;
      setItems((current) => page === 1 ? result.data : [...(current || []), ...result.data]);
      setTotal(result.total);
      setNextPage(result.next_page_url ? page + 1 : null);
    } catch {
      if (mounted.current) setFailedPage(page);
    } finally {
      inFlight.current = false;
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    loadPage();
    return () => { mounted.current = false; };
  }, [loadPage]);

  return <div className="min-w-0">
    <PageHead title={tr("Software feedback", "সফটওয়্যার সম্পর্কে মতামত")} subtitle={tr("Customer comments about ICCMS", "ICCMS ব্যবহার নিয়ে গ্রাহকদের মতামত")}>
      <button type="button" disabled={busy} onClick={() => loadPage()} title={tr("Refresh feedback", "মতামত রিফ্রেশ করুন")} aria-label={tr("Refresh feedback", "মতামত রিফ্রেশ করুন")} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50">
        <RotateCw aria-hidden="true" className={`h-4 w-4 ${busy ? "motion-safe:animate-spin" : ""}`} />
      </button>
    </PageHead>
    <section aria-label={tr("Customer feedback", "গ্রাহকদের মতামত")} aria-busy={busy} className="min-w-0 border-y border-slate-200 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700"><MessageSquare aria-hidden="true" className="h-4 w-4 text-brand-700" />{tr("All feedback", "সকল মতামত")}</h2>
        {items && <span className="text-sm tabular-nums text-slate-500">{total.toLocaleString(locale)} {tr("received", "টি মতামত")}</span>}
      </div>
      {failedPage && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800 sm:px-6">
        <p>{tr("Could not load feedback. Please try again.", "মতামত লোড হয়নি। আবার চেষ্টা করুন।")}</p>
        <button type="button" disabled={busy} onClick={() => loadPage(failedPage)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold underline underline-offset-4 disabled:opacity-50"><RotateCw aria-hidden="true" className="h-4 w-4" />{tr("Try again", "আবার চেষ্টা করুন")}</button>
      </div>}
      {!items && !failedPage ? <Loading rows={3} /> : items?.length === 0 ? <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <MessageSquare aria-hidden="true" className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-500">{tr("No feedback yet.", "এখনো কোনো মতামত নেই।")}</p>
      </div> : <div className="divide-y divide-slate-100">{items?.map((item) => {
        const name = item.user?.name || tr("Customer unavailable", "গ্রাহকের তথ্য নেই");
        const rating = Math.max(0, Math.min(5, Number(item.rating) || 0));
        const date = new Date(item.created_at);
        const validDate = !Number.isNaN(date.getTime());
        return <article key={item.id} className="min-w-0 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-700">{Array.from(name)[0]}</span>
              <div className="min-w-0">
                <h3 className="break-words text-base font-semibold leading-6 text-slate-900">{name}</h3>
                {item.user?.phone && <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><Phone aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /><span className="break-all tabular-nums">{item.user.phone}</span></p>}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:shrink-0 sm:flex-col sm:items-end sm:gap-2">
              <span role="img" aria-label={`${rating.toLocaleString(locale)} ${tr("out of 5 stars", "তারকা, ৫-এর মধ্যে")}`} className="inline-flex items-center gap-1">
                {Array.from({ length:5 }, (_, index) => <Star key={index} aria-hidden="true" className={`h-4 w-4 ${index < rating ? "fill-amber-500 text-amber-500" : "text-slate-300"}`} />)}
                <span aria-hidden="true" className="ml-1 text-xs font-semibold tabular-nums text-slate-600">{rating.toLocaleString(locale)}/{(5).toLocaleString(locale)}</span>
              </span>
              {validDate && <time dateTime={date.toISOString()} className="inline-flex items-center gap-1.5 text-xs text-slate-500"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{date.toLocaleDateString(locale, { day:"numeric", month:"short", year:"numeric" })}</time>}
            </div>
          </div>
          {item.comment && <p className="mt-4 max-w-4xl whitespace-pre-wrap break-words text-sm leading-6 text-slate-700 sm:pl-[52px]">{item.comment}</p>}
          {item.booking && <div className="mt-3 sm:pl-[52px]"><Link to={`/booking/${encodeURIComponent(item.booking.booking_no)}`} className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-md text-sm font-medium text-brand-700 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><span className="min-w-0 break-all">{tr("Booking", "বুকিং")}: {item.booking.booking_no}</span><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link></div>}
        </article>;
      })}</div>}
      {!!items?.length && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:px-6">
        <p className="text-xs text-slate-500">{lang === "bn" ? `${total.toLocaleString(locale)}টির মধ্যে ${items.length.toLocaleString(locale)}টি দেখানো হচ্ছে` : `Showing ${items.length.toLocaleString(locale)} of ${total.toLocaleString(locale)}`}</p>
        {nextPage && <button type="button" disabled={busy} onClick={() => loadPage(nextPage)} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">{busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" /> : <ChevronDown aria-hidden="true" className="h-4 w-4" />}{tr(busy ? "Loading…" : "Show more", busy ? "লোড হচ্ছে…" : "আরও দেখুন")}</button>}
      </div>}
    </section>
  </div>;
}
