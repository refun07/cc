import { useNavigate } from "react-router-dom";
import { Eye, LogOut } from "lucide-react";
import { useAuthStore } from "../store/authStore";

export default function ImpersonationBanner() {
  const { original, user, stopImpersonation } = useAuthStore();
  const nav = useNavigate();
  if (!original) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-center text-sm font-semibold text-amber-950">
      <span className="inline-flex items-center gap-1.5">
        <Eye className="h-4 w-4" /> Admin view — managing <b>{user?.name}</b>’s account
      </span>
      <button
        onClick={() => { stopImpersonation(); nav("/admin/users"); }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-950/90 px-3 py-1 text-xs font-bold text-amber-50 hover:bg-amber-950"
      >
        <LogOut className="h-3.5 w-3.5" /> Exit to admin
      </button>
    </div>
  );
}
