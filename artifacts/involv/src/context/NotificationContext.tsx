import React, { createContext, useContext, useState, useCallback } from 'react';

export interface AppNotification {
  id: string;
  type: 'message' | 'application' | 'accepted' | 'announcement';
  title: string;
  body: string;
  opportunityId?: string;
  opportunityTitle?: string;
  read: boolean;
  createdAt: string;
}

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

// Mock seed notifications
const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1',
    type: 'accepted',
    title: 'Application accepted',
    body: 'You have been accepted for Peer Tutoring Programme — Maths & Sciences.',
    opportunityId: '2',
    opportunityTitle: 'Peer Tutoring Programme — Maths & Sciences',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'n2',
    type: 'message',
    title: 'New message',
    body: 'Mr. Okonkwo: "Welcome everyone! First session is this Thursday."',
    opportunityId: '2',
    opportunityTitle: 'Peer Tutoring Programme — Maths & Sciences',
    read: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'n3',
    type: 'application',
    title: 'New application',
    body: 'A new student applied to Riverside Park Clean-Up Campaign.',
    opportunityId: '1',
    opportunityTitle: 'Riverside Park Clean-Up Campaign',
    read: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback((id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((n: Omit<AppNotification, 'id' | 'read' | 'createdAt'>) => {
    const newN: AppNotification = {
      ...n,
      id: `n-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    setNotifications(prev => [newN, ...prev]);
    // Browser notification if permission granted
    if (Notification.permission === 'granted') {
      new Notification(n.title, { body: n.body, icon: '/favicon.png' });
    }
  }, []);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead, addNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
