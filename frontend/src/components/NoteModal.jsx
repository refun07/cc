import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, StickyNote } from "lucide-react";
import { toast } from "../store/toastStore";

/**
 * Edit an internal note. Props:
 *  open, title, initial, onSave(notes) -> Promise, onClose, onSaved(notes)
 */
export default function NoteModal({ open, title = "Internal note", initial = "", onSave, onClose, onSaved }) {
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);

  // sync the field whenever a (different) record opens
  useEffect(() => { if (open) setText(initial || ""); }, [open, initial]);

  const save = async () => {
    setBusy(true);
    try {
      await onSave(text);
      toast.success("Note saved.");
      onSaved?.(text);
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Could not save note.");
    } finally { setBusy(false); }
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.97 }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="inline-flex items-center gap-2 font-display text-xl font-bold text-slate-900"><StickyNote className="h-5 w-5 text-amber-500" /> {title}</h2>
              <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <textarea autoFocus value={text || ""} onChange={(e) => setText(e.target.value)} rows={5}
              placeholder="Add an internal note (only staff can see this)…"
              className="mt-4 w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">Cancel</button>
              <button onClick={save} disabled={busy} className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">{busy ? "Saving…" : "Save note"}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
