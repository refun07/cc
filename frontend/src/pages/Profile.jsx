import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { UserCircle2, Phone, Lock, ShieldCheck, Save, LogOut, CalendarCheck } from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { updateMyProfile, changeMyPassword, requestProfilePhoneOtp } from "../services/api";
import { toast } from "../store/toastStore";
import NidProfile from "../components/NidProfile";

export default function Profile() {
  const { user, setAuth, token, logout } = useAuthStore();
  const [profile, setProfile] = useState({ name: "", phone: "", code: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [pw, setPw] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    if (user) setProfile({ name: user.name || "", phone: user.phone || "", code: "" });
  }, [user]);

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-slate-500">
        Please sign in to view your profile.
        <Link to="/centres" className="mt-4 block font-semibold text-brand-700">Browse centres →</Link>
      </div>
    );
  }

  const phoneChanged = profile.phone !== user.phone;

  const sendPhoneCode = async () => {
    setSendingPhoneOtp(true);
    try {
      await requestProfilePhoneOtp(profile.phone);
      toast.success("Verification code sent to the new number.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not send a code.");
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateMyProfile(profile);
      setAuth({ user: updated, token });
      toast.success("Profile updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || Object.values(err.response?.data?.errors || {})[0]?.[0] || "Could not update profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (pw.password !== pw.password_confirmation) { toast.error("New passwords do not match."); return; }
    setSavingPw(true);
    try {
      await changeMyPassword(pw);
      setPw({ current_password: "", password: "", password_confirmation: "" });
      toast.success("Password updated.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not change password.");
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-2xl font-bold ring-1 ring-white/15">
              {user.name?.[0]?.toUpperCase() || "U"}
            </span>
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand-200">
                <ShieldCheck className="h-3.5 w-3.5" /> My profile
              </div>
              <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">{user.name}</h1>
              <p className="mt-0.5 text-sm text-slate-300">{user.phone}</p>
            </div>
          </div>
          <Link to="/my-bookings" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
            <CalendarCheck className="h-4 w-4" /> My bookings
          </Link>
        </div>
      </div>

      {/* Account details */}
      <form onSubmit={saveProfile} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><UserCircle2 className="h-5 w-5 text-brand-600" /> Account details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Full name" icon={UserCircle2} value={profile.name} onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
          <Field label="Mobile number" icon={Phone} value={profile.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v, code: "" }))} placeholder="01XXXXXXXXX" />
          {phoneChanged && <>
            <button type="button" onClick={sendPhoneCode} disabled={sendingPhoneOtp} className="self-end rounded-lg border border-brand-300 px-4 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50 disabled:opacity-50">
              {sendingPhoneOtp ? "Sending…" : "Send SMS code"}
            </button>
            <Field label="Code sent to new number" icon={Lock} value={profile.code} onChange={(v) => setProfile((p) => ({ ...p, code: v }))} placeholder="6-digit code" />
          </>}
        </div>
        <div className="mt-5">
          <button disabled={savingProfile} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {savingProfile ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      {/* Password */}
      <div className="mt-6 border-y border-slate-200 py-6"><NidProfile userId={user.id} onSaved={(identity) => setAuth({ user: { ...user, name: identity.name, nid_saved: true }, token })} /></div>
      <form onSubmit={savePassword} className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-900"><Lock className="h-5 w-5 text-brand-600" /> Change password</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Current password" type="password" value={pw.current_password} onChange={(v) => setPw((p) => ({ ...p, current_password: v }))} className="sm:col-span-2" />
          <Field label="New password" type="password" value={pw.password} onChange={(v) => setPw((p) => ({ ...p, password: v }))} />
          <Field label="Confirm new password" type="password" value={pw.password_confirmation} onChange={(v) => setPw((p) => ({ ...p, password_confirmation: v }))} />
        </div>
        <div className="mt-5">
          <button disabled={savingPw} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-900 disabled:opacity-60">
            <Lock className="h-4 w-4" /> {savingPw ? "Updating…" : "Update password"}
          </button>
        </div>
      </form>

      <div className="mt-6 flex justify-end">
        <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, value, onChange, type = "text", placeholder, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="mt-1 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2.5 text-sm outline-none"
        />
      </div>
    </label>
  );
}
