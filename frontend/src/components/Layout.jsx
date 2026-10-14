import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { User, LogOut, CalendarCheck, FileText, Menu, X } from "lucide-react";
import logo from "../assets/dscc_3.jpg";
import ekpayLogo from "../assets/ekpay-logo.png";
import AuthModal from "./AuthModal";
import LanguageSwitcher from "./LanguageSwitcher";
import { useAuthStore } from "../store/authStore";
import { useT } from "../store/langStore";
import { getHomepage } from "../services/api";
import { EKPAY_CHANNELS } from "../lib/paymentChannels";

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
  const { user, logout } = useAuthStore();
  const { t } = useT();
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = useNavigate();
  const location = useLocation();

  // Close the mobile menu on route change.
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const linkCls = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium rounded-lg transition ${
      isActive ? "text-brand-700 bg-brand-50" : "text-slate-600 hover:text-brand-700"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between h-16">
        <Link to="/" className="flex items-center gap-2">
          <Logo size="h-10 w-10 sm:h-11 sm:w-11" />
          <div className="leading-none">
            <div className="text-base font-extrabold text-slate-900 sm:text-lg">ICCMS</div>
            <div className="mt-0.5 text-[11px] font-bold text-slate-700">DSCC</div>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          <NavLink to="/" end className={linkCls}>
            {t("nav.home")}
          </NavLink>
          <NavLink to="/centres" className={linkCls}>
            {t("nav.centres")}
          </NavLink>
          <NavLink to="/how-it-works" className={linkCls}>
            {t("nav.how")}
          </NavLink>
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher tone="dark" />
          <AccountMenu onSignIn={onSignIn} />
          <Link
            to="/centres"
            className="hidden sm:inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98]"
          >
            {t("nav.startBooking")}
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-4 py-3 sm:px-6">
            <NavLink to="/" end className={({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>{t("nav.home")}</NavLink>
            <NavLink to="/centres" className={({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>{t("nav.centres")}</NavLink>
            <NavLink to="/how-it-works" className={({ isActive }) => `block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? "bg-brand-50 text-brand-700" : "text-slate-700 hover:bg-slate-50"}`}>{t("nav.how")}</NavLink>
            <div className="px-1 pt-1"><LanguageSwitcher tone="dark" /></div>

            <div className="!mt-3 border-t border-slate-100 pt-3">
              {user ? (
                <>
                  <div className="px-3 pb-2">
                    <div className="text-sm font-semibold text-slate-900">{user.name}</div>
                    <div className="text-xs text-slate-400">{user.phone}</div>
                  </div>
                  <button onClick={() => { setMenuOpen(false); nav("/my-bookings"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <CalendarCheck className="h-4 w-4" /> {t("nav.myBookings")}
                  </button>
                  <button onClick={() => { setMenuOpen(false); nav("/profile"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <User className="h-4 w-4" /> {t("nav.myProfile")}
                  </button>
                  <button onClick={() => { setMenuOpen(false); nav("/my-applications"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    <FileText className="h-4 w-4" /> {t("nav.myApplications")}
                  </button>
                  <button onClick={() => { logout(); setMenuOpen(false); nav("/"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50">
                    <LogOut className="h-4 w-4" /> {t("nav.signout")}
                  </button>
                </>
              ) : (
                <button onClick={() => { setMenuOpen(false); onSignIn("login"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <User className="h-4 w-4" /> {t("nav.signin")}
                </button>
              )}
              <Link to="/centres" className="mt-2 flex items-center justify-center rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                {t("nav.startBooking")}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function AccountMenu({ onSignIn }) {
  const { user, logout } = useAuthStore();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  if (!user) {
    return (
      <button
        onClick={() => onSignIn("login")}
        className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        <User className="h-4 w-4" /> {t("nav.signin")}
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
            <CalendarCheck className="h-4 w-4" /> {t("nav.myBookings")}
          </button>
          <button
            onClick={() => { setOpen(false); nav("/profile"); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <User className="h-4 w-4" /> {t("nav.myProfile")}
          </button>
          <button
            onClick={() => { setOpen(false); nav("/my-applications"); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" /> {t("nav.myApplications")}
          </button>
          <button
            onClick={() => { logout(); setOpen(false); nav("/"); }}
            className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> {t("nav.signout")}
          </button>
        </div>
      )}
    </div>
  );
}

function Footer() {
  const { lang } = useT();
  const [cityLinks, setCityLinks] = useState([{ label: "Dhaka South City Corporation", url: "https://dscc.gov.bd/" }]);
  useEffect(() => {
    let active = true;
    getHomepage().then((content) => {
      if (active && Array.isArray(content.footer_links)) setCityLinks(content.footer_links);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-10 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <div className="flex items-center gap-2">
            <Logo size="h-10 w-10" />
            <span className="leading-none">
              <span className="block font-extrabold text-slate-900">ICCMS</span>
              <span className="mt-0.5 block text-[11px] font-bold text-slate-700">DSCC</span>
            </span>
          </div>
          <p className="mt-2 text-slate-500">
            Verified Dhaka South City Corporation community centres for weddings,
            corporate events and gatherings — with zero waste management.
          </p>
        </div>
        <div>
          <div className="font-semibold text-slate-900 mb-2">Platform</div>
          <ul className="space-y-1 text-slate-500">
            <li><Link to="/centres" className="hover:text-brand-700 focus-visible:underline">Browse centres</Link></li>
            <li><Link to="/centres" className="hover:text-brand-700 focus-visible:underline">Full / half day booking</Link></li>
            <li><Link to="/centres" className="hover:text-brand-700 focus-visible:underline">Decorator contact</Link></li>
            <li><Link to="/centres" className="hover:text-brand-700 focus-visible:underline">Local payments</Link></li>
            <li><Link to="/feedback" className="hover:text-brand-700 focus-visible:underline">Software feedback</Link></li>
            <li><Link to="/how-it-works" className="hover:text-brand-700 focus-visible:underline">How it works</Link></li>
          </ul>
        </div>
        <div>
          <div className="font-semibold text-slate-900 mb-2">City Corporation Links</div>
          <ul className="space-y-1 text-slate-500">
            {cityLinks.filter((link) => {
              try { return ["https:", "http:"].includes(new URL(link.url).protocol); }
              catch { return false; }
            }).map((link, index) => (
              <li key={`${link.url}-${index}`}><a href={link.url} target="_blank" rel="noopener noreferrer" className="hover:text-brand-700 focus-visible:underline">{lang === "bn" ? (link.label_bn || link.label) : link.label}</a></li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <span className="text-sm font-semibold text-slate-900">Pay with</span>
            <img src={ekpayLogo} alt="ekPay" className="h-7 w-20 object-contain" />
            <div className="flex flex-wrap gap-2" aria-label="Payment channels listed by ekPay">
              {EKPAY_CHANNELS.map(({ name, image }) => (
                <span key={name} className="inline-flex h-11 w-[86px] items-center justify-center rounded border border-slate-200 bg-white px-1.5" title={name}>
                  <img src={`${import.meta.env.BASE_URL}payment-logos/${image}`} alt={name} loading="lazy" className="max-h-8 max-w-full object-contain" />
                </span>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">Available options are confirmed on the ekPay checkout page and may vary by transaction.</p>
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
  const { lang } = useT();

  // Keep <html lang> in sync with the persisted language on load & change.
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

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
