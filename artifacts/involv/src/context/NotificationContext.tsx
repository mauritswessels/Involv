import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  getMyNotifications, isNotInstalled, markNotificationsRead, queueMyReminders,
  type AppNotification,
} from '../services/notificationService';
import { logSafeError } from '../utils/safeConsole';

export type { AppNotification } from '../services/notificationService';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

/**
 * Real notifications from the database. Reminders are queued on sign-in and on
 * focus; the list refreshes every minute and immediately on Realtime inserts.
 * Signed-out visitors and unconfigured previews simply have no notifications.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const disabled = useRef(false);
  const load = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    setNotifications([]);
    disabled.current = false;
    if (!userId || !isSupabaseConfigured) { load.current = async () => {}; return; }
    let active = true, running = false, lastReminderRun = 0;
    const refresh = async () => {
      if (!active || running || disabled.current) return;
      running = true;
      try {
        if (Date.now() - lastReminderRun > 10 * 60_000) {
          lastReminderRun = Date.now();
          await queueMyReminders();
        }
        const rows = await getMyNotifications();
        if (active) setNotifications(rows);
      } catch (err) {
        if (isNotInstalled(err)) disabled.current = true; // migration not applied yet: stay quiet
        else logSafeError('[Notifications] refresh failed', err);
      } finally { running = false; }
    };
    load.current = refresh;
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);
    const channel = supabase.channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => void refresh())
      .subscribe();
    return () => {
      active = false; clearInterval(timer);
      window.removeEventListener('focus', onFocus); window.removeEventListener('online', onFocus);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    markNotificationsRead([id]).catch(err => logSafeError('[Notifications] mark read failed', err));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    markNotificationsRead().catch(err => logSafeError('[Notifications] mark all read failed', err));
  }, []);

  const refresh = useCallback(() => { void load.current(); }, []);
  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
