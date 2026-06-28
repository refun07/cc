import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Truck, Leaf, LogOut, Lock, Phone, ExternalLink, Recycle,
} from "lucide-react";
import { loginAccount } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import ImpersonationBanner from "../../components/ImpersonationBanner";
import logo from "../../assets/dscc_3.jpg";
import NotificationBell from "../../components/NotificationBell";

const NAV = [
  ["/partner", "Dashboard", LayoutDashboard, true],
  ["/partner/pickups", "Pickups", Truck],
  ["/partner/impact", "Impact", Leaf],
];

export default function PartnerLayout() {
  const { user, logout } = useAuthStore();
  if (!user || user.role !== "waste_partner") return <PartnerLogin />;

  return (
    <div className="min-h-dvh bg-stone-100">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-teal-900 bg-teal-950 text-teal-100/80 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <span className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl bg-white p-0.5">
            <img src={logo} alt="DSCC" className="h-full w-full rounded-[10px] object-cover" />
          </span>
          <div>
            <div className="text-sm font-bold text-white">Zero Waste Partner</div>
            <div className="text-[10px] uppercase tracking-[0.16em] text-teal-300/70">Collection portal</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Partner portal">
          {NAV.map(([to, label, Icon, end]) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-teal-600 text-white" : "text-teal-100/70 hover:bg-white/5 hover:text-white"}`}>
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link to="/" className="flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-xs text-teal-200/70 hover:bg-white/5 hover:text-white">
            <ExternalLink className="h-4 w-4" /> View customer site
          </Link>
        </div>
      </aside>

      <div className="lg:pl-64">
        <ImpersonationBanner />
        <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
            <nav className="flex flex-1 gap-1 overflow-x-auto lg:hidden" aria-label="Partner portal">
              {NAV.map(([to, label, Icon, end]) => (
                <NavLink key={to} to={to} end={end}
                  className={({ isActive }) => `flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 text-xs font-semibold ${isActive ? "bg-teal-600 text-white" : "text-stone-500"}`}>
                  <Icon className="h-4 w-4" /> {label}
                </NavLink>
              ))}
            </nav>
            <div className="ml-auto hidden text-right sm:block">
              <div className="text-sm font-semibold text-stone-900">{user.name}</div>
              <div className="text-[11px] text-stone-400">{user.phone}</div>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-600 text-sm font-bold text-white" aria-hidden="true">
              {user.name[0]?.toUpperCase()}
            </span>
            <NotificationBell dark={false} />
            <button onClick={logout} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-stone-200 text-stone-500 transition hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="p-4 sm:p-7"><Outlet /></main>
      </div>
    </div>
  );
}

function PartnerLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await loginAccount(form);
      if (response.user.role !== "waste_partner") {
        setError("This account is not registered as a zero waste partner.");
        return;
      }
      setAuth({ user: response.user, token: response.token });
      nav("/partner");
    } catch (err) {
      setError(err.response?.data?.message || "Incorrect credentials. Check the mobile number and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-teal-950 p-4">
      <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#fff 1px,transparent 0)", backgroundSize: "22px 22px" }} />
      <div className="absolute -left-24 top-12 h-64 w-64 rounded-full bg-teal-500/15 blur-3xl" />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl shadow-black/30">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-50 text-teal-700">
            <Recycle className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold text-stone-900">Zero Waste Partner</h1>
            <p className="text-xs text-stone-500">DSCC collection and impact portal</p>
          </div>
        </div>
        <form onSubmit={submit} className="mt-7 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-stone-600">Mobile number</span>
            <span className="mt-1.5 flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100">
              <Phone className="h-4 w-4 text-stone-400" />
              <input value={form.phone} onChange={set("phone")} type="tel" autoComplete="username" className="auth-input" placeholder="01XXXXXXXXX" required />
            </span>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-stone-600">Password</span>
            <span className="mt-1.5 flex min-h-12 items-center gap-2 rounded-xl border border-stone-200 bg-stone-50 px-3.5 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-100">
              <Lock className="h-4 w-4 text-stone-400" />
              <input value={form.password} onChange={set("password")} type="password" autoComplete="current-password" className="auth-input" placeholder="Your password" required />
            </span>
          </label>
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700">{error}</div>}
          <button disabled={busy} className="min-h-12 w-full rounded-xl bg-teal-600 px-4 font-semibold text-white transition hover:bg-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            {busy ? "Signing in…" : "Sign in to Partner Portal"}
          </button>
        </form>
        <p className="mt-5 text-center text-xs text-stone-400">Demo: 01900000000 · password</p>
      </div>
    </div>
  );
}
