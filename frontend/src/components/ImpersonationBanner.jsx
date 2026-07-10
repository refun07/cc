import { useNavigate } from "react-router-dom";
import { Eye, LogOut } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function ImpersonationBanner() {
  const { original, user, stopImpersonation } = useAuthStore();
  const nav = useNavigate();
  if (!original) return null;

  const backRole = original.user?.role;
  const dest = backRole === "owner" ? "/owner/hrm" : backRole === "waste_partner" ? "/partner" : "/admin/users";
  const backLabel = backRole === "owner" ? "Exit to centre" : backRole === "waste_partner" ? "Exit to partner" : "Exit to admin";
  const viewLabel = backRole === "owner" ? "Centre view" : "Admin view";

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-4 w-4" /> {viewLabel} — managing <b>{user?.name}</b>’s account
      </span>
      <button
        onClick={() => { stopImpersonation(); nav(dest); }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950/90 px-3 py-1 text-xs font-bold text-amber-50 hover:bg-amber-950"
      >
        <LogOut className="h-3.5 w-3.5" /> {backLabel}
      </button>
    </div>
  );
}
