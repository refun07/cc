import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, CalendarCheck, UtensilsCrossed, CalendarRange, Store,
  LogOut, Lock, Phone, ExternalLink, Building2, Boxes, Users, Wallet, Recycle, BarChart3, Calculator,
  ContactRound,
} from "lucide-react";
import { loginAccount } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import ImpersonationBanner from "../../components/ImpersonationBanner";
import NotificationBell from "../../components/NotificationBell";
import logo from "../../assets/dscc_3.jpg";

const NAV = [
  ["/owner", "Dashboard", LayoutDashboard, true],
  ["/owner/bookings", "Bookings", CalendarCheck],
  ["/owner/crm", "CRM", ContactRound],
  ["/owner/availability", "Availability", CalendarRange],
  ["/owner/menus", "Food Menus", UtensilsCrossed],
  ["/owner/inventory", "Inventory", Boxes],
  ["/owner/hrm", "Staff & HRM", Users],
  ["/owner/expenses", "Expenses", Wallet],
  ["/owner/accounting", "Accounting", Calculator],
  ["/owner/waste", "Zero Waste", Recycle],
  ["/owner/reports", "Reports", BarChart3],
  ["/owner/profile", "Venue Profile", Store],
];

export default function OwnerLayout() {
  const { user, logout } = useAuthStore();
  if (!user || user.role !== "owner") return <OwnerLogin />;

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-emerald-900/40 bg-emerald-950 text-emerald-100/80 lg:flex">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-white p-0.5">
            <img src={logo} alt="" className="h-full w-full rounded object-cover" />
          </span>
          <div>
            <div className="text-sm font-bold text-white">Centre Panel</div>
            <div className="text-[10px] uppercase tracking-wider text-emerald-300/70">Owner Dashboard</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-brand-600 text-white" : "text-emerald-100/70 hover:bg-white/5 hover:text-white"
                }`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-emerald-200/70 hover:text-white">
            <ExternalLink className="h-4 w-4" /> View customer site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <ImpersonationBanner />
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map(([to, label, Icon, end]) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? "bg-brand-600 text-white" : "text-slate-500"}`}>
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <NotificationBell dark={false} />
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="text-[11px] text-slate-400">{user.phone}</div>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">{user.name[0]?.toUpperCase()}</span>
            <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="p-5 sm:p-7"><Outlet /></main>
      </div>
    </div>
  );
}

function OwnerLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await loginAccount(form);
      if (res.user.role !== "owner") { setError("This account is not a centre owner."); setBusy(false); return; }
      setAuth({ user: res.user, token: res.token });
      nav("/owner");
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect credentials."); setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-emerald-950 p-4">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#fff 1px,transparent 0)", backgroundSize: "22px 22px" }} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white p-1 ring-1 ring-slate-200">
            <img src={logo} alt="" className="h-full w-full rounded-xl object-cover" />
          </span>
          <div>
            <div className="font-display text-xl font-bold text-slate-900">Centre Panel</div>
            <div className="inline-flex items-center gap-1 text-xs text-slate-400"><Building2 className="h-3.5 w-3.5" /> Community Centre Owner</div>
          </div>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <Phone className="h-4 w-4 text-slate-400" />
            <input value={form.phone} onChange={set("phone")} className="auth-input" placeholder="Owner mobile number" required />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <Lock className="h-4 w-4 text-slate-400" />
            <input value={form.password} onChange={set("password")} type="password" className="auth-input" placeholder="Password" required />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in to Centre Panel"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Seeded owner: 01710000000 · password</p>
      </div>
    </div>
  );
}
