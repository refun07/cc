import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Ban, CheckCircle2, Phone, Mail, CalendarDays, Plus, Pencil, X } from "lucide-react";
import { adminCentres, adminUsers, adminCreateUser, adminUpdateCoordinator, adminUpdateAreaAdmin, adminUpdateCaretaker, adminSetUserStatus, adminImpersonate } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import { PageHead, Card, Badge, Loading } from "./ui";
import NidProfile from "../../components/NidProfile";

const ROLES = ["", "customer", "owner", "caretaker", "area_admin", "admin", "waste_partner"];
const COORDINATOR_PERMISSIONS = [
  ["centres.view", "View centres"],
  ["bookings.view", "View bookings"],
  ["bookings.create", "Create bookings"],
  ["bookings.note", "Edit booking notes"],
  ["bookings.verify", "Verify owner-completed bookings"],
];

const ROLE_STYLE = {
  customer: "bg-blue-100 text-blue-700",
  owner: "bg-emerald-100 text-emerald-700",
  admin: "bg-violet-100 text-violet-700",
  area_admin: "bg-cyan-100 text-cyan-800",
  project_coordinator: "bg-teal-100 text-teal-800",
  caretaker: "bg-green-100 text-green-800",
  waste_partner: "bg-amber-100 text-amber-700",
};
const ROLE_AVATAR = {
  customer: "from-blue-500 to-indigo-600",
  owner: "from-emerald-500 to-teal-600",
  admin: "from-violet-500 to-purple-600",
  area_admin: "from-cyan-600 to-teal-700",
  project_coordinator: "from-teal-600 to-emerald-700",
  caretaker: "from-green-600 to-emerald-700",
  waste_partner: "from-amber-500 to-orange-600",
};

