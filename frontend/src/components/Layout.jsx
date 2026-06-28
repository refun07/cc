import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { User, LogOut, CalendarCheck } from "lucide-react";
import logo from "../assets/dscc_3.jpg";
import AuthModal from "./AuthModal";
import { useAuthStore } from "../store/authStore";

function Logo({ size = "h-11 w-11", framed = true }) {
  const img = (
    <img
      src={logo}
      alt="Dhaka South City Corporation logo"
      className="h-full w-full rounded-full object-cover"
    />
  );
  if (!framed) return <span className={`${size} block`}>{img}</span>;
  return (
    <span
      className={`${size} grid place-items-center overflow-hidden rounded-full bg-white p-0.5 shadow-sm ring-1 ring-slate-200`}
    >
      {img}
    </span>
  );
}

function Header({ onSignIn }) {
  const linkCls = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition ${
      isActive ? "text-brand-700 bg-brand-50" : "text-slate-600 hover:text-brand-700"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="h-11 w-11" />
          <div className="leading-tight">
            <div className="font-extrabold text-slate-900">DSCC Marketplace</div>
            <div className="text-[11px] text-slate-500 -mt-0.5">
              Community Centre Booking
            </div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={linkCls}>
            Home
          </NavLink>
          <NavLink to="/centres" className={linkCls}>
            Centres
          </NavLink>
          <a className={linkCls({ isActive: false })} href="#how">
            How it works
          </a>
        </nav>
        <div className="flex items-center gap-2">
          <AccountMenu onSignIn={onSignIn} />
          <Link
            to="/centres"
            className="inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            Start Booking
          </Link>
        </div>
      </div>
    </header>
  );
}

function AccountMenu({ onSignIn }) {
  const { user, logout } = useAuthStore();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  if (!user) {
    return (
      <button
        onClick={() => onSignIn("login")}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <User className="h-4 w-4" /> Sign in
      </button>
    );
  }

  const initial = user.name?.[0]?.toUpperCase() || "U";
  return (
    <div className="relative hidden sm:block" onMouseLeave={() => setOpen(false)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 py-1.5 pl-1.5 pr-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
          {initial}
        </span>
        <span className="max-w-[8rem] truncate">{user.name.split(" ")[0]}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          <div className="border-b border-slate-100 px-4 py-2">
            <div className="truncate text-sm font-semibold text-slate-900">{user.name}</div>
            <div className="text-xs text-slate-400">{user.phone}</div>
          </div>
          <button
            onClick={() => { setOpen(false); nav("/my-bookings"); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <CalendarCheck className="h-4 w-4" /> My bookings
          </button>
          <button
            onClick={() => { logout(); setOpen(false); nav("/"); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-4 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <Logo size="h-10 w-10" />
            <span className="font-extrabold text-slate-900">DSCC Marketplace</span>
          </div>
          <p className="mt-2 text-slate-500">
            Verified Dhaka South City Corporation community centres for weddings,
            corporate events and gatherings — with zero waste management.
          </p>
        </div>
        <div>
          <div className="font-semibold text-slate-900 mb-2">Platform</div>
          <ul className="space-y-1 text-slate-500">
            <li>Browse centres</li>
            <li>Full / half day booking</li>
            <li>Food menu selection</li>
            <li>Local payments</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-900 mb-2">For Owners</div>
          <ul className="space-y-1 text-slate-500">
            <li>Inventory & HRM</li>
            <li>Expense tracking</li>
            <li>Zero waste management</li>
            <li>Settlements</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-900 mb-2">Payments</div>
          <ul className="space-y-1 text-slate-500">
            <li>bKash · Nagad · Rocket</li>
            <li>Upay · SSLCommerz</li>
            <li>Card · Bank Transfer</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Dhaka South City Corporation · Demo build
      </div>
    </footer>
  );
}

export default function Layout() {
  const [authMode, setAuthMode] = useState(null); // 'login' | 'register' | null

  return (
    <div className="min-h-screen flex flex-col">
      <Header onSignIn={(mode) => setAuthMode(mode || "login")} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <AuthModal
        open={authMode !== null}
        defaultMode={authMode || "register"}
        onClose={() => setAuthMode(null)}
      />
    </div>
  );
}
