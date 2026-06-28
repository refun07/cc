import { useEffect, useState } from "react";
import { Users, Wallet, RefreshCw, BadgeDollarSign, KeyRound, X } from "lucide-react";
import CrudPanel from "./CrudPanel";
import { Badge, Card, Table, Loading, StatCard } from "../admin/ui";
import { taka } from "../../lib/format";
import {
  ownerMarkAttendance, ownerPayroll, ownerGeneratePayroll, ownerUpdatePayroll,
  ownerPayPayroll, ownerDisburseAll, ownerSetEmployeeLogin,
} from "../../services/api";
import { toast } from "../../store/toastStore";

const ATT_STYLE = { present: "bg-emerald-100 text-emerald-700", absent: "bg-rose-100 text-rose-700", leave: "bg-amber-100 text-amber-700", late: "bg-orange-100 text-orange-700" };

function Attendance({ row, reload }) {
  const mark = async (status) => { await ownerMarkAttendance(row.id, status); reload(); };
  if (row.today_attendance)
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${ATT_STYLE[row.today_attendance]}`}>{row.today_attendance}</span>;
  return (
    <div className="flex gap-1">
      <button onClick={() => mark("present")} className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100">Present</button>
      <button onClick={() => mark("absent")} className="rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100">Absent</button>
    </div>
  );
}

function LoginModal({ employee, onClose }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  if (!employee) return null;
  const save = async () => {
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    setBusy(true);
    try { await ownerSetEmployeeLogin(employee.id, password); toast.success(`Login ${employee.has_login ? "reset" : "enabled"} for ${employee.name}.`); onClose(true); }
    catch (e) { toast.error(e.response?.data?.message || "Could not set login."); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-slate-900"><KeyRound className="h-5 w-5 text-brand-600" /> Staff login</h2>
          <button onClick={() => onClose(false)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-sm text-slate-500">{employee.name} will sign in at <b>/staff</b> with their mobile <b>{employee.phone || "—"}</b>.</p>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password (min 6 chars)"
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => onClose(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : employee.has_login ? "Reset password" : "Enable login"}</button>
        </div>
      </div>
    </div>
  );
}

function StaffTab() {
  const [loginFor, setLoginFor] = useState(null);
  const [reloadFn, setReloadFn] = useState(null);
  return (
    <>
    <CrudPanel
      resource="employees"
      title="Staff"
      subtitle="Manage staff, designations, salaries, attendance and login access."
      searchPlaceholder="Search staff…" searchKeys={["name","designation","employee_code","phone"]}
      addLabel="Add staff"
      rowActions={(row, reload) => (
        <button
          onClick={() => { setLoginFor(row); setReloadFn(() => reload); }}
          title={row.has_login ? "Reset login" : "Enable login"}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${row.has_login ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
          <KeyRound className="h-3.5 w-3.5" /> {row.has_login ? "Login ✓" : "Login"}
        </button>
      )}
      defaults={{ name: "", phone: "", designation: "Event Coordinator", salary: 0, status: "active", joined_at: new Date().toISOString().slice(0, 10) }}
      columns={[
        { key: "name", label: "Employee", render: (r) => (
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{r.name[0]?.toUpperCase()}</span>
            <div>
              <div className="font-medium text-slate-800">{r.name}</div>
              <div className="font-mono text-[11px] text-slate-400">{r.employee_code || "—"}</div>
            </div>
          </div>
        ) },
        { key: "designation", label: "Designation" },
        { key: "salary", label: "Salary", render: (r) => <span className="tabular-nums">{taka(r.salary)}</span> },
        { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
        { key: "today_attendance", label: "Today", render: (r, reload) => <Attendance row={r} reload={reload} /> },
      ]}
      fields={[
        { key: "name", label: "Full name", required: true, full: true },
        { key: "designation", label: "Designation", type: "select", options: ["Venue Manager", "Front Desk Officer", "Maintenance Staff", "Security Guard", "Cleaner", "Catering Lead", "Event Coordinator"] },
        { key: "phone", label: "Phone" },
        { key: "salary", label: "Monthly salary (৳)", type: "number" },
        { key: "status", label: "Status", type: "select", options: ["active", "inactive", "on_leave"] },
        { key: "joined_at", label: "Joined", type: "date" },
      ]}
    />
    <LoginModal employee={loginFor} onClose={(changed) => { if (changed) reloadFn?.(); setLoginFor(null); }} />
    </>
  );
}

function PayrollTab() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => { setData(null); ownerPayroll(month).then(setData).catch(() => setData({ data: [], summary: {} })); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [month]);

  const generate = async () => {
    setBusy(true);
    try { const r = await ownerGeneratePayroll(month); toast.success(r.message); load(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not generate."); }
    finally { setBusy(false); }
  };
  const pay = async (p) => { try { await ownerPayPayroll(p.id, "Bank Transfer"); toast.success(`Salary disbursed to ${p.employee_name}.`); load(); } catch (e) { toast.error(e.response?.data?.message || "Failed."); } };
  const disburseAll = async () => {
    try { const r = await ownerDisburseAll(month, "Bank Transfer"); toast.success(r.message); load(); }
    catch (e) { toast.error(e.response?.data?.message || "Failed."); }
  };
  const edit = async (p, field, value) => {
    try { await ownerUpdatePayroll(p.id, { [field]: Number(value || 0) }); load(); } catch { toast.error("Could not update."); }
  };

  const s = data?.summary || {};
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm" />
        <button onClick={generate} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Generate payroll
        </button>
        {s.pending > 0 && (
          <button onClick={disburseAll} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            <BadgeDollarSign className="h-4 w-4" /> Disburse all ({taka(s.pending)})
          </button>
        )}
      </div>

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Total payroll" value={s.total || 0} money accent="brand" />
        <StatCard icon={BadgeDollarSign} label="Disbursed" value={s.paid || 0} money accent="emerald" />
        <StatCard icon={Wallet} label="Pending" value={s.pending || 0} money accent="amber" />
      </div>

      <Card>
        {!data ? <Loading /> : data.data.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">No payroll for this month. Click “Generate payroll”.</div>
        ) : (
          <Table head={["Employee", "Present/Absent", "Basic", "Bonus", "Deduction", "Net salary", "Status", "Action"]}>
            {data.data.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3"><div className="font-medium text-slate-800">{p.employee_name}</div><div className="text-xs text-slate-400">{p.designation}</div></td>
                <td className="px-5 py-3 text-sm"><span className="text-emerald-600">{p.present_days}</span> / <span className="text-rose-600">{p.absent_days}</span></td>
                <td className="px-5 py-3 tabular-nums">{taka(p.basic_salary)}</td>
                <td className="px-5 py-3">
                  {p.status === "paid" ? <span className="tabular-nums">{taka(p.bonus)}</span> :
                    <input type="number" defaultValue={p.bonus} onBlur={(e) => edit(p, "bonus", e.target.value)} className="w-20 rounded border border-slate-200 px-2 py-1 text-sm tabular-nums" />}
                </td>
                <td className="px-5 py-3">
                  {p.status === "paid" ? <span className="tabular-nums">{taka(p.deduction)}</span> :
                    <input type="number" defaultValue={p.deduction} onBlur={(e) => edit(p, "deduction", e.target.value)} className="w-20 rounded border border-slate-200 px-2 py-1 text-sm tabular-nums" />}
                </td>
                <td className="px-5 py-3 font-bold tabular-nums text-slate-900">{taka(p.net_salary)}</td>
                <td className="px-5 py-3"><Badge status={p.status} /></td>
                <td className="px-5 py-3">
                  {p.status === "pending"
                    ? <button onClick={() => pay(p)} className="rounded-lg bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Pay salary</button>
                    : <span className="text-xs text-slate-400">Paid via {p.payment_method}</span>}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

export default function OwnerHRM() {
  const [tab, setTab] = useState("staff");
  return (
    <div>
      <div className="mb-5 flex gap-2">
        {[["staff", "Staff & Attendance", Users], ["payroll", "Payroll & Salary", Wallet]].map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "staff" ? <StaffTab /> : <PayrollTab />}
    </div>
  );
}
