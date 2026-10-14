import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, CalendarCheck, ClipboardCheck, LogOut, Ticket, Truck } from "lucide-react";
import { areaOverview, loginAccount } from "../services/api";
import { useAuthStore } from "../store/authStore";
import LanguageSwitcher from "../components/LanguageSwitcher";
import WasteRequests from "../components/WasteRequests";

export default function AreaDashboard() {
  const { user, logout, setAuth } = useAuthStore();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user?.role !== "area_admin") return;
    areaOverview(page).then(setData).catch((requestError) => setError(requestError.response?.data?.message || "Could not load your area."));
  }, [user?.id, user?.role, page]);

  const signIn = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await loginAccount(form);
      if (result.user.role !== "area_admin") {
        setError("This account is not assigned as an area administrator.");
        return;
      }
      setAuth(result);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return <main className="grid min-h-dvh place-items-center bg-slate-100 px-4">
    <form onSubmit={signIn} className="w-full max-w-sm rounded-lg bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between"><h1 className="text-xl font-bold text-slate-900">ICCMS Area Admin</h1><LanguageSwitcher tone="dark" /></div>
      <p className="mt-1 text-sm text-slate-500">Sign in with your assigned account.</p>
      <label className="mt-5 block text-sm font-semibold text-slate-700">Mobile number<input type="tel" inputMode="tel" pattern="01[0-9]{9}" required value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="input mt-1 w-full" /></label>
      <label className="mt-3 block text-sm font-semibold text-slate-700">Password<input type="password" required value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} className="input mt-1 w-full" /></label>
      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 font-semibold text-white disabled:opacity-50">Sign in</button>
    </form>
  </main>;

  if (user.role !== "area_admin") return <main className="mx-auto max-w-2xl p-8"><p>This account is not an area administrator.</p><Link to="/" className="mt-3 inline-block text-brand-700">Go home</Link></main>;

  return <main className="min-h-dvh bg-slate-50">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6"><div><h1 className="text-xl font-bold text-slate-900">Area dashboard</h1><p className="text-sm text-slate-500">Working area: {data?.working_area || user.area_scope}</p></div><div className="flex flex-wrap items-center gap-3"><LanguageSwitcher tone="dark" /><Link to="/area/event-reports" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><ClipboardCheck className="h-4 w-4" /> Event reports</Link><Link to="/area/waste-delays" className="inline-flex items-center gap-2 text-sm font-semibold text-amber-700"><Truck className="h-4 w-4" /> Waste pickup delays</Link><Link to="/area/tickets" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-700"><Ticket className="h-4 w-4" /> Service requests</Link><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"><LogOut className="h-4 w-4" /> Sign out</button></div></div></header>
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
      <WasteRequests />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data ? <p className="text-sm text-slate-500">Loading your area…</p> : <>
        <section><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><Building2 className="h-5 w-5" /> Centres ({data.centres.length})</h2>
          <div className="mt-3 overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Centre</th><th className="px-4 py-3">Capacity</th><th className="px-4 py-3">Bookings</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{data.centres.map((centre) => <tr key={centre.id} className="border-t border-slate-100"><td className="px-4 py-3"><Link to={`/centres/${centre.slug}`} className="font-semibold text-brand-700 hover:underline">{centre.name}</Link></td><td className="px-4 py-3">{centre.capacity}</td><td className="px-4 py-3">{centre.bookings_count}</td><td className="px-4 py-3 capitalize">{centre.status}</td></tr>)}</tbody></table>{data.centres.length === 0 && <p className="p-4 text-sm text-slate-500">No centres are assigned to this area.</p>}</div>
        </section>
        <section><h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><CalendarCheck className="h-5 w-5" /> Bookings</h2>
          <div className="mt-3 overflow-x-auto border-y border-slate-200 bg-white"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3">Booking</th><th className="px-4 py-3">Centre / floor</th><th className="px-4 py-3">Date / session</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Status</th></tr></thead><tbody>{data.bookings.data.map((booking) => <tr key={booking.booking_no} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{booking.booking_no}</td><td className="px-4 py-3">{booking.centre}{booking.floor ? ` · ${booking.floor}` : ""}</td><td className="px-4 py-3">{booking.event_date}<span className="block text-xs text-slate-500">{booking.session_type.replaceAll("_", " ")}</span></td><td className="px-4 py-3">{booking.customer_name}<span className="block text-xs text-slate-500">{booking.customer_phone}</span></td><td className="px-4 py-3 capitalize">{booking.status.replaceAll("_", " ")}</td></tr>)}</tbody></table>{data.bookings.data.length === 0 && <p className="p-4 text-sm text-slate-500">No bookings in this area.</p>}</div>
          <div className="mt-3 flex items-center justify-end gap-3 text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {page}</span><button type="button" disabled={!data.bookings.next_page_url} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button></div>
        </section>
      </>}
    </div>
  </main>;
}
