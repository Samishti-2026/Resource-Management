import { create } from 'zustand';
import { persist } from 'zustand/middleware';

let toastId = 0;

export const useUIStore = create(
  persist(
    (set, get) => ({
      // Desktop sidebar: true = full width, false = icon-only
      sidebarOpen: true,

      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      // Toast notifications
      toasts: [],

      addToast: (message, type = 'info', duration = 4000) => {
        const id = ++toastId;
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
        }, duration);
        return id;
      },

      removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // Convenience toast helpers
      get toast() {
        return {
          success: (msg) => get().addToast(msg, 'success'),
          error:   (msg) => get().addToast(msg, 'error'),
          info:    (msg) => get().addToast(msg, 'info'),
          warning: (msg) => get().addToast(msg, 'warning'),
        };
      },
    }),
    {
      name: 'ui-storage',
      partialize: (s) => ({ sidebarOpen: s.sidebarOpen }),
    }
  )
);
