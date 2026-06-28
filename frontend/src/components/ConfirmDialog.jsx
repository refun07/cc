import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { useConfirmStore } from "../store/confirmStore";

export default function ConfirmDialog() {
  const { state, close } = useConfirmStore();
  const open = !!state;
  const finish = (val) => { state?.resolve?.(val); close(); };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => finish(false)}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
            role="alertdialog" aria-modal="true"
          >
            <div className="flex items-start gap-3">
              <span className={`grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl ${state.danger ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600"}`}>
                {state.danger ? <AlertTriangle className="h-6 w-6" /> : <HelpCircle className="h-6 w-6" />}
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-bold text-slate-900">{state.title}</h2>
                {state.message && <p className="mt-1 text-sm text-slate-500">{state.message}</p>}
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => finish(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">{state.cancelText}</button>
              <button onClick={() => finish(true)}
                className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white ${state.danger ? "bg-rose-600 hover:bg-rose-700" : "bg-brand-600 hover:bg-brand-700"}`}>
                {state.confirmText}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
