import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Phone, User, Lock, Eye, EyeOff, Check } from "lucide-react";
import { registerAccount, loginAccount, requestRegistrationOtp, requestPasswordOtp, resetPasswordByPhone } from "../services/api";
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
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const titleId = useId();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [mode, setMode] = useState(defaultMode);
  const [form, setForm] = useState({ name: "", phone: "", password: "", confirmPassword: "", code: "" });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
      if (event.key !== "Tab") return;
      const controls = [...(dialogRef.current?.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex="0"]') || [])]
        .filter((element) => element.getClientRects().length);
      const first = controls[0];
      const last = controls.at(-1);
      const outside = !dialogRef.current?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || outside)) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || outside)) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setError("");
      setNotice("");
      setForm({ name: "", phone: "", password: "", confirmPassword: "", code: "" });
    }
  }, [open, defaultMode]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const isRegister = mode === "register";
  const isRegisterCode = mode === "register-code";
  const isResetCode = mode === "reset-code";
  const isForgot = mode === "forgot";
  const isLogin = mode === "login";
  const codeStep = isRegisterCode || isResetCode;

  const changeMode = (next) => {
    setMode(next);
    setError("");
    setNotice("");
  };

  const resend = async () => {
    setBusy(true);
    setError("");
    try {
      await (isRegisterCode ? requestRegistrationOtp : requestPasswordOtp)(normalizePhone(form.phone));
      setNotice("A new code has been sent by SMS.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not send a code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const phone = normalizePhone(form.phone);
    try {
      if (isRegister) {
        await requestRegistrationOtp(phone);
        setMode("register-code");
        setNotice("Enter the 6-digit code sent to your phone.");
        return;
      }
      if (isForgot) {
        await requestPasswordOtp(phone);
        setMode("reset-code");
        setNotice("If this number has an account, an SMS code has been sent.");
        return;
      }
      if (isResetCode) {
        await resetPasswordByPhone({ phone, code: form.code, password: form.password, password_confirmation: form.confirmPassword });
        setForm((f) => ({ ...f, code: "", password: "", confirmPassword: "" }));
        setMode("login");
        setNotice("Password updated. Sign in with your new password.");
        return;
      }
      const res = isRegisterCode
        ? await registerAccount({ name: form.name, phone, password: form.password, code: form.code })
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
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 28, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 28, scale: 0.96 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="relative max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-[28px] bg-white shadow-2xl ring-1 ring-black/5"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <button
              ref={closeRef}
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
                  <img src={logo} alt="ICCMS" className="h-full w-full rounded-xl object-cover" />
                </span>
                <div>
                  <div className="text-base font-bold leading-none text-white">ICCMS</div>
                  <div className="mt-1 text-[11px] font-semibold leading-none text-emerald-50/80">DSCC</div>
                </div>
              </div>

              <h2 id={titleId} className="relative mt-5 font-display text-[26px] font-bold leading-tight">
                {isRegister || isRegisterCode ? "Create your account" : isForgot || isResetCode ? "Reset your password" : "Welcome back"}
              </h2>
              <p className="relative mt-1 text-sm text-emerald-50/90">
                {isRegister || isRegisterCode
                  ? "Verify your mobile number to book a centre."
                  : isForgot || isResetCode ? "Use a code sent to your mobile number." : "Sign in with your mobile number to continue."}
              </p>
            </div>

            {/* segmented tab control floating over the seam */}
            {!isForgot && !isResetCode && <div className="relative -mt-6 px-7">
              <div className="flex rounded-2xl bg-white p-1 shadow-lg ring-1 ring-slate-100">
                {[
                  ["register", "Sign up"],
                  ["login", "Sign in"],
                ].map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => changeMode(m)}
                    className="relative flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition"
                  >
                    {(mode === m || (m === "register" && isRegisterCode)) && (
                      <motion.span
                        layoutId="auth-seg"
                        className="absolute inset-0 rounded-xl bg-brand-600"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className={`relative ${mode === m || (m === "register" && isRegisterCode) ? "text-white" : "text-slate-500"}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>}

            {/* ---------- Form ---------- */}
            <form onSubmit={submit} className="space-y-3.5 px-7 pb-7 pt-5">
              <AnimatePresence initial={false} mode="popLayout">
                {(isRegister || isRegisterCode) && (
                  <motion.div
                    key="name"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Field icon={User} label="Full name">
                      <input value={form.name} onChange={set("name")} className="auth-input" placeholder="e.g. Karim Ahmed" required readOnly={isRegisterCode} />
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
                  readOnly={codeStep}
                />
              </Field>

              {codeStep && <Field icon={Lock} label="SMS code">
                <input value={form.code} onChange={set("code")} className="auth-input" placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required />
              </Field>}

              {(isLogin || isRegister || codeStep) && <Field icon={Lock} label={isResetCode ? "New password" : "Password"}>
                <input
                  value={form.password}
                  onChange={set("password")}
                  type={showPw ? "text" : "password"}
                  className="auth-input"
                  placeholder={isRegister || codeStep ? "At least 6 characters" : "Your password"}
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  required
                />
                <button type="button" onClick={() => setShowPw((s) => !s)} aria-label="Toggle password" className="text-slate-400 transition hover:text-slate-600">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </Field>}

              {isResetCode && <Field icon={Lock} label="Confirm new password">
                <input value={form.confirmPassword} onChange={set("confirmPassword")} type="password" className="auth-input" autoComplete="new-password" required />
              </Field>}

              {notice && <p role="status" className="text-sm text-brand-700">{notice}</p>}

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
                {busy ? "Please wait…" : isRegister ? "Send verification code" : isRegisterCode ? "Verify & create account" : isForgot ? "Send reset code" : isResetCode ? "Reset password" : "Sign in & continue"}
              </button>

              {codeStep && <div className="flex justify-between text-xs">
                <button type="button" onClick={() => changeMode(isRegisterCode ? "register" : "forgot")} className="font-semibold text-brand-700 hover:underline">Edit number</button>
                <button type="button" onClick={resend} disabled={busy} className="font-semibold text-brand-700 hover:underline disabled:opacity-50">Resend code</button>
              </div>}

              {isRegister ? (
                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1">
                  {PERKS.map((p) => (
                    <span key={p} className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                      <Check className="h-3 w-3 text-brand-500" /> {p}
                    </span>
                  ))}
                </div>
              ) : isLogin ? (
                <p className="pt-1 text-center text-xs text-slate-400">
                  <Lock className="mr-1 inline h-3 w-3" /> Your number stays private and secure.
                </p>
              ) : null}

              <p className="text-center text-xs text-slate-400">
                {isRegister || isRegisterCode ? "Already have an account? " : isLogin ? "New here? " : "Remembered your password? "}
                <button
                  type="button"
                  onClick={() => changeMode(isRegister || isRegisterCode || isForgot || isResetCode ? "login" : "register")}
                  className="font-semibold text-brand-700 hover:underline"
                >
                  {isRegister || isRegisterCode || isForgot || isResetCode ? "Sign in" : "Create one"}
                </button>
              </p>
              {isLogin && <button type="button" onClick={() => changeMode("forgot")} className="block w-full text-center text-xs font-semibold text-brand-700 hover:underline">Forgot password?</button>}
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
