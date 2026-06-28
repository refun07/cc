import { create } from "zustand";

let id = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  push: (toast) => {
    const t = { id: ++id, type: "info", duration: 3500, ...toast };
    set((s) => ({ toasts: [...s.toasts, t] }));
    if (t.duration) setTimeout(() => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })), t.duration);
    return t.id;
  },
  dismiss: (tid) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== tid) })),
}));

// Imperative helper usable outside React (e.g. axios interceptors).
export const toast = {
  success: (msg, opts) => useToastStore.getState().push({ type: "success", message: msg, ...opts }),
  error: (msg, opts) => useToastStore.getState().push({ type: "error", message: msg, ...opts }),
  info: (msg, opts) => useToastStore.getState().push({ type: "info", message: msg, ...opts }),
};
