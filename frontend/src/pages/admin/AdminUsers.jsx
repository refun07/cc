import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Ban, CheckCircle2, Phone, Mail, CalendarDays } from "lucide-react";
import { adminUsers, adminSetUserStatus, adminImpersonate } from "../../services/api";
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
      <PageHead title="Users" subtitle="Customers, owners (vendors), admins and waste partners. Admins can take control of vendor accounts." />
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
    </div>
  );
}
