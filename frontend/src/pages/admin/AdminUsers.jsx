import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, Ban, CheckCircle2 } from "lucide-react";
import { adminUsers, adminSetUserStatus, adminImpersonate } from "../../services/api";
import { useAuthStore } from "../../store/authStore";
import { toast } from "../../store/toastStore";
import { PageHead, Card, Table, Badge, Loading } from "./ui";

const ROLES = ["", "customer", "owner", "admin", "waste_partner"];

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
      <Card>
        {!rows ? <Loading /> : (
          <Table head={["Name", "Mobile", "Email", "Role", "Status", "Joined", "Actions"]}>
            {rows.map((u) => {
              const vendor = u.role === "owner" || u.role === "waste_partner";
              return (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{u.name[0]?.toUpperCase()}</span>
                      <span className="font-medium text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{u.phone}</td>
                  <td className="px-5 py-3 text-slate-500">{u.email || "—"}</td>
                  <td className="px-5 py-3 capitalize text-slate-600">{u.role.replaceAll("_", " ")}</td>
                  <td className="px-5 py-3"><Badge status={u.status} /></td>
                  <td className="px-5 py-3 tabular-nums text-slate-500">{u.created_at}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {vendor && (
                        <button disabled={busy === u.id} onClick={() => access(u)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 disabled:opacity-50">
                          <LogIn className="h-3.5 w-3.5" /> Access account
                        </button>
                      )}
                      {u.role !== "admin" && (u.status === "suspended"
                        ? <button disabled={busy === u.id} onClick={() => setStatus(u, "active")} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><CheckCircle2 className="h-3.5 w-3.5" /> Activate</button>
                        : <button disabled={busy === u.id} onClick={() => setStatus(u, "suspended")} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100"><Ban className="h-3.5 w-3.5" /> Suspend</button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
    </div>
  );
}
