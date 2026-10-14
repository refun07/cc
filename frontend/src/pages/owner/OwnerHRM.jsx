import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Wallet, RefreshCw, BadgeDollarSign, KeyRound, X, IdCard, ImagePlus, FileText, Trash2, Plus, LogIn, Settings2, Save, ScanLine, Sparkles, CheckCircle2, Clock, Plane, XCircle, Loader2 } from "lucide-react";
import CrudPanel from "./CrudPanel";
import { Badge, Card, Table, Loading, StatCard, PageHead } from "../admin/ui";
import { taka } from "../../lib/format";
import {
  ownerMarkAttendance, ownerPayroll, ownerGeneratePayroll, ownerUpdatePayroll,
  ownerPayPayroll, ownerDisburseAll, ownerSetEmployeeLogin, ownerUpload, ownerUpdate, ownerImpersonateStaff,
  ownerHrSettings, ownerUpdateHrSettings, ownerScanNid, ownerAttendanceReport,
} from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";

const ATT_STYLE = { present: "bg-emerald-100 text-emerald-700", absent: "bg-rose-100 text-rose-700", leave: "bg-amber-100 text-amber-700", late: "bg-orange-100 text-orange-700" };

function Attendance({ row, reload }) {
  const mark = async (status) => {
    try { await ownerMarkAttendance(row.id, status); toast.success(`${row.name} marked ${status}.`); reload(); }
    catch (e) { toast.error(e.response?.data?.message || "Could not update attendance."); }
  };
  const ATT_ICON = { present: CheckCircle2, late: Clock, leave: Plane, absent: XCircle };
  if (row.today_attendance) {
    const Icon = ATT_ICON[row.today_attendance];
    return (
      <div className="flex items-center gap-1.5">
        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${ATT_STYLE[row.today_attendance]}`}>
          {Icon && <Icon className="h-3 w-3" />} {row.today_attendance}
        </span>
        {row.today_check_in && <span className="text-[11px] text-slate-400">{row.today_check_in}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-1">
      <button onClick={() => mark("present")} className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3 w-3" /> Present</button>
      <button onClick={() => mark("late")} className="inline-flex items-center gap-1 rounded-md bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700 hover:bg-orange-100"><Clock className="h-3 w-3" /> Late</button>
      <button onClick={() => mark("leave")} className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"><Plane className="h-3 w-3" /> Leave</button>
      <button onClick={() => mark("absent")} className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100"><XCircle className="h-3 w-3" /> Absent</button>
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
        {employee.phone ? (
          <p className="mt-2 text-sm text-slate-500">{employee.name} signs in at <b>/staff</b> using mobile <b className="text-slate-800">{employee.phone}</b> and this password.</p>
        ) : (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This staff member has <b>no mobile number</b>. Add a phone via ✎ Edit first — staff sign in with their mobile number.
          </div>
        )}
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Set a password (min 6 chars)" disabled={!employee.phone}
          className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={() => onClose(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
          <button onClick={save} disabled={busy || !employee.phone} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : employee.has_login ? "Reset password" : "Enable login"}</button>
        </div>
      </div>
    </div>
  );
}

const DOC_TYPES = ["NID copy", "Passport", "Birth certificate", "Academic certificate", "Training certificate", "Professional license", "Appointment letter", "Contract", "Experience letter", "Other"];

function ProfileModal({ employee, onClose }) {
  const [emp, setEmp] = useState(employee);
  const [uploading, setUploading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [docName, setDocName] = useState(DOC_TYPES[0]);
  if (!employee) return null;
  const docs = emp.documents || [];

  const scanNid = async (file) => {
    if (!file) return;
    setScanning(true);
    try {
      const [fields, up] = await Promise.all([ownerScanNid(file), ownerUpload(file)]);
      const patch = {};
      if (fields.name && !emp.name) patch.name = fields.name; // don't overwrite an existing name
      if (fields.nid) patch.nid = fields.nid;
      if (fields.date_of_birth) patch.date_of_birth = fields.date_of_birth;
      if (fields.address) patch.address = fields.address;
      patch.documents = [...docs, { name: "NID copy", url: up.url }];
      await persist(patch);
      const filled = Object.keys(patch).filter((k) => k !== "documents");
      toast.success(filled.length ? `Auto-filled: ${filled.join(", ")}.` : "NID attached (no readable fields).");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not scan the ID.");
    } finally {
      setScanning(false);
    }
  };

  const persist = async (patch) => {
    try {
      const updated = await ownerUpdate("employees", emp.id, { ...emp, ...patch });
      setEmp(updated); onClose(true, updated);
    } catch (e) { toast.error(e.response?.data?.message || "Could not save."); }
  };

  const uploadPhoto = async (file) => {
    if (!file) return; setUploading(true);
    try { const { url } = await ownerUpload(file); await persist({ photo: url }); toast.success("Photo updated."); }
    catch (e) { toast.error(e.response?.data?.message || "Upload failed."); }
    finally { setUploading(false); }
  };
  const uploadDoc = async (file) => {
    if (!file) return; setUploading(true);
    const label = (docName || "Document").trim();
    try { const { url } = await ownerUpload(file); await persist({ documents: [...docs, { name: label, url }] }); toast.success(`${label} added.`); }
    catch (e) { toast.error(e.response?.data?.message || "Upload failed."); }
    finally { setUploading(false); }
  };
  const removeDoc = (url) => persist({ documents: docs.filter((d) => d.url !== url) });

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => onClose(false)}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-slate-900"><IdCard className="h-5 w-5 text-brand-600" /> {emp.name}</h2>
          <button onClick={() => onClose(false)} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>

        {/* Photo */}
        <div className="mt-4 flex items-center gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-slate-100 text-2xl font-bold text-slate-400">
            {emp.photo ? <img src={emp.photo} alt="" className="h-full w-full object-cover" /> : emp.name[0]?.toUpperCase()}
          </span>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${uploading ? "opacity-60" : ""}`}>
            <ImagePlus className="h-4 w-4" /> {emp.photo ? "Change photo" : "Add photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadPhoto(e.target.files[0])} disabled={uploading} />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Square image (e.g. 400 × 400 px) · JPG or PNG · under 5 MB.</p>

        {/* NID auto-fill */}
        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/60 p-3">
          {scanning && <ScanSweep />}
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"><Sparkles className="h-5 w-5" /></span>
            <div>
              <div className="text-sm font-semibold text-slate-900">Scan NID to auto-fill</div>
              <div className="text-xs text-slate-500">Upload the ID photo or PDF — name, NID, DOB & address fill in automatically.</div>
            </div>
          </div>
          <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 ${scanning ? "opacity-70" : ""}`}>
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} {scanning ? "Reading…" : "Scan NID"}
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => scanNid(e.target.files[0])} disabled={scanning} />
          </label>
        </div>

        {/* Identity summary */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
          <Info label="NID" value={emp.nid} />
          <Info label="Date of birth" value={emp.date_of_birth} />
          <Info label="Nominee" value={emp.nominee_name} />
          <Info label="Nominee relation" value={emp.nominee_relation} />
          <Info label="Nominee phone" value={emp.nominee_phone} />
          <Info label="Nominee NID" value={emp.nominee_nid} />
          <div className="col-span-2"><Info label="Address" value={emp.address} /></div>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">Edit these details via the ✎ Edit button on the staff row.</p>

        {/* Documents & certifications */}
        <div className="mt-4">
          <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-800"><FileText className="h-4 w-4 text-brand-600" /> Documents & certifications</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2">
            <input
              list="doc-types" value={docName} onChange={(e) => setDocName(e.target.value)}
              placeholder="Document / certification name"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <datalist id="doc-types">{DOC_TYPES.map((t) => <option key={t} value={t} />)}</datalist>
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 ${uploading ? "opacity-60" : ""}`}>
              <Plus className="h-3.5 w-3.5" /> {uploading ? "Uploading…" : "Upload"}
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => uploadDoc(e.target.files[0])} disabled={uploading} />
            </label>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Type or pick a name (NID, certificates, license…), then upload an image or PDF. Add as many as you need.</p>
          {docs.length === 0 ? (
            <div className="mt-2 rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-400">No documents uploaded yet.</div>
          ) : (
            <div className="mt-2 space-y-2">
              {docs.map((d) => (
                <div key={d.url} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-medium text-slate-700 hover:text-brand-700"><FileText className="h-4 w-4 text-slate-400" /> {d.name}</a>
                  <button onClick={() => removeDoc(d.url)} className="grid h-7 w-7 place-items-center rounded-lg text-rose-500 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Info({ label, value }) {
  return <div><div className="text-xs text-slate-400">{label}</div><div className="font-semibold text-slate-800">{value || "—"}</div></div>;
}

function NidScanField({ editing, setEditing }) {
  const [scanning, setScanning] = useState(false);
  const scan = async (file) => {
    if (!file) return;
    setScanning(true);
    try {
      const f = await ownerScanNid(file);
      setEditing((cur) => ({
        ...cur,
        ...(f.name && !cur.name ? { name: f.name } : {}),
        ...(f.nid ? { nid: f.nid } : {}),
        ...(f.date_of_birth ? { date_of_birth: f.date_of_birth } : {}),
        ...(f.address ? { address: f.address } : {}),
      }));
      const filled = ["name", "nid", "date_of_birth", "address"].filter((k) => f[k]);
      toast.success(filled.length ? `Auto-filled: ${filled.join(", ")}.` : "No readable fields on the ID.");
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not scan the ID.");
    } finally {
      setScanning(false);
    }
  };
  return (
    <div className="relative flex flex-wrap items-center justify-between gap-3 overflow-hidden rounded-xl border border-brand-200 bg-brand-50/60 p-3">
      {scanning && <ScanSweep />}
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-600 text-white"><Sparkles className="h-5 w-5" /></span>
        <div>
          <div className="text-sm font-semibold text-slate-900">Scan NID to auto-fill</div>
          <div className="text-xs text-slate-500">Upload the ID photo or PDF — name, NID, DOB & address fill in automatically.</div>
        </div>
      </div>
      <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700 ${scanning ? "opacity-70" : ""}`}>
        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />} {scanning ? "Reading…" : "Scan NID"}
        <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => scan(e.target.files[0])} disabled={scanning} />
      </label>
    </div>
  );
}

/** Animated scan-line sweep shown while a document is being read. */
function ScanSweep() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-y-0 -left-1/3 w-1/3 animate-[scanx_1.2s_linear_infinite] bg-gradient-to-r from-transparent via-brand-400/30 to-transparent" />
    </div>
  );
}

function StaffTab() {
  const [loginFor, setLoginFor] = useState(null);
  const [profileFor, setProfileFor] = useState(null);
  const [reloadFn, setReloadFn] = useState(null);
  const nav = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);

  const openPortal = async (row) => {
    try {
      const res = await ownerImpersonateStaff(row.id);
      startImpersonation({ user: res.user, token: res.token });
      toast.info(`Opened ${row.name}'s staff portal.`);
      nav("/staff");
    } catch (e) { toast.error(e.response?.data?.message || "Could not open staff portal."); }
  };

  return (
    <>
    <CrudPanel
      resource="employees"
      title="Staff"
      subtitle="Manage staff, designations, salaries, attendance and login access."
      searchPlaceholder="Search staff…" searchKeys={["name","designation","employee_code","phone"]}
      addLabel="Add staff"
      formHeader={(editing, setEditing) => <NidScanField editing={editing} setEditing={setEditing} />}
      rowActions={(row, reload) => (
        <>
        <button
          onClick={() => { setProfileFor(row); setReloadFn(() => reload); }}
          title="Profile & documents"
          className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100">
          <IdCard className="h-3.5 w-3.5" /> Profile
        </button>
        {row.has_login && (
          <button
            onClick={() => openPortal(row)}
            title="Open staff portal as this employee"
            className="inline-flex items-center gap-1 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100">
            <LogIn className="h-3.5 w-3.5" /> Open portal
          </button>
        )}
        <button
          onClick={() => { setLoginFor(row); setReloadFn(() => reload); }}
          title={row.has_login ? "Reset login" : "Enable login"}
          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold ${row.has_login ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-500 hover:bg-slate-100"}`}>
          <KeyRound className="h-3.5 w-3.5" /> {row.has_login ? "Login ✓" : "Login"}
        </button>
        </>
      )}
      defaults={{ name: "", phone: "", designation: "Event Coordinator", employment_type: "monthly", salary: 0, hourly_rate: 0, status: "active", joined_at: new Date().toISOString().slice(0, 10) }}
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
        { key: "designation", label: "Designation", render: (r) => (
          <div>
            <div>{r.designation}</div>
            <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.employment_type === "hourly" ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"}`}>
              {r.employment_type === "hourly" ? "Contractual · hourly" : "Monthly"}
            </span>
          </div>
        ) },
        { key: "salary", label: "Pay", render: (r) => <span className="tabular-nums">{r.employment_type === "hourly" ? `${taka(r.hourly_rate)}/hr` : taka(r.salary)}</span> },
        { key: "status", label: "Status", render: (r) => <Badge status={r.status} /> },
        { key: "today_attendance", label: "Today", render: (r, reload) => <Attendance row={r} reload={reload} /> },
      ]}
      fields={[
        { key: "name", label: "Full name", required: true, full: true, section: "Basic details" },
        { key: "designation", label: "Designation", type: "select", options: ["Venue Manager", "Front Desk Officer", "Maintenance Staff", "Security Guard", "Cleaner", "Catering Lead", "Event Coordinator"] },
        { key: "phone", label: "Phone" },
        { key: "employment_type", label: "Employment type", type: "select", options: [["monthly", "Monthly (salaried)"], ["hourly", "Contractual (hourly)"]], section: "Employment & pay" },
        { key: "salary", label: "Monthly salary (৳)", type: "number", hint: "For monthly staff." },
        { key: "hourly_rate", label: "Hourly rate (৳/hr)", type: "number", hint: "For contractual/hourly staff." },
        { key: "status", label: "Status", type: "select", options: ["active", "inactive", "on_leave"] },
        { key: "joined_at", label: "Joined", type: "date" },
        { key: "nid", label: "NID number", section: "Identity" },
        { key: "date_of_birth", label: "Date of birth", type: "date" },
        { key: "address", label: "Address", type: "textarea", full: true },
        { key: "nominee_name", label: "Nominee name", section: "Nominee" },
        { key: "nominee_relation", label: "Nominee relation" },
        { key: "nominee_phone", label: "Nominee phone" },
        { key: "nominee_nid", label: "Nominee NID" },
        { key: "late_after", label: "Late after (HH:MM)", section: "Attendance & payroll overrides", hint: "Blank = inherit centre / global." },
        { key: "absence_deduction_rate", label: "Absence deduction (× day)", type: "number", hint: "Blank = inherit centre / global." },
        { key: "leave_deduction_rate", label: "Leave deduction (× day)", type: "number", hint: "Blank = inherit centre / global." },
        { key: "late_penalty", label: "Late penalty (৳/day)", type: "number", hint: "Blank = inherit centre / global." },
        { key: "standard_hours", label: "Standard hours/day", type: "number", hint: "For hourly staff. Blank = inherit centre." },
        { key: "weekly_off", label: "Weekly off day", type: "select", options: [["", "Inherit centre"], "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] },
      ]}
    />
    <LoginModal employee={loginFor} onClose={(changed) => { if (changed) reloadFn?.(); setLoginFor(null); }} />
    {profileFor && <ProfileModal employee={profileFor} onClose={(changed) => { if (changed) reloadFn?.(); setProfileFor(null); }} />}
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
          <Table head={["Employee", "Present/Absent", "Hours", "Basic", "Bonus", "Deduction", "Net salary", "Status", "Action"]}>
            {data.data.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800">{p.employee_name}</div>
                  <div className="text-xs text-slate-400">{p.designation}{p.employment_type === "hourly" ? ` · ${taka(p.hourly_rate)}/hr` : ""}</div>
                </td>
                <td className="px-5 py-3 text-sm"><span className="text-emerald-600">{p.present_days}</span> / <span className="text-rose-600">{p.absent_days}</span></td>
                <td className="px-5 py-3">
                  {p.employment_type !== "hourly" ? <span className="text-slate-300">—</span>
                    : p.status === "paid" ? <span className="tabular-nums">{p.hours_worked}h</span>
                      : <input type="number" defaultValue={p.hours_worked} onBlur={(e) => edit(p, "hours_worked", e.target.value)} className="w-20 rounded border border-slate-200 px-2 py-1 text-sm tabular-nums" />}
                </td>
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

function HrSettingsTab() {
  const [form, setForm] = useState(null);
  const [global, setGlobal] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    ownerHrSettings().then((r) => { setForm(r.data); setGlobal(r.global || {}); }).catch(() => setForm(false));
  }, []);

  if (form === false) return <Card><div className="p-10 text-center text-sm text-slate-400">No centre assigned.</div></Card>;
  if (!form) return <Loading rows={4} />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await ownerUpdateHrSettings({
        hr_late_cutoff: form.hr_late_cutoff || null,
        hr_absence_deduction_rate: form.hr_absence_deduction_rate === "" ? null : form.hr_absence_deduction_rate,
        hr_leave_deduction_rate: form.hr_leave_deduction_rate === "" ? null : form.hr_leave_deduction_rate,
        hr_late_penalty: form.hr_late_penalty === "" ? null : form.hr_late_penalty,
        hr_standard_hours: form.hr_standard_hours || 8,
        hr_weekly_off: form.hr_weekly_off || null,
      });
      toast.success("HR settings saved for your centre.");
    } catch (e) { toast.error(e.response?.data?.message || "Could not save."); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHead title="Centre HR settings" subtitle="Defaults for your staff. Blank fields inherit the ICCMS global rule; individual staff can still override these." />
      <Card>
        <div className="max-w-2xl space-y-5 p-6">
          <F label="Late check-in cutoff" hint={`Blank = global (${global.late_cutoff || "10:00"}). Staff checking in after this are marked late.`}>
            <input type="time" value={form.hr_late_cutoff || ""} onChange={set("hr_late_cutoff")} className="input w-40" />
          </F>
          <F label="Absence deduction rate" hint={`Blank = global (${global.absence_deduction_rate ?? 1}× per-day salary).`}>
            <input type="number" step="0.1" placeholder="global" value={form.hr_absence_deduction_rate ?? ""} onChange={set("hr_absence_deduction_rate")} className="input w-40" />
          </F>
          <F label="Approved-leave deduction rate" hint={`Blank = global (${global.leave_deduction_rate ?? 0}× per-day salary).`}>
            <input type="number" step="0.1" placeholder="global" value={form.hr_leave_deduction_rate ?? ""} onChange={set("hr_leave_deduction_rate")} className="input w-40" />
          </F>
          <F label="Late penalty" hint={`Blank = global (৳${global.late_penalty ?? 0} per late day).`}>
            <input type="number" placeholder="global" value={form.hr_late_penalty ?? ""} onChange={set("hr_late_penalty")} className="input w-40" />
          </F>
          <F label="Standard hours / day" hint="Used to estimate hourly staff pay from attendance.">
            <input type="number" step="0.5" value={form.hr_standard_hours ?? 8} onChange={set("hr_standard_hours")} className="input w-40" />
          </F>
          <F label="Weekly off day" hint="Informational — your centre's usual weekly holiday.">
            <select value={form.hr_weekly_off || ""} onChange={set("hr_weekly_off")} className="input w-48">
              <option value="">None</option>
              {["Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </F>
          <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save HR settings"}
          </button>
        </div>
      </Card>
    </div>
  );
}
function F({ label, hint, children }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

const STATUS_STYLE = {
  present: ["bg-emerald-50 text-emerald-700 ring-emerald-200", CheckCircle2],
  late: ["bg-amber-50 text-amber-700 ring-amber-200", Clock],
  leave: ["bg-sky-50 text-sky-700 ring-sky-200", Plane],
  absent: ["bg-rose-50 text-rose-700 ring-rose-200", XCircle],
};

/** Daily attendance report: one row per active employee, including unmarked staff. */
function AttendanceReportTab() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState(null);

  useEffect(() => {
    setData(null);
    ownerAttendanceReport(date).then(setData).catch(() => setData(false));
  }, [date]);

  const exportCsv = () => {
    if (!data) return;
    const cols = ["Employee code", "Name", "Designation", "Status", "Check-in", "Late (min)", "Cutoff", "Marked by"];
    const esc = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const body = data.rows.map((r) => [r.employee_code, r.name, r.designation, r.status || "not marked", r.check_in_at || "", r.late_by_minutes, r.cutoff, r.logged_by || ""].map(esc).join(","));
    const csv = ["﻿" + cols.join(","), ...body].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${data.date}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (data === false) return <Card><div className="p-10 text-center text-sm text-slate-400">Could not load the attendance report.</div></Card>;

  const s = data?.summary;
  const maxTrend = Math.max(1, ...(data?.trend || []).map((t) => t.present + t.late + t.absent + t.leave + t.not_marked));

  return (
    <div>
      <PageHead title="Daily attendance report" subtitle="Every active staff member for the selected day — including anyone nobody marked.">
        <div className="flex flex-wrap gap-2">
          <input type="date" value={date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="input min-h-11" />
          <button onClick={() => setDate(new Date().toISOString().slice(0, 10))} className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Today</button>
          <button onClick={exportCsv} disabled={!data} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
            <FileText className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </PageHead>

      {!data ? <Loading rows={6} /> : (
        <>
          <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            <StatCard icon={Users} label="Total staff" value={s.total} accent="brand" />
            <StatCard icon={CheckCircle2} label="Present" value={s.present} accent="emerald" />
            <StatCard icon={Clock} label="Late" value={s.late} accent="amber" />
            <StatCard icon={XCircle} label="Absent" value={s.absent} accent="rose" />
            <StatCard icon={Plane} label="On leave" value={s.leave} accent="violet" />
            <StatCard icon={Sparkles} label="Not marked" value={s.not_marked} accent="blue" />
          </div>

          <div className="mb-5 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <Card title="At a glance">
              <div className="space-y-4 p-5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-slate-500">Attendance rate</span>
                    <span className="text-2xl font-extrabold text-slate-900">{s.attendance_rate}%</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${s.attendance_rate}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">Present + late, out of {s.total} active staff.</p>
                </div>
                <div className="flex items-baseline justify-between border-t border-slate-100 pt-3">
                  <span className="text-sm text-slate-500">Total late minutes</span>
                  <span className="text-lg font-bold text-amber-700">{s.total_late_minutes} min</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-slate-500">Default cutoff</span>
                  <span className="font-mono text-sm font-semibold text-slate-700">{data.default_cutoff}</span>
                </div>
                {s.not_marked > 0 && (
                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">
                    <strong>{s.not_marked}</strong> staff {s.not_marked === 1 ? "has" : "have"} no attendance recorded for this day.
                  </div>
                )}
              </div>
            </Card>

            <Card title="Last 7 days">
              <div className="flex h-full items-end gap-2 p-5">
                {data.trend.map((t) => (
                  <div key={t.date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-28 w-full flex-col-reverse overflow-hidden rounded-lg bg-slate-100" title={`${t.date} · present ${t.present}, late ${t.late}, absent ${t.absent}, leave ${t.leave}`}>
                      <div className="bg-emerald-500" style={{ height: `${(t.present / maxTrend) * 100}%` }} />
                      <div className="bg-amber-400" style={{ height: `${(t.late / maxTrend) * 100}%` }} />
                      <div className="bg-rose-400" style={{ height: `${(t.absent / maxTrend) * 100}%` }} />
                      <div className="bg-sky-400" style={{ height: `${(t.leave / maxTrend) * 100}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{t.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card>
            <Table head={["Employee", "Designation", "Status", "Check-in", "Late by", "Cutoff", "Marked by"]}>
              {data.rows.map((r) => {
                const [style, Icon] = STATUS_STYLE[r.status] || ["bg-slate-50 text-slate-500 ring-slate-200", Sparkles];
                return (
                  <tr key={r.employee_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-800">{r.name}</div>
                      <div className="font-mono text-xs text-slate-400">{r.employee_code}</div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{r.designation || "—"}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ${style}`}>
                        <Icon className="h-3.5 w-3.5" />{r.status || "Not marked"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-sm text-slate-700">{r.check_in_at || "—"}</td>
                    <td className={`px-5 py-3 font-semibold tabular-nums ${r.late_by_minutes > 0 ? "text-amber-700" : "text-slate-400"}`}>
                      {r.late_by_minutes > 0 ? `${r.late_by_minutes} min` : "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{r.cutoff}</td>
                    <td className="px-5 py-3 text-xs text-slate-500">{r.logged_by || "—"}</td>
                  </tr>
                );
              })}
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}

export default function OwnerHRM() {
  const [tab, setTab] = useState("staff");
  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-2">
        {[["staff", "Staff & Attendance", Users], ["report", "Daily report", CheckCircle2], ["payroll", "Payroll & Salary", Wallet], ["settings", "HR settings", Settings2]].map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === t ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}>
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {tab === "staff" ? <StaffTab /> : tab === "report" ? <AttendanceReportTab /> : tab === "payroll" ? <PayrollTab /> : <HrSettingsTab />}
    </div>
  );
}
