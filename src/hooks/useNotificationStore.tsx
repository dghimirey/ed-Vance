import { useEffect, useState } from 'react';

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

let state: AppNotification[] = load();
const listeners = new Set<(s: AppNotification[]) => void>();

const setState = (next: AppNotification[]) => {
  state = next.slice(0, MAX_ITEMS);
  save(state);
  listeners.forEach(l => l(state));
};

const store = {
  add: (n: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const item: AppNotification = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      read: false,
    };
    setState([item, ...state]);
  },
  markAllRead: () => setState(state.map(n => ({ ...n, read: true }))),
  clear: () => setState([]),
};

export function useNotificationStore() {
  const [notifications, setNotifications] = useState<AppNotification[]>(state);

  useEffect(() => {
    listeners.add(setNotifications);
    return () => { listeners.delete(setNotifications); };
  }, []);

  return {
    notifications,
    unreadCount: notifications.filter(n => !n.read).length,
    add: store.add,
    markAllRead: store.markAllRead,
    clear: store.clear,
  };
}

export const notificationStore = store;
