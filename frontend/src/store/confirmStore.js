import { create } from "zustand";

export const useConfirmStore = create((set) => ({
  state: null, // { title, message, confirmText, cancelText, danger, resolve }
  close: () => set({ state: null }),
  _open: (opts, resolve) => set({ state: { ...opts, resolve } }),
}));

/**
 * Promise-based confirm. Usage:
 *   if (await askConfirm({ title, message, danger: true })) { ... }
 */
export function askConfirm(opts = {}) {
  return new Promise((resolve) => {
    useConfirmStore.getState()._open(
      {
        title: opts.title || "Are you sure?",
        message: opts.message || "",
        confirmText: opts.confirmText || "Confirm",
        cancelText: opts.cancelText || "Cancel",
        danger: opts.danger ?? false,
      },
      resolve
    );
  });
}
