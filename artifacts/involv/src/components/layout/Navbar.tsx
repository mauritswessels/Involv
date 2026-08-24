import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  BellIcon, BookmarkIcon, CheckIcon, ChevronDownIcon,
  LayoutDashboardIcon, MenuIcon, MessageSquareIcon,
  PlusIcon, ShieldIcon, XIcon,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const NOTIF_ICONS: Record<string, React.ReactNode> = {
  message: <MessageSquareIcon size={13} />,
  accepted: <CheckIcon size={13} />,
  application: <BellIcon size={13} />,
  announcement: <BellIcon size={13} />,
};

const NOTIF_COLOURS: Record<string, string> = {
  message: 'bg-blue-100 text-blue-700',
  accepted: 'bg-green-100 text-green-700',
  application: 'bg-amber-100 text-amber-700',
  announcement: 'bg-violet-100 text-violet-700',
};

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      className={`text-sm font-medium transition-colors ${
        isActive(to) ? 'text-blue-900' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </Link>
  );

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    navigate('/');
  };

  const dashboardPath =
    user?.role === 'organizer' || user?.role === 'teacher' ? '/organizer' : '/dashboard';

  // Close notif panel on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center shrink-0">
            <img src="/favicon.png" alt="Involv" className="h-9 w-auto" />
          </Link>

          {/* Desktop nav */}
          <div className={`hidden md:flex items-center gap-6 ${!isAuthenticated ? 'absolute left-1/2 -translate-x-1/2' : ''}`}>
            {navLink('/browse', 'Browse')}
            {isAuthenticated && navLink(dashboardPath, 'Dashboard')}
            {isAuthenticated && (user?.role === 'organizer' || user?.role === 'teacher') && navLink('/create', 'Post Opportunity')}
            {isAuthenticated && user?.role === 'student' && navLink('/saved', 'Saved')}
            {isAuthenticated && user?.role === 'admin' && navLink('/admin', 'Admin')}
          </div>

          {/* Auth area */}
          <div className="hidden md:flex items-center gap-2">
            {!isAuthenticated ? (
              <>
                <Link to="/login" className="btn-ghost text-sm">Sign in</Link>
                <Link to="/login" className="btn-primary text-sm">Get started</Link>
              </>
            ) : user && (
              <div className="flex items-center gap-1">

                {/* Notification bell */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => { setNotifOpen(v => !v); setProfileOpen(false); }}
                    className="relative p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                    aria-label="Notifications"
                  >
                    <BellIcon size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <div className="absolute right-0 mt-1 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                        <p className="text-sm font-semibold text-slate-900">Notifications</p>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllRead}
                            className="text-xs text-blue-900 hover:underline"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <p className="text-sm text-slate-500 px-4 py-6 text-center">No notifications yet.</p>
                        ) : notifications.map(n => (
                          <button
                            key={n.id}
                            onClick={() => {
                              markRead(n.id);
                              setNotifOpen(false);
                              if (n.opportunityId && n.type === 'message') {
                                navigate(`/chat/${n.opportunityId}`);
                              }
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex gap-3 ${!n.read ? 'bg-blue-50/40' : ''}`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${NOTIF_COLOURS[n.type]}`}>
                              {NOTIF_ICONS[n.type]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${!n.read ? 'text-slate-900' : 'text-slate-600'}`}>{n.title}</p>
                              <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                            </div>
                            {!n.read && <div className="w-2 h-2 rounded-full bg-blue-900 shrink-0 mt-1.5" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Profile dropdown */}
                <div className="relative">
                  <button
                    onClick={() => { setProfileOpen(v => !v); setNotifOpen(false); }}
                    className="flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900 pl-2 pr-1 py-1.5 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center">
                      {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                    </div>
                    <span className="font-medium max-w-[120px] truncate">{user.name.split(' ')[0]}</span>
                    <ChevronDownIcon size={14} className="text-slate-400" />
                  </button>

                  {profileOpen && (
                    <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="text-xs font-semibold text-slate-900 truncate">{user.name}</p>
                        <p className="text-xs text-slate-500 truncate">{user.email}</p>
                      </div>
                      <Link to={dashboardPath} onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <LayoutDashboardIcon size={14} /> Dashboard
                      </Link>
                      {user.role === 'student' && (
                        <Link to="/saved" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <BookmarkIcon size={14} /> Saved
                        </Link>
                      )}
                      {(user.role === 'organizer' || user.role === 'teacher') && (
                        <Link to="/create" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                          <PlusIcon size={14} /> Post Opportunity
                        </Link>
                      )}
                      {user.role === 'admin' && (
                        <Link to="/admin" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                          <ShieldIcon size={14} /> Admin panel
                        </Link>
                      )}
                      <Link to="/profile" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        Profile & Preferences
                      </Link>
                      <div className="border-t border-slate-100 mt-1">
                        <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <button className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100" onClick={() => setMenuOpen(v => !v)} aria-label="Toggle menu">
            {menuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          <Link to="/browse" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-slate-700 font-medium">Browse Opportunities</Link>
          {isAuthenticated && <Link to={dashboardPath} onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-slate-700 font-medium">Dashboard</Link>}
          {isAuthenticated && user?.role === 'student' && <Link to="/saved" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-slate-700 font-medium">Saved</Link>}
          {isAuthenticated && (user?.role === 'organizer' || user?.role === 'teacher') && <Link to="/create" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-slate-700 font-medium">Post Opportunity</Link>}
          {isAuthenticated && <Link to="/profile" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-slate-700 font-medium">Profile</Link>}
          {isAuthenticated && user?.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-red-600 font-medium">Admin panel</Link>}
          <div className="pt-2 border-t border-slate-100 flex gap-2">
            {!isAuthenticated ? (
              <>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-secondary flex-1 justify-center">Sign in</Link>
                <Link to="/login" onClick={() => setMenuOpen(false)} className="btn-primary flex-1 justify-center">Get started</Link>
              </>
            ) : (
              <button onClick={handleLogout} className="text-sm text-red-600 py-2 font-medium">Sign out</button>
            )}
          </div>
        </div>
      )}

      {profileOpen && <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />}
    </nav>
  );
}
