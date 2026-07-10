import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Building2, CalendarCheck, Users, CreditCard,
  LogOut, Lock, Phone, ShieldCheck, ExternalLink, BarChart3,
  HandCoins, CalendarRange, SlidersHorizontal, LayoutTemplate,
} from "lucide-react";
import { loginAccount } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import logo from "../../assets/dscc_3.jpg";
import NotificationBell from "../../components/NotificationBell";
import LanguageSwitcher from "../../components/LanguageSwitcher";

const NAV = [
  ["/admin", "Dashboard", LayoutDashboard, true],
  ["/admin/centres", "Centres", Building2],
  ["/admin/bookings", "Bookings", CalendarCheck],
  ["/admin/calendar", "Calendar", CalendarRange],
  ["/admin/users", "Users", Users],
  ["/admin/payments", "Payments", CreditCard],
  ["/admin/settlements", "Settlements", HandCoins],
  ["/admin/reports", "Reports", BarChart3],
  ["/admin/homepage", "Home page", LayoutTemplate],
  ["/admin/settings", "Payroll rules", SlidersHorizontal],
];

export default function AdminLayout() {
  const { user, logout } = useAuthStore();

  if (!user || user.role !== "admin") return <AdminLogin />;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 lg:flex">
        <div className="flex items-center gap-2 border-b border-slate-800 px-5 py-4">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-white p-0.5">
            <img src={logo} alt="" className="h-full w-full rounded object-cover" />
          </span>
          <div>
            <div className="text-sm font-bold text-white">DSCC Admin</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">Super Admin</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-brand-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`
              }
            >
              <Icon className="h-4.5 w-4.5" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <Link to="/" className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-slate-400 hover:text-white">
            <ExternalLink className="h-4 w-4" /> View customer site
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-5 py-3 backdrop-blur">
          {/* mobile nav */}
          <nav className="flex gap-1 overflow-x-auto lg:hidden">
            {NAV.map(([to, label, Icon, end]) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) => `flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? "bg-brand-600 text-white" : "text-slate-500"}`}>
                <Icon className="h-4 w-4" /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <LanguageSwitcher tone="dark" />
            <NotificationBell dark={false} />
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-900">{user.name}</div>
              <div className="text-[11px] text-slate-400">{user.phone}</div>
            </div>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {user.name[0]?.toUpperCase()}
            </span>
            <button onClick={logout} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="p-5 sm:p-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function AdminLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const res = await loginAccount(form);
      if (res.user.role !== "admin") {
        setError("This account is not an administrator.");
        setBusy(false);
        return;
      }
      setAuth({ user: res.user, token: res.token });
      nav("/admin");
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect credentials.");
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#fff 1px,transparent 0)", backgroundSize: "22px 22px" }} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white p-1 ring-1 ring-slate-200">
            <img src={logo} alt="" className="h-full w-full rounded-xl object-cover" />
          </span>
          <div>
            <div className="font-display text-xl font-bold text-slate-900">DSCC Admin</div>
            <div className="inline-flex items-center gap-1 text-xs text-slate-400"><ShieldCheck className="h-3.5 w-3.5" /> Super Admin Panel</div>
          </div>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <Phone className="h-4 w-4 text-slate-400" />
            <input value={form.phone} onChange={set("phone")} className="auth-input" placeholder="Admin mobile number" required />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <Lock className="h-4 w-4 text-slate-400" />
            <input value={form.password} onChange={set("password")} type="password" className="auth-input" placeholder="Password" required />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            {busy ? "Signing in…" : "Sign in to Admin"}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-slate-400">Seeded: 01700000000 · password</p>
      </div>
    </div>
  );
}