export default function AdminUsers() {
  const [rows, setRows] = useState(null);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [identityUser, setIdentityUser] = useState(null);
  const [centres, setCentres] = useState([]);
  const [areas, setAreas] = useState([]);
  const nav = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);

  const load = () => { setRows(null); adminUsers(role ? { role } : {}).then(setRows).catch(() => setRows([])); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);
  useEffect(() => { adminCentres().then((rows) => { setCentres(rows); setAreas([...new Set(rows.map((centre) => centre.working_area).filter(Boolean))].sort()); }).catch(() => { setCentres([]); setAreas([]); }); }, []);

  const setStatus = async (u, status) => {
    setBusy(u.id);
    try { await adminSetUserStatus(u.id, status); setRows((l) => l.map((x) => (x.id === u.id ? { ...x, status } : x))); toast.success("User updated."); }
    catch (e) { toast.error(e.response?.data?.message || "Failed."); }
    finally { setBusy(null); }
  };

  const access = async (u) => {
    setBusy(u.id);
    try {
      const res = await adminImpersonate(u.id);
      startImpersonation({ user: res.user, token: res.token });
      toast.info(`You are now managing ${u.name}'s account.`);
      nav(u.role === "owner" ? "/owner" : "/partner");
    } catch (e) { toast.error(e.response?.data?.message || "Could not access account."); }
    finally { setBusy(null); }
  };

  return (
    <div>
      <PageHead title="Users" subtitle="Assign caretakers to centres and manage access permissions.">
        <button onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Create user
        </button>
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-2">
        {identityUser && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-label="NID profile" className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5"><div className="mb-4 flex items-center justify-between gap-3"><strong>{identityUser.name}</strong><button type="button" aria-label="Close" onClick={() => setIdentityUser(null)} className="grid h-11 w-11 place-items-center"><X className="h-5 w-5" /></button></div><NidProfile key={identityUser.id} userId={identityUser.id} onSaved={load} /></div></div>}
        {ROLES.map((r) => (
          <button key={r || "all"} onClick={() => setRole(r)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize transition ${role === r ? "bg-brand-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
            {r ? r.replaceAll("_", " ") : "All"}
          </button>
        ))}
      </div>
      {!rows ? (
        <Card><Loading /></Card>
      ) : rows.length === 0 ? (
        <Card><div className="p-10 text-center text-sm text-slate-400">No users found.</div></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((u) => {
            const vendor = u.role === "owner" || u.role === "waste_partner";
            return (
              <div key={u.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${ROLE_AVATAR[u.role] || "from-slate-400 to-slate-600"} text-base font-bold text-white`}>
                      {u.name[0]?.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-bold text-slate-900">{u.name}</div>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${ROLE_STYLE[u.role] || "bg-slate-100 text-slate-600"}`}>
                        {u.role.replaceAll("_", " ")}
                      </span>
                    </div>
                  </div>
                  <Badge status={u.status} />
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-slate-600">
                  <div className="inline-flex items-center gap-2"><Phone className="h-4 w-4 text-slate-400" /> {u.phone}</div>
                  {u.area_scope && <div className="text-xs font-semibold text-cyan-800">Working area: {u.area_scope}</div>}
                  {u.role === "caretaker" && <div className="text-xs font-semibold text-green-800">{u.centre_ids?.length || 0} assigned centres · {u.coordinator_permissions?.length || 0} permissions</div>}
                  {u.role === "project_coordinator" && <div className="text-xs font-semibold text-teal-800">{u.centre_ids?.length || 0} assigned centres · {u.coordinator_permissions?.length || 0} permissions</div>}
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{u.email || "—"}</span></div>
                  <div className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" /> Joined {u.created_at}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={() => setIdentityUser(u)} className="inline-flex min-h-11 items-center gap-1 rounded-lg border px-3 text-xs font-semibold text-brand-700"><Pencil className="h-4 w-4" /> NID profile</button>
                  {["project_coordinator", "area_admin", "caretaker"].includes(u.role) && <button type="button" onClick={() => setEditing(u)} className="inline-flex items-center gap-1 rounded-lg bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 hover:bg-teal-100"><Pencil className="h-3.5 w-3.5" /> Edit access</button>}
                  {vendor && (
                    <button disabled={busy === u.id} onClick={() => access(u)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50">
                      <LogIn className="h-3.5 w-3.5" /> Access account
                    </button>
                  )}
                  {u.role !== "admin" && (u.status === "suspended"
                    ? <button disabled={busy === u.id} onClick={() => setStatus(u, "active")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3.5 w-3.5" /> Activate</button>
                    : <button disabled={busy === u.id} onClick={() => setStatus(u, "suspended")} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"><Ban className="h-3.5 w-3.5" /> Suspend</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <UserModal open={creating || !!editing} editing={editing} areas={areas} centres={centres} onClose={() => { setCreating(false); setEditing(null); }} onSaved={(user) => { setCreating(false); setEditing(null); setRole(user.role); setRows(null); adminUsers({ role: user.role }).then(setRows).catch(() => setRows([])); }} />
    </div>
  );
}

function UserModal({ open, editing, areas, centres, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    password: "",
    role: "owner",
    area_scope: "",
    caretaker_centre_id: "",
    centre_ids: [],
    coordinator_permissions: ["centres.view", "bookings.view"],
    status: "active",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(editing ? {
      name: editing.name, phone: editing.phone, password: "", role: editing.role,
      area_scope: editing.area_scope || "", caretaker_centre_id: editing.caretaker_centre_id || "", centre_ids: editing.centre_ids || [],
      coordinator_permissions: editing.coordinator_permissions || [], status: editing.status,
    } : {
      name: "", phone: "", password: "", role: "owner", area_scope: "", caretaker_centre_id: "",
      centre_ids: [], coordinator_permissions: ["centres.view", "bookings.view"], status: "active",
    });
  }, [open, editing]);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = editing
        ? (editing.role === "area_admin" ? await adminUpdateAreaAdmin(editing.id, form)
          : editing.role === "caretaker" ? await adminUpdateCaretaker(editing.id, form)
            : await adminUpdateCoordinator(editing.id, form))
        : await adminCreateUser({ ...form, caretaker_centre_id: form.caretaker_centre_id ? Number(form.caretaker_centre_id) : null });
      toast.success(editing ? "User access updated." : "User created.");
      onSaved(user);
    } catch (e) {
      toast.error(e.response?.data?.message || Object.values(e.response?.data?.errors || {})[0]?.[0] || "Could not create user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="max-h-[95dvh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-slate-900">{editing ? "Edit user access" : "Create user"}</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input min-h-11" value={form.name} onChange={set("name")} required /></Field>
          <Field label="Phone"><input type="tel" inputMode="tel" autoComplete="tel" pattern="01[0-9]{9}" className="input min-h-11" value={form.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" required /></Field>
          <Field label={editing ? "New password (optional)" : "Password"}><input type="password" autoComplete="new-password" className="input min-h-11" value={form.password} onChange={set("password")} required={!editing} minLength={8} /></Field>
          <Field label="Role"><select className="input min-h-11" value={form.role} onChange={set("role")} disabled={!!editing}><option value="owner">Owner</option><option value="caretaker">Caretaker</option>{editing?.role === "project_coordinator" && <option value="project_coordinator">Project coordinator</option>}<option value="area_admin">Area admin</option><option value="waste_partner">Waste partner</option><option value="customer">Customer</option></select></Field>
          {form.role === "area_admin" && <Field label="Assigned working area"><select className="input min-h-11" value={form.area_scope} onChange={set("area_scope")} required><option value="">Select working area</option>{areas.map((area) => <option key={area} value={area}>{area}</option>)}</select></Field>}

          {!editing && <Field label="Status"><select className="input min-h-11" value={form.status} onChange={set("status")}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></Field>}
        </div>
        {["project_coordinator", "caretaker"].includes(form.role) && <>
          <fieldset className="mt-5 border-t border-slate-200 pt-4"><legend className="text-sm font-bold text-slate-800">Assign community centres</legend><div className="mt-3 grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2">{centres.map((centre) => <label key={centre.id} className="flex cursor-pointer items-start gap-2 rounded border border-slate-200 p-2 text-sm"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={form.centre_ids.includes(centre.id)} onChange={() => setForm((current) => ({ ...current, centre_ids: current.centre_ids.includes(centre.id) ? current.centre_ids.filter((id) => id !== centre.id) : [...current.centre_ids, centre.id] }))} /><span>{centre.name}<span className="block text-xs text-slate-500">{centre.area}</span></span></label>)}</div>{centres.length === 0 && <p className="mt-2 text-sm text-slate-500">Create a centre before assigning a caretaker.</p>}</fieldset>
          <fieldset className="mt-5 border-t border-slate-200 pt-4"><legend className="text-sm font-bold text-slate-800">Permissions management</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{COORDINATOR_PERMISSIONS.map(([key, label]) => <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700"><input type="checkbox" className="accent-brand-600" checked={form.coordinator_permissions.includes(key)} onChange={() => setForm((current) => ({ ...current, coordinator_permissions: current.coordinator_permissions.includes(key) ? current.coordinator_permissions.filter((permission) => permission !== key) : [...current.coordinator_permissions, key] }))} />{label}</label>)}</div></fieldset>
        </>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
          <button disabled={busy || (["project_coordinator", "caretaker"].includes(form.role) && form.centre_ids.length === 0)} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving..." : editing ? "Save access" : "Create user"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
