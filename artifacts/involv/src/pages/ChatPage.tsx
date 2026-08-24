import { useState, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon, SendIcon, UsersIcon, PaperclipIcon, SmileIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { mockOpportunities, mockIncomingApplications } from '../data/mockData';

type PresenceStatus = 'online' | 'away' | 'offline';

// Mock presence — in production this comes from Supabase Realtime presence
const MOCK_PRESENCE: Record<string, PresenceStatus> = {
  'organizer-1': 'online',
  'student-priya': 'online',
  'student-marcus': 'away',
  'student-chloe': 'offline',
  'student-daniel': 'offline',
};

function PresenceDot({ status }: { status: PresenceStatus }) {
  const colours = {
    online: 'bg-green-500',
    away: 'bg-orange-400',
    offline: 'bg-slate-300',
  };
  const labels = { online: 'Online', away: 'Away', offline: 'Offline' };
  return (
    <span
      className={`w-2.5 h-2.5 rounded-full border-2 border-white shrink-0 ${colours[status]}`}
      title={labels[status]}
    />
  );
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'student' | 'teacher' | 'organizer';
  content: string;
  createdAt: string;
}

const MOCK_MESSAGES: Message[] = [
  {
    id: 'm1',
    senderId: 'organizer-1',
    senderName: 'Mr. Okonkwo',
    senderRole: 'organizer',
    content: 'Welcome everyone to the Peer Tutoring Programme! Really glad to have you all on board.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'm2',
    senderId: 'organizer-1',
    senderName: 'Mr. Okonkwo',
    senderRole: 'organizer',
    content: 'Our first session will be this Thursday at 3:30pm in Room 214. Please bring any materials you think will help your tutees.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 23).toISOString(),
  },
  {
    id: 'm3',
    senderId: 'student-priya',
    senderName: 'Priya Sharma',
    senderRole: 'student',
    content: 'Thanks Mr. Okonkwo! Should we prepare anything specific for the first session?',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    id: 'm4',
    senderId: 'organizer-1',
    senderName: 'Mr. Okonkwo',
    senderRole: 'organizer',
    content: 'Good question Priya. Just bring a positive attitude for now! We\'ll assign tutees next week once we\'ve assessed their needs.',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 21).toISOString(),
  },
  {
    id: 'm5',
    senderId: 'student-marcus',
    senderName: 'Marcus Adeyemi',
    senderRole: 'student',
    content: 'Looking forward to it! Is there a sign-in sheet or do we just show up?',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
];

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

const ROLE_COLOURS: Record<string, string> = {
  organizer: 'bg-blue-900',
  teacher: 'bg-violet-700',
  student: 'bg-slate-500',
};

export default function ChatPage() {
  const { opportunityId } = useParams<{ opportunityId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [input, setInput] = useState('');
  const [showMembers, setShowMembers] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const opportunity = mockOpportunities.find(o => o.id === opportunityId);
  const acceptedMembers = mockIncomingApplications.filter(
    a => a.opportunityId === opportunityId && a.status === 'Accepted',
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !user) return;
    const newMsg: Message = {
      id: `m-${Date.now()}`,
      senderId: user.id,
      senderName: user.name,
      senderRole: user.role as 'student' | 'teacher' | 'organizer',
      content: input.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!opportunity) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Opportunity not found.</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to={`/applications/${opportunityId}`}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 shrink-0"
          >
            <ArrowLeftIcon size={16} />
          </Link>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{opportunity.title}</p>
            <p className="text-xs text-slate-500">{acceptedMembers.length + 1} members</p>
          </div>
        </div>
        <button
          onClick={() => setShowMembers(v => !v)}
          className={`p-2 rounded-lg transition-colors shrink-0 ${showMembers ? 'bg-blue-50 text-blue-900' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
          title="Toggle member list"
        >
          <UsersIcon size={16} />
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => {
              const isMe = msg.senderId === user?.id;
              const prevMsg = messages[i - 1];
              const showHeader = !prevMsg || prevMsg.senderId !== msg.senderId;
              const avatarColor = ROLE_COLOURS[msg.senderRole] ?? 'bg-slate-400';

              return (
                <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  {showHeader ? (
                    <div className={`w-7 h-7 rounded-full ${avatarColor} text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5`}>
                      {getInitials(msg.senderName)}
                    </div>
                  ) : (
                    <div className="w-7 shrink-0" />
                  )}

                  <div className={`max-w-[70%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {showHeader && (
                      <div className={`flex items-baseline gap-2 ${isMe ? 'flex-row-reverse' : ''}`}>
                        <span className="text-xs font-semibold text-slate-700">{isMe ? 'You' : msg.senderName}</span>
                        {msg.senderRole !== 'student' && (
                          <span className="text-xs text-blue-900 font-medium capitalize">{msg.senderRole}</span>
                        )}
                        <span className="text-xs text-slate-400">{formatTime(msg.createdAt)}</span>
                      </div>
                    )}
                    <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                      isMe
                        ? 'bg-blue-900 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-200 text-slate-900 rounded-tl-sm'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-200 bg-white px-4 py-3 shrink-0">
            <div className="flex items-end gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600 shrink-0 mb-0.5">
                <PaperclipIcon size={16} />
              </button>
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Write a message… (Enter to send)"
                  rows={1}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:border-blue-900 focus:ring-1 focus:ring-blue-900 max-h-32 leading-relaxed"
                  style={{ minHeight: '38px' }}
                />
              </div>
              <button className="p-2 text-slate-400 hover:text-slate-600 shrink-0 mb-0.5">
                <SmileIcon size={16} />
              </button>
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="p-2 bg-blue-900 text-white rounded-xl hover:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0 mb-0.5"
              >
                <SendIcon size={15} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-1 ml-10">Shift+Enter for new line</p>
          </div>
        </div>

        {/* Member list */}
        {showMembers && (
          <div className="w-60 border-l border-slate-200 bg-white flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <p className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Members</p>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {/* Organiser */}
              <div className="px-3 py-1">
                <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 px-1">Organiser</p>
                <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
                  <div className="relative shrink-0">
                    <div className="w-7 h-7 rounded-full bg-blue-900 text-white text-xs font-semibold flex items-center justify-center">
                      {getInitials(opportunity.organizerName)}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5">
                      <PresenceDot status={MOCK_PRESENCE['organizer-1'] ?? 'offline'} />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-900 truncate">{opportunity.organizerName}</p>
                    <p className="text-xs text-slate-400 capitalize">{opportunity.organizerRole}</p>
                  </div>
                  <PresenceDot status={MOCK_PRESENCE['organizer-1'] ?? 'offline'} />
                </div>
              </div>

              {/* Students */}
              {acceptedMembers.length > 0 && (
                <div className="px-3 py-1 mt-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 px-1">
                    Students ({acceptedMembers.length})
                  </p>
                  {acceptedMembers.map(member => {
                    const presenceKey = `student-${member.applicantName.split(' ')[0].toLowerCase()}`;
                    const status = MOCK_PRESENCE[presenceKey] ?? 'offline';
                    return (
                      <div key={member.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-slate-50">
                        <div className="relative shrink-0">
                          <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 text-xs font-semibold flex items-center justify-center">
                            {getInitials(member.applicantName)}
                          </div>
                          <span className="absolute -bottom-0.5 -right-0.5">
                            <PresenceDot status={status} />
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-900 truncate">{member.applicantName}</p>
                          <p className="text-xs text-slate-400 capitalize">{status === 'online' ? 'Online' : status === 'away' ? 'Away' : 'Offline'}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {acceptedMembers.length === 0 && (
                <p className="text-xs text-slate-400 px-4 py-3">
                  No accepted students yet.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
