import { useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Phone, User, Mail, Lock, Eye, EyeOff, Check } from "lucide-react";
import { registerAccount, loginAccount } from "../services/api";
import { useAuthStore } from "../store/authStore";
import logo from "../assets/dscc_3.jpg";

// Normalise BD mobile numbers to the canonical 01XXXXXXXXX form.
function normalizePhone(raw) {
  let p = (raw || "").replace(/[\s-]/g, "");
  if (p.startsWith("+880")) p = "0" + p.slice(4);
  else if (p.startsWith("880")) p = "0" + p.slice(3);
  else if (p.length === 10 && p.startsWith("1")) p = "0" + p;
  return p;
}

const PERKS = ["Track every booking", "Faster checkout", "Manage cancellations & refunds"];

export default function AuthModal({ open, onClose, onSuccess, defaultMode = "register" }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState(defaultMode);
  const [form, setForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRegister = mode === "register";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    const phone = normalizePhone(form.phone);
    try {
      const res = isRegister
        ? await registerAccount({ ...form, phone })
        : await loginAccount({ phone, password: form.password });
      setAuth({ user: res.user, token: res.token });
      onSuccess?.(res.user);
      onClose?.();
    } catch (err) {
      const data = err.response?.data;
      setError(data?.errors ? Object.values(data.errors)[0][0] : data?.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/5"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/15 text-white/90 backdrop-blur transition hover:bg-white/25"
            >
              <X className="h-5 w-5" />
            </button>

            {/* ---------- Gorgeous header ---------- */}
            <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-emerald-700 to-teal-900 px-7 pb-12 pt-7 text-white">
              {/* mesh orbs */}
              <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-emerald-300/30 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute -bottom-16 left-1/4 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />
              <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]"
                style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "18px 18px" }} />

              <div className="relative flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white p-1 shadow-lg ring-1 ring-white/40">
                  <img src={logo} alt="DSCC" className="h-full w-full rounded-xl object-cover" />
                </span>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-100/90">DSCC Marketplace</div>
                  <div className="text-xs text-emerald-50/80">Community Centre Booking</div>
                </div>
              </div>

              <h2 className="relative mt-5 font-display text-[26px] font-bold leading-tight">
                {isRegister ? "Create your account" : "Welcome back"}
              </h2>
              <p className="relative mt-1 text-sm text-emerald-50/90">
                {isRegister
                  ? "Sign up with your mobile number to book a centre."
                  : "Sign in with your mobile number to continue."}
              </p>
            </div>

            {/* segmented tab control floating over the seam */}
            <div className="relative -mt-6 px-7">
              <div className="flex rounded-2xl bg-white p-1 shadow-lg ring-1 ring-slate-100">
                {[
                  ["register", "Sign up"],
                  ["login", "Sign in"],
                ].map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(""); }}
                    className="relative flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition"
                  >
                    {mode === m && (
                      <motion.span
                        layoutId="auth-seg"
                        className="absolute inset-0 rounded-xl bg-brand-600"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className={`relative ${mode === m ? "text-white" : "text-slate-500"}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ---------- Form ---------- */}
            <form onSubmit={submit} className="space-y-3.5 px-7 pb-7 pt-5">
              <AnimatePresence initial={false} mode="popLayout">
                {isRegister && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Field icon={User} label="Full name">
                      <input value={form.name} onChange={set("name")} className="auth-input" placeholder="e.g. Karim Ahmed" required={isRegister} />
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>

              <Field icon={Phone} label="Mobile number" prefix="+880">
                <input
                  value={form.phone}
                  onChange={set("phone")}
                  className="auth-input"
                  placeholder="1XXXXXXXXX"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                />
              </Field>

              <AnimatePresence initial={false} mode="popLayout">
                {isRegister && (
                  <motion.div
                    key="email"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Field icon={Mail} label="Email (optional)">
                      <input value={form.email} onChange={set("email")} type="email" className="auth-input" placeholder="you@example.com" />
                    </Field>
                  </motion.div>
                )}
              </AnimatePresence>

              <Field icon={Lock} label="Password">
                <input
                  value={form.password}
                  onChange={set("password")}
                  type={showPw ? "text" : "password"}
                  className="auth-input"
                  placeholder={isRegister ? "At least 6 characters" : "Your password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password" className="text-slate-400 transition hover:text-slate-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                disabled={busy}
                className="mt-1 w-full rounded-2xl bg-gradient-to-r from-brand-600 to-emerald-600 px-4 py-3.5 font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:shadow-brand-600/40 active:scale-[0.99] disabled:opacity-60"
              >
                {busy ? "Please wait…" : isRegister ? "Create account & continue" : "Sign in & continue"}
              </button>

              {isRegister ? (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
                  {PERKS.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Check className="h-3 w-3 text-brand-500" /> {p}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="pt-1 text-center text-xs text-slate-400">
                  <Lock className="mr-1 inline h-3 w-3" /> Your number stays private and secure.
                </p>
              )}

              <p className="text-center text-xs text-slate-400">
                {isRegister ? "Already have an account? " : "New here? "}
                <button
                  type="button"
                  onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); }}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {isRegister ? "Sign in" : "Create one"}
                </button>
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function Field({ icon: Icon, label, prefix, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-500">{label}</span>
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50/60 px-3.5 transition focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
        <Icon className="h-4 w-4 flex-shrink-0 text-slate-400" />
        {prefix && <span className="text-sm font-medium text-slate-500">{prefix}</span>}
        {children}
      </div>
    </label>
  );
}
