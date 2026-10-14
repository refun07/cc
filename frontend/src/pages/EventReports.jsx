import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, RefreshCw, Ticket } from "lucide-react";
import { eventReports } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";
import LanguageSwitcher from "../components/LanguageSwitcher";

export default function EventReports() {
  const user = useAuthStore((state) => state.user);
  const { lang } = useT();
  const tr = (en, bn) => lang === "bn" ? bn : en;
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("pending");
  const load = useCallback(() => eventReports().then((result) => { setData(result); setError(""); })
    .catch((requestError) => setError(requestError.response?.data?.message || "Could not load event reports.")), []);

  useEffect(() => { if (user?.role === "admin" || user?.role === "area_admin") load(); }, [user?.id, user?.role, load]);
  if (!user || !["admin", "area_admin"].includes(user.role)) return <main className="mx-auto max-w-2xl p-8"><p>{tr("Access denied.", "প্রবেশের অনুমতি নেই।")}</p><Link to="/" className="text-brand-700">{tr("Go home", "হোমে যান")}</Link></main>;

  const rows = (data?.rows || []).filter((row) => filter === "all" || (filter === "pending" ? !row.report : !!row.report));
  const home = user.role === "admin" ? "/admin" : "/area";
  const tickets = user.role === "admin" ? "/admin/tickets" : "/area/tickets";

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><Link to={home} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-700"><ArrowLeft className="h-4 w-4" />{tr("Dashboard", "ড্যাশবোর্ড")}</Link><h1 className="mt-2 flex items-center gap-2 text-2xl font-bold text-slate-900"><ClipboardCheck className="h-6 w-6 text-brand-700" />{tr("Caretaker event reports", "কেয়ারটেকারের অনুষ্ঠান রিপোর্ট")}</h1></div><div className="flex items-center gap-2">{user.role === "area_admin" && <LanguageSwitcher tone="dark" />}<button type="button" onClick={load} aria-label={tr("Refresh", "রিফ্রেশ করুন")} title={tr("Refresh", "রিফ্রেশ করুন")} className="grid h-10 w-10 place-items-center rounded-lg border bg-white"><RefreshCw className="h-4 w-4" /></button><Link to={tickets} className="inline-flex min-h-10 items-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold text-slate-700"><Ticket className="h-4 w-4" />{tr("Service requests", "সেবা অনুরোধ")}</Link></div></div>
    {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-6 border-y border-slate-200 py-4"><div><p className="text-sm text-slate-500">{tr("Awaiting report", "রিপোর্ট বাকি")}</p><p className="text-2xl font-bold text-amber-700">{data?.pending_count ?? "—"}</p></div><div><p className="text-sm text-slate-500">{tr("Reported", "রিপোর্ট জমা")}</p><p className="text-2xl font-bold text-brand-700">{data?.reported_count ?? "—"}</p></div></div>
    <div className="flex flex-wrap gap-1 border-b border-slate-200">{[["pending", tr("Awaiting report", "রিপোর্ট বাকি")], ["reported", tr("Reported", "রিপোর্ট জমা")], ["all", tr("All", "সব")]].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value} className={`border-b-2 px-3 py-2 text-sm font-semibold ${filter === value ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500"}`}>{label}</button>)}</div>
    <div className="overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">{tr("Booking", "বুকিং")}</th><th className="px-4 py-3">{tr("Centre", "কেন্দ্র")}</th><th className="px-4 py-3">{tr("Event date", "অনুষ্ঠানের তারিখ")}</th><th className="px-4 py-3">{tr("Report", "রিপোর্ট")}</th><th className="px-4 py-3">{tr("Status", "অবস্থা")}</th></tr></thead><tbody>{rows.map((row) => <tr key={row.booking_no} className="border-t border-slate-100 align-top"><td className="px-4 py-3 font-semibold text-slate-900">{row.booking_no}<span className="mt-1 block text-xs font-normal text-slate-500">{row.customer_name}</span></td><td className="px-4 py-3">{row.centre}<span className="mt-1 block text-xs text-slate-500">{row.area} · {row.working_area}</span></td><td className="px-4 py-3">{row.last_event_date}<span className="mt-1 block text-xs text-slate-500">{row.session_type.replaceAll("_", " ")}</span></td><td className="px-4 py-3">{row.report ? <><span className={`font-semibold ${row.report.outcome === "completed" ? "text-brand-700" : "text-rose-700"}`}>{row.report.outcome === "completed" ? tr("Completed", "সম্পন্ন") : tr("Not completed", "সম্পন্ন হয়নি")}</span><span className="mt-1 block text-xs text-slate-500">{row.report.caretaker} · {row.report.reported_at ? new Date(row.report.reported_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-BD", { timeZone: "Asia/Dhaka" }) : ""}</span>{row.report.notes && <p className="mt-2 whitespace-pre-wrap text-slate-700">{row.report.notes}</p>}</> : <span className="font-semibold text-amber-700">{tr("Awaiting report", "রিপোর্ট বাকি")}</span>}</td><td className="px-4 py-3">{row.status.replaceAll("_", " ")}</td></tr>)}</tbody></table>{data && rows.length === 0 && <p className="p-6 text-sm text-slate-500">{tr("No event reports in this view.", "এই তালিকায় কোনো অনুষ্ঠান রিপোর্ট নেই।")}</p>}{!data && !error && <p className="p-6 text-sm text-slate-500">{tr("Loading…", "লোড হচ্ছে…")}</p>}</div>
  </main>;
}
