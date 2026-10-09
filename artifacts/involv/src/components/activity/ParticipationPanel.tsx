import { useCallback, useEffect, useRef, useState } from 'react';
import { getParticipation, type ParticipationData } from '../../services/participationService';
import type { OppSession } from '../../types';
import AttendanceTab from './AttendanceTab';
import HoursTab from './HoursTab';

interface Props {
  opportunityId: string;
  userId: string;
  section: 'Attendance' | 'Hours';
  sessions: OppSession[];
  participants: { id: string; name: string }[];
  onAccessDenied: () => Promise<void>;
}
export default function ParticipationPanel(props: Props) {
  const { opportunityId, userId, section, onAccessDenied } = props;
  const [data, setData] = useState<ParticipationData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const attempt = ++revision.current;
    try {
      const next = await getParticipation(opportunityId);
      if (attempt === revision.current) { setData(next); setError(''); }
    } catch (e) {
      if (attempt === revision.current) {
        setError(e instanceof Error ? e.message : 'Could not load participation records.');
        if ((e as { code?: string })?.code === '42501') {
          setData(null);
          void onAccessDenied().catch(() => {});
        }
      }
      throw e;
    } finally {
      if (attempt === revision.current) setLoading(false);
    }
  }, [opportunityId, userId, onAccessDenied]);
  useEffect(() => {
    void refresh().catch(() => {});
    const update = () => { if (!document.hidden) void refresh().catch(() => {}); };
    const interval = window.setInterval(update, 30_000);
    window.addEventListener('focus', update);
    return () => {
      ++revision.current;
      clearInterval(interval);
      window.removeEventListener('focus', update);
    };
  }, [refresh]);
  return (
    <div className="space-y-4">
      {error && <div role="alert" className="card p-4 text-sm text-red-700">
        {error} <button className="underline ml-2" onClick={() => void refresh().catch(() => {})}>Refresh</button>
      </div>}
      {!data && loading && <p role="status" className="text-sm text-slate-500">Loading {section.toLowerCase()}…</p>}
      {data && section === 'Attendance' && <AttendanceTab
        opportunityId={opportunityId} userId={userId} canManage={data.canManage}
        sessions={props.sessions} participants={props.participants} items={data.attendance} onChanged={refresh}
      />}
      {data && section === 'Hours' && <HoursTab
        opportunityId={opportunityId} userId={userId} canManage={data.canManage}
        canSubmit={data.canSubmit} items={data.hours} onChanged={refresh}
      />}
    </div>
  );
}
