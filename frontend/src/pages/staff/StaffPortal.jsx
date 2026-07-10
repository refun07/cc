import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Phone, Lock, LogOut, IdCard, CalendarCheck, Wallet, CheckCircle2, XCircle, Building2, ExternalLink,
} from "lucide-react";
import { loginAccount, staffMe, staffAttendance, staffPayslips, staffCheckIn } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { taka } from "../../lib/format";
import { toast } from "../../store/toastStore";
import logo from "../../assets/dscc_3.jpg";
import NotificationBell from "../../components/NotificationBell";
import ImpersonationBanner from "../../components/ImpersonationBanner";

const ATT = { present: "bg-emerald-100 text-emerald-700", absent: "bg-rose-100 text-rose-700", leave: "bg-amber-100 text-amber-700", late: "bg-orange-100 text-orange-700" };

export default function StaffPortal() {
  const { user, logout } = useAuthStore();
  if (!user || user.role !== "staff") return <StaffLogin />;
  return <StaffDashboard onLogout={logout} />;
}

function StaffDashboard({ onLogout }) {
  const [me, setMe] = useState(null);
  const [att, setAtt] = useState([]);
  const [slips, setSlips] = useState([]);
  const [checking, setChecking] = useState(false);

  const reload = () => {
    staffMe().then(setMe).catch(() => setMe(false));
    staffAttendance().then(setAtt).catch(() => {});
    staffPayslips().then(setSlips).catch(() => {});
  };
  useEffect(reload, []);

  const checkIn = async () => {
    setChecking(true);
    try { const r = await staffCheckIn(); toast.success(r.message); reload(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not check in."); }
    finally { setChecking(false); }
  };

  if (me === false) return <div className="grid min-h-dvh place-items-center text-slate-400">No staff profile linked.</div>;
  if (!me) return <div className="grid min-h-dvh place-items-center text-slate-400">Loading…</div>;
  const p = me.profile;

  return (
    <div className="min-h-dvh bg-slate-100">
      <ImpersonationBanner />
      <header className="bg-emerald-950 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-lg bg-white p-0.5"><img src={logo} alt="" className="h-full w-full rounded object-cover" /></span>
            <div><div className="text-sm font-bold">Staff Portal</div><div className="text-[10px] uppercase tracking-wider text-emerald-300/70">DSCC Marketplace</div></div>
          </Link>
          <div className="flex items-center gap-2"><NotificationBell dark={true} /><button onClick={onLogout} className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20"><LogOut className="h-4 w-4" /> Sign out</button></div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6">
        {/* Profile */}
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 to-emerald-900 p-6 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-white/15 text-2xl font-bold">{p.name[0]}</span>
              <div>
                <h1 className="font-display text-2xl font-bold">{p.name}</h1>
                <p className="text-emerald-50/90">{p.designation}</p>
                <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-emerald-100/80"><IdCard className="h-4 w-4" /> {p.employee_code}</p>
              </div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 text-right">
              <div className="text-xs text-emerald-100/80">Monthly salary</div>
              <div className="text-xl font-extrabold">{taka(p.salary)}</div>
            </div>
          </div>
          <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-emerald-50/90"><Building2 className="h-4 w-4" /> {p.centre} · {p.area}</div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Stat icon={CheckCircle2} label="Present (30d)" value={me.stats.present_30d} cls="text-emerald-600" />
          <Stat icon={XCircle} label="Absent (30d)" value={me.stats.absent_30d} cls="text-rose-600" />
          <Stat icon={Wallet} label="Payslips" value={me.stats.paid_payslips} cls="text-brand-600" />
        </div>
        {/* Daily self check-in */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-slate-800">Daily attendance</div>
            {me.today_attendance ? (
              <div className="mt-0.5 text-sm text-slate-500">
                Today: <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ATT[me.today_attendance]}`}>{me.today_attendance}</span>
                {me.today_check_in && <span className="ml-2 text-xs text-slate-400">checked in at {me.today_check_in}</span>}
              </div>
            ) : (
              <div className="mt-0.5 text-sm text-amber-600">You haven't checked in today. Check in to record your attendance.</div>
            )}
          </div>
          {!me.today_attendance
            ? <button onClick={checkIn} disabled={checking} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"><CheckCircle2 className="h-4 w-4" /> {checking ? "Checking in…" : "Check in now"}</button>
            : <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Checked in</span>}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Payslips */}
          <Panel icon={Wallet} title="My payslips">
            {slips.length === 0 ? <Empty>No payslips yet.</Empty> : slips.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-t border-slate-50 px-5 py-3 first:border-0">
                <div>
                  <div className="font-semibold text-slate-800">{s.month}</div>
                  <div className="text-xs text-slate-400">Basic {taka(s.basic_salary)} · Bonus {taka(s.bonus)} · Deduction {taka(s.deduction)}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold tabular-nums text-slate-900">{taka(s.net_salary)}</div>
                  <div className={`text-xs font-semibold ${s.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{s.status === "paid" ? `Paid · ${s.payment_method || ""}` : "Pending"}</div>
                </div>
              </div>
            ))}
          </Panel>

          {/* Attendance */}
          <Panel icon={CalendarCheck} title="Attendance history">
            {att.length === 0 ? <Empty>No attendance records.</Empty> : att.map((a, i) => (
              <div key={i} className="flex items-center justify-between border-t border-slate-50 px-5 py-2.5 first:border-0">
                <span className="text-sm tabular-nums text-slate-600">{a.date}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${ATT[a.status]}`}>{a.status}</span>
              </div>
            ))}
          </Panel>
        </div>
      </main>
    </div>
  );
}

function Stat({ icon: Icon, label, value, cls }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <Icon className={`h-5 w-5 ${cls}`} />
      <div className="mt-2 text-2xl font-extrabold tabular-nums text-slate-900">{value}</div>
      <div className="text-sm text-slate-500">{label}</div>
    </div>
  );
}
function Panel({ icon: Icon, title, children }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 font-semibold text-slate-900"><Icon className="h-4 w-4 text-brand-600" /> {title}</div>
      <div className="max-h-80 overflow-y-auto">{children}</div>
    </div>
  );
}
function Empty({ children }) { return <div className="p-8 text-center text-sm text-slate-400">{children}</div>; }

function StaffLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const nav = useNavigate();
  const [form, setForm] = useState({ phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const res = await loginAccount(form);
      if (res.user.role !== "staff") { setError("This account is not a staff login."); setBusy(false); return; }
      setAuth({ user: res.user, token: res.token }); nav("/staff");
    } catch (err) { setError(err.response?.data?.message || "Incorrect credentials."); setBusy(false); }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-emerald-950 p-4">
      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px,#fff 1px,transparent 0)", backgroundSize: "22px 22px" }} />
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center overflow-hidden rounded-2xl bg-white p-1 ring-1 ring-slate-200"><img src={logo} alt="" className="h-full w-full rounded-xl object-cover" /></span>
          <div><div className="font-display text-xl font-bold text-slate-900">Staff Portal</div><div className="inline-flex items-center gap-1 text-xs text-slate-400"><IdCard className="h-3.5 w-3.5" /> Sign in to your staff account</div></div>
        </div>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <Phone className="h-4 w-4 text-slate-400" /><input value={form.phone} onChange={set("phone")} className="auth-input" placeholder="Your mobile number" required />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3.5 focus-within:border-brand-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
            <Lock className="h-4 w-4 text-slate-400" /><input type="password" value={form.password} onChange={set("password")} className="auth-input" placeholder="Password" required />
          </div>
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <button disabled={busy} className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <Link to="/" className="mt-4 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"><ExternalLink className="h-3 w-3" /> Back to main site</Link>
      </div>
    </div>
  );
}
