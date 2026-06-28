import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useBookingStore = create(
  persist(
    (set) => ({
      // in-progress booking draft built on the centre detail page
      draft: null,
      // { centre, sessionType, eventDate, guestCount, foodSelections, eventType, quote }
      setDraft: (draft) => set({ draft }),
      patchDraft: (patch) =>
        set((s) => ({ draft: { ...(s.draft || {}), ...patch } })),
      clearDraft: () => set({ draft: null }),
    }),
    { name: "dscc-booking-draft" }
  )
);
