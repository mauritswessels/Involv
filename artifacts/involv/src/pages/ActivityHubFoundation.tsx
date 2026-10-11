import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeftIcon, CalendarIcon, MegaphoneIcon, UsersIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getActivityHub, type ActivityHubData } from '../services/activityService';
import AnnouncementsTab from '../components/activity/AnnouncementsTab';
import SessionsTab from '../components/activity/SessionsTab';
import ParticipationPanel from '../components/activity/ParticipationPanel';
import PrivateReflectionsPanel from '../components/activity/PrivateReflectionsPanel';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEFERRED = ['Gallery', 'Certificate'];

export default function ActivityHubFoundation() {
  const { opportunityId = '' } = useParams<{ opportunityId: string }>();
  const { user } = useAuth();
  const key = `${opportunityId}:${user?.id}:${user?.role}`;
  const currentKey = useRef(key);
  currentKey.current = key;
  const revision = useRef(0);
  const [snapshot, setSnapshot] = useState<{ key: string; hub: ActivityHubData } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Announcements');
  const hub = snapshot?.key === key ? snapshot.hub : null;

  const refresh = useCallback(async () => {
    const attempt = ++revision.current;
    try {
      if (!UUID.test(opportunityId)) throw new Error('This is not a valid opportunity link. Open the Activity Hub from your dashboard.');
      const data = await getActivityHub(opportunityId);
      if (currentKey.current === key && attempt === revision.current) {
        setSnapshot({ key, hub: data });
        setError('');
      }
    } catch (e) {
      if (currentKey.current === key && attempt === revision.current) {
        setError(e instanceof Error ? e.message : 'Could not load the Activity Hub. Please try again.');
        // Network errors retain the current snapshot and unsaved form drafts.
        // An access denial removes all participant data immediately.
        if ((e as { code?: string })?.code === '42501') setSnapshot(null);
      }
      throw e;
    } finally {
      if (currentKey.current === key && attempt === revision.current) setLoading(false);
    }
  }, [key, opportunityId]);

  useEffect(() => {
    setLoading(true);
    setError('');
    setTab('Announcements');
    void refresh().catch(() => {});
    const update = () => { if (!document.hidden) void refresh().catch(() => {}); };
    const interval = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => {
      ++revision.current;
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);

  if (!hub) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-5">
      <div className="card p-6 max-w-lg text-center space-y-4">
        <h1 className="text-lg font-semibold text-slate-900">Activity Hub</h1>
        {loading && !error
          ? <p role="status" className="text-sm text-slate-500">Loading your activity…</p>
          : <p role="alert" className="text-sm text-red-700">{error || 'This activity is unavailable.'}</p>}
        <div className="flex justify-center flex-wrap gap-3">
          {!loading && <button className="btn-secondary" onClick={() => { setLoading(true); void refresh().catch(() => {}); }}>Retry</button>}
          <Link to="/dashboard" className="btn-secondary">Back to dashboard</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200 sticky top-14 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 py-4 border-b border-slate-100">
            <Link to={hub.canManage ? `/applications/${opportunityId}` : '/dashboard'}
              aria-label="Back to dashboard"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0">
              <ArrowLeftIcon size={16} />
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold text-slate-900 truncate">{hub.opportunity.title}</h1>
              <p className="text-xs text-slate-500">Activity hub · {hub.canManage ? 'Manager access' : 'Participant access'}</p>
            </div>
            <Link to={`/chat/${opportunityId}`} className="btn-secondary text-xs shrink-0">Group chat</Link>
          </div>
          <div className="flex overflow-x-auto scrollbar-hide -mb-px" role="tablist" aria-label="Activity hub sections">
            {['Announcements', 'Sessions', 'Attendance', 'Hours', 'Reflections', ...DEFERRED].map(label => (
              <button key={label} role="tab" aria-selected={tab === label} aria-controls="activity-panel"
                onClick={() => setTab(label)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === label ? 'border-blue-900 text-blue-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {label === 'Announcements' && <MegaphoneIcon size={14} />}
                {label === 'Sessions' && <CalendarIcon size={14} />}
                {label}{DEFERRED.includes(label) && <span className="text-[10px] text-slate-400">Later</span>}
              </button>
            ))}
          </div>
        </div>
      </div>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {error && <div role="alert" className="card p-4 border-red-200 text-red-700 text-sm">
          {error} <button className="underline ml-2" onClick={() => void refresh().catch(() => {})}>Refresh</button>
        </div>}
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">
            <UsersIcon size={15} className="inline mr-2" />{hub.participants.length} accepted {hub.participants.length === 1 ? 'participant' : 'participants'}
          </summary>
          {hub.participants.length === 0
            ? <p className="text-sm text-slate-500 mt-3">No participants accepted yet.</p>
            : <ul className="mt-3 text-sm text-slate-600 space-y-1">{hub.participants.map(p => <li key={p.id}>{p.name}</li>)}</ul>}
        </details>
        <section id="activity-panel" role="tabpanel" aria-label={tab}>
          {tab === 'Announcements' && <AnnouncementsTab key={key} opportunityId={opportunityId} canManage={hub.canManage} items={hub.announcements} onChanged={refresh} />}
          {tab === 'Sessions' && <SessionsTab key={key} opportunityId={opportunityId} canManage={hub.canManage} items={hub.sessions} onChanged={refresh} />}
          {tab === 'Reflections' && user && <PrivateReflectionsPanel key={key} opportunityId={opportunityId} />}
          {(tab === 'Attendance' || tab === 'Hours') && user && <ParticipationPanel
            key={`${key}:${tab}`} opportunityId={opportunityId} userId={user.id} section={tab}
            sessions={hub.sessions} participants={hub.participants} onAccessDenied={refresh}
          />}
          {DEFERRED.includes(tab) && <div className="card p-8 text-center space-y-2">
            <h2 className="font-semibold text-slate-900">{tab} is not connected yet</h2>
            <p className="text-sm text-slate-500">This will be added in a later backend chunk. No sample records or temporary changes are shown as real activity data.</p>
          </div>}
        </section>
      </main>
    </div>
  );
}
