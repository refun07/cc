import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Ban, CheckCircle2, Phone, Mail, CalendarDays, Plus, X } from "lucide-react";
import { adminUsers, adminCreateUser, adminSetUserStatus, adminImpersonate } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import { PageHead, Card, Badge, Loading } from "./ui";

const ROLES = ["", "customer", "owner", "admin", "waste_partner"];

const ROLE_STYLE = {
  customer: "bg-blue-100 text-blue-700",
  owner: "bg-emerald-100 text-emerald-700",
  admin: "bg-violet-100 text-violet-700",
  waste_partner: "bg-amber-100 text-amber-700",
};
const ROLE_AVATAR = {
  customer: "from-blue-500 to-indigo-600",
  owner: "from-emerald-500 to-teal-600",
  admin: "from-violet-500 to-purple-600",
  waste_partner: "from-amber-500 to-orange-600",
};

export default function AdminUsers() {
  const [rows, setRows] = useState(null);
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(null);
  const [creating, setCreating] = useState(false);
  const nav = useNavigate();
  const startImpersonation = useAuthStore((s) => s.startImpersonation);

  const load = () => { setRows(null); adminUsers(role ? { role } : {}).then(setRows).catch(() => setRows([])); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [role]);

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
      <PageHead title="Users" subtitle="Customers, owners (vendors), admins and waste partners. Admins can take control of vendor accounts.">
        <button onClick={() => setCreating(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Create user
        </button>
      </PageHead>
      <div className="mb-4 flex flex-wrap gap-2">
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
                  <div className="flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400" /> <span className="truncate">{u.email || "—"}</span></div>
                  <div className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-slate-400" /> Joined {u.created_at}</div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
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
      <UserModal open={creating} onClose={() => setCreating(false)} onCreated={(user) => { setCreating(false); setRole(user.role); setRows(null); adminUsers({ role: user.role }).then(setRows).catch(() => setRows([])); }} />
    </div>
  );
}

function UserModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "password",
    role: "owner",
    status: "active",
  });
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await adminCreateUser({ ...form, email: form.email || null });
      toast.success("User created.");
      onCreated(user);
    } catch (e) {
      toast.error(e.response?.data?.message || Object.values(e.response?.data?.errors || {})[0]?.[0] || "Could not create user.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold text-slate-900">Create user</h2>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="input min-h-11" value={form.name} onChange={set("name")} required /></Field>
          <Field label="Phone"><input className="input min-h-11" value={form.phone} onChange={set("phone")} placeholder="01XXXXXXXXX" required /></Field>
          <Field label="Email"><input type="email" className="input min-h-11" value={form.email} onChange={set("email")} /></Field>
          <Field label="Password"><input type="text" className="input min-h-11" value={form.password} onChange={set("password")} required minLength={6} /></Field>
          <Field label="Role"><select className="input min-h-11" value={form.role} onChange={set("role")}><option value="owner">Owner</option><option value="waste_partner">Waste partner</option><option value="customer">Customer</option></select></Field>
          <Field label="Status"><select className="input min-h-11" value={form.status} onChange={set("status")}><option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option></select></Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="min-h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-600">Cancel</button>
          <button disabled={busy} className="min-h-11 rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating..." : "Create user"}</button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="block"><span className="text-xs font-semibold text-slate-600">{label}</span><div className="mt-1">{children}</div></label>;
}
