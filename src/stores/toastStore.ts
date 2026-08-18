import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  // Опциональное действие — превращает toast в snackbar
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface Banner {
  id: string;
  title: string;
  message?: string;
  icon?: 'event-party' | 'event-trip' | 'event-calendar' | 'info'; // SVG icon key
  type: 'info' | 'warning' | 'event';
  onClick?: () => void;
  duration?: number; // если задан — авто-сокрытие
}

interface ToastState {
  toasts: Toast[];
  banners: Banner[];
  show: (message: string, type?: ToastType, duration?: number, action?: Toast['action']) => string;
  dismiss: (id: string) => void;
  showBanner: (b: Omit<Banner, 'id'>) => string;
  dismissBanner: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  banners: [],
  show: (message, type = 'info', duration = 3000, action) => {
    const id = Math.random().toString(36).slice(2);
    set(s => ({ toasts: [...s.toasts, { id, message, type, duration, action }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },
  dismiss: (id) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },
  showBanner: (b) => {
    const id = Math.random().toString(36).slice(2);
    set(s => ({ banners: [...s.banners, { id, ...b }] }));
    if (b.duration && b.duration > 0) {
      setTimeout(() => get().dismissBanner(id), b.duration);
    }
    return id;
  },
  dismissBanner: (id) => {
    set(s => ({ banners: s.banners.filter(b => b.id !== id) }));
  },
}));

// === Удобный API ===

export const toast = {
  success: (msg: string, duration?: number) => useToastStore.getState().show(msg, 'success', duration),
  error:   (msg: string, duration?: number) => useToastStore.getState().show(msg, 'error', duration),
  info:    (msg: string, duration?: number) => useToastStore.getState().show(msg, 'info', duration),
  warning: (msg: string, duration?: number) => useToastStore.getState().show(msg, 'warning', duration),
};

// Snackbar — toast с действием снизу
export const snackbar = {
  show: (message: string, opts: {
    actionLabel: string;
    onAction: () => void;
    type?: ToastType;
    duration?: number;
  }) => useToastStore.getState().show(
    message,
    opts.type || 'info',
    opts.duration ?? 5000,
    { label: opts.actionLabel, onClick: opts.onAction },
  ),
};

// In-app banner — большой блок сверху
export const banner = {
  show: (b: Omit<Banner, 'id'>) => useToastStore.getState().showBanner(b),
  dismiss: (id: string) => useToastStore.getState().dismissBanner(id),
};
