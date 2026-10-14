import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CheckCircle2, ClipboardCheck, LogOut, RefreshCw, Ticket, X } from "lucide-react";
import { caretakerOverview, caretakerReport, loginAccount } from "../services/api";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";
import { toast } from "../store/toastStore";
import LanguageSwitcher from "../components/LanguageSwitcher";
import NotificationBell from "../components/NotificationBell";
import WasteRequests from "../components/WasteRequests";
import CoordinatorDashboard from "./CoordinatorDashboard";

export default function CaretakerDashboard() {
  const { user, logout, setAuth } = useAuthStore();
  const { lang } = useT();
  const tr = (en, bn) => lang === "bn" ? bn : en;
  const [credentials, setCredentials] = useState({ phone: "", password: "" });
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(null);
  const [notes, setNotes] = useState("");

  const load = useCallback(() => {
    setError("");
    caretakerOverview().then(setData)
      .catch((requestError) => setError(requestError.response?.data?.message || "Could not load caretaker dashboard."));
  }, []);
  useEffect(() => { if (user?.role === "caretaker") load(); }, [user?.id, user?.role, load]);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginAccount(credentials);
      if (result.user.role !== "caretaker") {
        setError(tr("This account is not assigned as a caretaker.", "এই অ্যাকাউন্ট কেয়ারটেকার হিসেবে নির্ধারিত নয়।"));
        return;
      }
      setAuth(result);
    } catch (requestError) {
      setError(requestError.response?.data?.message || tr("Could not sign in.", "লগইন করা যায়নি।"));
    } finally { setBusy(false); }
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await caretakerReport(reporting.booking_no, { outcome: reporting.outcome, notes: notes.trim() || null });
      toast.success(tr("Event report submitted.", "অনুষ্ঠানের রিপোর্ট জমা হয়েছে।"));
      setReporting(null);
      setNotes("");
      load();
    } catch (requestError) {
      toast.error(Object.values(requestError.response?.data?.errors || {})[0]?.[0]
        || requestError.response?.data?.message || tr("Could not submit report.", "রিপোর্ট জমা দেওয়া যায়নি।"));
    } finally { setBusy(false); }
  };

  if (!user) return <main className="grid min-h-dvh place-items-center bg-slate-100 px-4">
    <form onSubmit={signIn} className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold text-slate-900">ICCMS {tr("Caretaker", "কেয়ারটেকার")}</h1><LanguageSwitcher tone="dark" /></div>
      <label className="mt-6 block text-sm font-semibold text-slate-700">{tr("Mobile number", "মোবাইল নম্বর")}<input type="tel" inputMode="tel" pattern="01[0-9]{9}" required value={credentials.phone} onChange={(event) => setCredentials((current) => ({ ...current, phone: event.target.value }))} className="input mt-1 w-full" /></label>
      <label className="mt-3 block text-sm font-semibold text-slate-700">{tr("Password", "পাসওয়ার্ড")}<input type="password" required value={credentials.password} onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))} className="input mt-1 w-full" /></label>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">{tr("Sign in", "লগইন করুন")}</button>
    </form>
  </main>;
  if (user.role !== "caretaker") return <main className="mx-auto max-w-2xl p-8"><p>{tr("This account is not a caretaker.", "এই অ্যাকাউন্ট কেয়ারটেকারের নয়।")}</p><Link to="/" className="mt-3 inline-block text-brand-700">{tr("Go home", "হোমে যান")}</Link></main>;

  const todayRows = (data?.today_bookings || []).filter((row) => !row.report);
  const overdueRows = (data?.pending_reports || []).filter((row) => row.last_event_date < data.today);
  const reportedRows = data?.reported || [];

  return <main className="min-h-dvh bg-slate-50">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div><h1 className="text-xl font-bold text-slate-900">{tr("Caretaker panel", "কেয়ারটেকার প্যানেল")}</h1><p className="text-sm text-slate-500">{data?.centres?.map((centre) => centre.name).join(" · ") || user.name}</p></div><div className="flex items-center gap-3"><LanguageSwitcher tone="dark" /><NotificationBell dark={false} /><button type="button" onClick={logout} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"><LogOut className="h-4 w-4" />{tr("Sign out", "সাইন আউট")}</button></div></div></header>
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-7 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">{data?.today}</p><h2 className="mt-1 text-2xl font-bold text-slate-900">{tr("Event reports", "অনুষ্ঠানের রিপোর্ট")}</h2></div><div className="flex gap-2"><button type="button" onClick={load} title={tr("Refresh", "রিফ্রেশ করুন")} aria-label={tr("Refresh", "রিফ্রেশ করুন")} className="grid h-10 w-10 place-items-center rounded-lg border bg-white text-slate-600"><RefreshCw className="h-4 w-4" /></button><Link to="/caretaker/tickets" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white"><Ticket className="h-4 w-4" />{tr("Service requests", "সেবা অনুরোধ")}</Link></div></div>
      {error && <p role="alert" className="border-l-2 border-red-500 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data ? <p className="text-sm text-slate-500">{tr("Loading…", "লোড হচ্ছে…")}</p> : <>
        <div className="grid grid-cols-2 gap-4 border-y border-slate-200 py-4 sm:max-w-md"><div><p className="text-sm text-slate-500">{tr("Awaiting report", "রিপোর্ট বাকি")}</p><p className="text-2xl font-bold text-amber-700">{data.pending_reports.length}</p></div><div><p className="text-sm text-slate-500">{tr("Reported", "রিপোর্ট জমা")}</p><p className="text-2xl font-bold text-brand-700">{reportedRows.length}</p></div></div>
        <WasteRequests />
        <CoordinatorDashboard embedded />
        <ReportSection title={tr("Today's events", "আজকের অনুষ্ঠান")} rows={todayRows} onReport={setReporting} tr={tr} />
        {overdueRows.length > 0 && <ReportSection title={tr("Earlier events awaiting report", "আগের অনুষ্ঠানের রিপোর্ট বাকি")} rows={overdueRows} onReport={setReporting} tr={tr} />}
        <ReportSection title={tr("Submitted reports", "জমা দেওয়া রিপোর্ট")} rows={reportedRows} onReport={setReporting} tr={tr} />
      </>}
    </div>
    {reporting && <div className="fixed inset-0 z-[1000] grid place-items-center bg-slate-950/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setReporting(null); }}><form onSubmit={submit} role="dialog" aria-modal="true" className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl"><div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-slate-900">{reporting.outcome === "completed" ? tr("Confirm event completed", "অনুষ্ঠান সম্পন্ন নিশ্চিত করুন") : tr("Report event not completed", "অনুষ্ঠান সম্পন্ন হয়নি রিপোর্ট করুন")}</h2><p className="text-sm text-slate-500">{reporting.booking_no}</p></div><button type="button" onClick={() => setReporting(null)} aria-label={tr("Close", "বন্ধ করুন")} className="p-1"><X className="h-5 w-5" /></button></div><label className="mt-5 block text-sm font-semibold text-slate-700">{tr("Report note", "রিপোর্টের বিবরণ")}{reporting.outcome === "not_completed" && " *"}<textarea rows={4} maxLength={2000} required={reporting.outcome === "not_completed"} value={notes} onChange={(event) => setNotes(event.target.value)} className="input mt-1 w-full" placeholder={tr("What happened at the centre?", "কেন্দ্রে কী ঘটেছে?")} /></label><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReporting(null)} className="rounded-lg border px-4 py-2 text-sm">{tr("Cancel", "বাতিল")}</button><button disabled={busy} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{tr("Submit report", "রিপোর্ট জমা দিন")}</button></div></form></div>}
  </main>;
}

