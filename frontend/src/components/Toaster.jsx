import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { useToastStore } from "../store/toastStore";

const STYLES = {
  success: { icon: CheckCircle2, ring: "ring-emerald-200", bar: "bg-emerald-500", iconCls: "text-emerald-600" },
  error: { icon: AlertTriangle, ring: "ring-rose-200", bar: "bg-rose-500", iconCls: "text-rose-600" },
  info: { icon: Info, ring: "ring-brand-200", bar: "bg-brand-500", iconCls: "text-brand-600" },
};

export default function Toaster() {
  const { toasts, dismiss } = useToastStore();

  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[2000] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6">
      <AnimatePresence>
        {toasts.map((t) => {
          const s = STYLES[t.type] || STYLES.info;
          const Icon = s.icon;
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={`pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl bg-white p-4 shadow-xl ring-1 ${s.ring}`}
              role="alert"
            >
              <span className={`mt-0.5 flex-shrink-0 ${s.iconCls}`}><Icon className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                {t.title && <div className="text-sm font-semibold text-slate-900">{t.title}</div>}
                <div className="text-sm text-slate-600">{t.message}</div>
              </div>
              <button onClick={() => dismiss(t.id)} className="flex-shrink-0 text-slate-300 transition hover:text-slate-500" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
              <span className={`absolute inset-x-0 bottom-0 h-1 ${s.bar} opacity-80`} />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>,
    document.body
  );
}
