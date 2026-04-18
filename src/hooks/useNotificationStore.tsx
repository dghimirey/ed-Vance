import { create } from 'zustand';

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  type: 'attendance' | 'marks' | 'info';
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = 'dss_notifications_v1';
const MAX_ITEMS = 50;

const load = (): AppNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
};

const save = (items: AppNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore */
  }
};

interface State {
  notifications: AppNotification[];
  unreadCount: number;
  add: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markAllRead: () => void;
  clear: () => void;
}

export const useNotificationStore = create<State>((set, get) => ({
  notifications: load(),
  unreadCount: load().filter(n => !n.read).length,
  add: (n) => {
    const item: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      read: false,
    };
    const next = [item, ...get().notifications].slice(0, MAX_ITEMS);
    save(next);
    set({ notifications: next, unreadCount: next.filter(x => !x.read).length });
  },
  markAllRead: () => {
    const next = get().notifications.map(n => ({ ...n, read: true }));
    save(next);
    set({ notifications: next, unreadCount: 0 });
  },
  clear: () => {
    save([]);
    set({ notifications: [], unreadCount: 0 });
  },
}));