function ReportSection({ title, rows, onReport, tr }) {
  return <section><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarCheck className="h-5 w-5 text-brand-700" />{title} <span className="text-sm font-medium text-slate-500">({rows.length})</span></h2><div className="mt-3 overflow-hidden border-y border-slate-200 bg-white">{rows.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">{tr("No events in this list.", "এই তালিকায় কোনো অনুষ্ঠান নেই।")}</p> : rows.map((row) => <div key={row.booking_no} className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-4 py-4 last:border-b-0"><div className="min-w-0"><p className="font-semibold text-slate-900">{row.booking_no} · {row.centre_name} · {row.customer_name}</p><p className="mt-1 text-sm text-slate-500">{row.last_event_date} · {row.floor || tr("Centre", "কেন্দ্র")} · {row.session_type.replaceAll("_", " ")}</p>{row.report && <p className="mt-1 text-sm text-slate-600">{row.report.outcome === "completed" ? tr("Completed", "সম্পন্ন") : tr("Not completed", "সম্পন্ন হয়নি")}{row.report.notes ? ` · ${row.report.notes}` : ""}</p>}</div>{!row.report ? <div className="flex gap-2"><button type="button" onClick={() => onReport({ ...row, outcome: "completed" })} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white"><CheckCircle2 className="h-4 w-4" />{tr("Completed", "সম্পন্ন")}</button><button type="button" onClick={() => onReport({ ...row, outcome: "not_completed" })} className="inline-flex min-h-10 items-center gap-1 rounded-lg border px-3 text-sm font-semibold text-slate-700">{tr("Not completed", "সম্পন্ন হয়নি")}</button></div> : <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700"><ClipboardCheck className="h-4 w-4" />{tr("Reported", "রিপোর্ট জমা")}</span>}</div>)}</div></section>;
}
