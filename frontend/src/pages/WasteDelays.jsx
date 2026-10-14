import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock3, RefreshCw, Truck } from "lucide-react";
import { wasteDelays } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";
import LanguageSwitcher from "../components/LanguageSwitcher";
import WasteRequests from "../components/WasteRequests";

export default function WasteDelays() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const { lang } = useT();
  const tr = (en, bn) => lang === "bn" ? bn : en;
  const [scope, setScope] = useState("overdue");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    wasteDelays(scope, page).then((result) => { setData(result); setError(""); })
      .catch((requestError) => setError(requestError.response?.data?.message || "Could not load pickup delays."));
  }, [scope, page]);

  useEffect(() => {
    if (!["admin", "area_admin"].includes(role)) return;
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [role, load]);

  if (!user || !["admin", "area_admin"].includes(user.role)) return <main className="mx-auto max-w-2xl p-8"><p>{tr("Access denied.", "প্রবেশের অনুমতি নেই।")}</p><Link to="/" className="text-brand-700">{tr("Go home", "হোমে যান")}</Link></main>;

  const home = user.role === "admin" ? "/admin" : "/area";
  const rows = data?.pickups?.data || [];
  const digits = (value) => Number(value).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD");
  const dateTime = (value) => value ? new Date(value).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }) : "—";
  const delay = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remaining = minutes % 60;
    return hours ? `${digits(hours)} ${tr("h", "ঘণ্টা")} ${remaining ? `${digits(remaining)} ${tr("min", "মিনিট")}` : ""}` : `${digits(minutes)} ${tr("min", "মিনিট")}`;
  };

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link to={home} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />{tr("Dashboard", "ড্যাশবোর্ড")}</Link><h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900"><Truck className="h-6 w-6 text-amber-700" />{tr("Waste pickup delays", "বর্জ্য অপসারণে বিলম্ব")}</h1></div>
      <div className="flex items-center gap-2">{user.role === "area_admin" && <LanguageSwitcher tone="dark" />}<button type="button" onClick={load} aria-label={tr("Refresh", "রিফ্রেশ করুন")} title={tr("Refresh", "রিফ্রেশ করুন")} className="grid h-10 w-10 place-items-center rounded-lg border bg-white"><RefreshCw className="h-4 w-4" /></button></div>
    </div>
    {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <WasteRequests />
    <div className="flex flex-wrap gap-6 border-y border-slate-200 py-4">
      <div><p className="text-sm text-slate-500">{tr("Awaiting collection past schedule", "নির্ধারিত সময় পেরিয়ে সংগ্রহ বাকি")}</p><p className="text-2xl font-bold text-amber-700">{data ? digits(data.overdue_count) : "—"}</p></div>
      <div><p className="text-sm text-slate-500">{tr("Collected late", "দেরিতে সংগ্রহ হয়েছে")}</p><p className="text-2xl font-bold text-slate-900">{data ? digits(data.collected_late_count) : "—"}</p></div>
    </div>
    <div className="flex flex-wrap gap-1 border-b border-slate-200" role="tablist" aria-label={tr("Pickup status", "সংগ্রহের অবস্থা")}>{[
      ["overdue", tr("Overdue", "সময় পেরিয়েছে")], ["collected_late", tr("Collected late", "দেরিতে সংগ্রহ")], ["all", tr("All delays", "সব বিলম্ব")],
    ].map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={scope === value} onClick={() => { setScope(value); setPage(1); setData(null); }} className={`border-b-2 px-3 py-2 text-sm font-semibold ${scope === value ? "border-amber-600 text-amber-800" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>
    <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[800px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">{tr("Centre / working area", "কেন্দ্র / কর্ম এলাকা")}</th><th className="px-4 py-3">{tr("Waste partner", "বর্জ্য অপসারণকারী")}</th><th className="px-4 py-3">{tr("Waste", "বর্জ্য")}</th><th className="px-4 py-3">{tr("Scheduled pickup", "নির্ধারিত সংগ্রহ")}</th><th className="px-4 py-3">{tr("Collected", "সংগ্রহ হয়েছে")}</th><th className="px-4 py-3">{tr("Delay", "বিলম্ব")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-slate-100 align-top"><td className="px-4 py-3"><span className="font-semibold text-slate-900">{row.centre?.name || "—"}</span><span className="mt-1 block text-xs text-slate-500">{row.centre?.area} · {row.centre?.working_area}</span></td><td className="px-4 py-3">{row.partner?.name || "—"}<span className="mt-1 block text-xs text-slate-500">{row.partner?.phone}</span></td><td className="px-4 py-3">{row.waste_type}<span className="mt-1 block text-xs text-slate-500">{digits(row.quantity)} {row.unit}</span></td><td className="px-4 py-3 whitespace-nowrap">{dateTime(row.pickup_scheduled_for)}</td><td className="px-4 py-3 whitespace-nowrap">{dateTime(row.collected_at)}</td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1 font-semibold ${row.delay_status === "overdue" ? "text-amber-800" : "text-slate-700"}`}><Clock3 className="h-4 w-4" />{delay(row.delay_minutes)}</span><span className="mt-1 block text-xs text-slate-500">{row.delay_status === "overdue" ? tr("Still awaiting collection", "এখনও সংগ্রহ বাকি") : tr("Collected late", "দেরিতে সংগ্রহ হয়েছে")}</span></td></tr>)}</tbody></table>{data && rows.length === 0 && <p className="p-6 text-sm text-slate-500">{tr("No pickup delays in this view.", "এই তালিকায় বর্জ্য অপসারণে কোনো বিলম্ব নেই।")}</p>}{!data && !error && <p className="p-6 text-sm text-slate-500">{tr("Loading…", "লোড হচ্ছে…")}</p>}</div>
    {data?.pickups && data.pickups.last_page > 1 && <div className="flex items-center justify-end gap-3 text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{tr("Previous", "আগের")}</button><span>{digits(page)} / {digits(data.pickups.last_page)}</span><button type="button" disabled={page >= data.pickups.last_page} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">{tr("Next", "পরের")}</button></div>}
  </main>;
}
