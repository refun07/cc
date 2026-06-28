import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      original: null, // admin session stashed while impersonating a vendor
      setAuth: ({ user, token }) => set({ user, token }),
      logout: () => set({ user: null, token: null, original: null }),
      startImpersonation: ({ user, token }) => {
        const { user: u, token: t } = get();
        set({ original: { user: u, token: t }, user, token });
      },
      stopImpersonation: () => {
        const o = get().original;
        if (o) set({ user: o.user, token: o.token, original: null });
      },
    }),
    { name: "dscc-auth" }
  )
);

// Read token outside React (for axios interceptor) without importing the store cyclically.
export function getStoredToken() {
  try {
    return JSON.parse(localStorage.getItem("dscc-auth"))?.state?.token || null;
  } catch {
    return null;
  }
}
