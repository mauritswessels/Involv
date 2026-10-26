import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PrivateReflectionsPanel from '../components/activity/PrivateReflectionsPanel';

export default function PrivateReflectionsPage() {
  const { user } = useAuth();
  useEffect(() => { document.title = 'My reflections | Involv'; }, []);
  if (!user) return null;
  return <main className="min-h-screen bg-slate-50 px-4 py-6">
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/portfolio" className="text-sm text-blue-900 underline">Back to my service portfolio</Link>
      <h1 className="text-xl font-bold text-slate-900">My reflections</h1>
      <p className="text-sm text-slate-500">Your own notes, including past activities. Leaving an activity does not reopen its private group or remove access to your personal reflections.</p>
      <PrivateReflectionsPanel key={`${user.id}:${user.role}`} />
    </div>
  </main>;
}
