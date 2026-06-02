import { useCallback, useEffect, useState } from 'react';
import { X, Wrench, BarChart3, Users as UsersIcon, MessageSquare, Search, Crown } from 'lucide-react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import type { AdminStats, AdminUser, AdminFeedback } from '../lib/types';
import { NumberTicker } from '../components/ui/NumberTicker';

type AdminTab = 'stats' | 'users' | 'feedback';

export function Admin({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<AdminTab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback[] | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try { setStats(await api.adminStats()); } catch (e) { setError(msg(e)); }
  }, []);
  const loadUsers = useCallback(async (q?: string) => {
    try { setUsers(await api.adminUsers(q)); } catch (e) { setError(msg(e)); }
  }, []);
  const loadFeedback = useCallback(async () => {
    try { setFeedback(await api.adminFeedback()); } catch (e) { setError(msg(e)); }
  }, []);

  useEffect(() => { void loadStats(); void loadUsers(); void loadFeedback(); }, [loadStats, loadUsers, loadFeedback]);

  async function togglePremium(u: AdminUser): Promise<void> {
    setBusyId(u.id);
    haptic('medium');
    try {
      const res = await api.adminSetPremium(u.id, !u.isPremium);
      setUsers((prev) => prev?.map((x) => (x.id === u.id ? { ...x, isPremium: res.isPremium, premiumUntil: res.premiumUntil } : x)) ?? null);
      notify('success');
      void loadStats();
    } catch (e) {
      notify('error');
      setError(msg(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto animate-fade-in">
      <div className="max-w-xl mx-auto px-4 pt-6 pb-24">
        <header className="flex items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center bg-accent/15 border border-accent/30">
              <Wrench size={16} className="text-accent" />
            </span>
            <div>
              <div className="eyebrow text-accent">Console</div>
              <div className="text-xl font-bold tracking-tight">Admin</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-pill bg-elevated border border-hairline mb-4">
          <TabButton active={tab === 'stats'} onClick={() => { haptic('light'); setTab('stats'); }}>
            <BarChart3 size={14} /> Stats
          </TabButton>
          <TabButton active={tab === 'users'} onClick={() => { haptic('light'); setTab('users'); }}>
            <UsersIcon size={14} /> Users
          </TabButton>
          <TabButton active={tab === 'feedback'} onClick={() => { haptic('light'); setTab('feedback'); }}>
            <MessageSquare size={14} /> Feedback
          </TabButton>
        </div>

        {error && (
          <div className="surface mb-3 border-danger/30 bg-danger/5 text-xs text-danger break-words">
            {error}
          </div>
        )}

        {tab === 'stats' && <StatsView stats={stats} />}
        {tab === 'users' && (
          <UsersView
            users={users}
            query={query}
            setQuery={setQuery}
            onSearch={() => loadUsers(query.trim() || undefined)}
            onToggle={togglePremium}
            busyId={busyId}
          />
        )}
        {tab === 'feedback' && <FeedbackView feedback={feedback} />}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
        active ? 'bg-accentGrad text-white shadow-glow' : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function StatsView({ stats }: { stats: AdminStats | null }): JSX.Element {
  if (!stats) return <SkeletonGrid />;
  return (
    <div className="space-y-5 stagger">
      <Section title="Users">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Total" value={stats.users.total} />
          <StatTile label="Premium" value={stats.users.premium} accent />
          <StatTile label="New 24h" value={stats.users.new24h} />
          <StatTile label="New 7d" value={stats.users.new7d} />
        </div>
      </Section>
      <Section title="Goals & plans">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Goals" value={stats.goals.total} sub={`active: ${stats.goals.active}`} />
          <StatTile label="AI plans" value={stats.plans.openai} sub={`stub: ${stats.plans.stub}`} />
          <StatTile label="AI health" value={`${stats.plans.aiHealthPct}%`} sub="openai / total" accent />
          <StatTile label="Completion" value={`${stats.tasks.completionPct}%`} sub={`${stats.tasks.completed}/${stats.tasks.total}`} />
        </div>
      </Section>
      <Section title="Revenue & feedback">
        <div className="grid grid-cols-2 gap-2.5">
          <StatTile label="Payments" value={stats.payments.events} sub={`succeeded: ${stats.payments.succeeded}`} />
          <StatTile label="Feedback" value={stats.feedback} />
        </div>
      </Section>
      <div className="text-[10px] text-muted/60 text-center">
        updated: {new Date(stats.generatedAt).toLocaleString('ru-RU')}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="eyebrow px-1">{title}</div>
      {children}
    </div>
  );
}

function StatTile({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className={`surface ${accent ? 'border-accent/30' : ''}`}>
      <div className="eyebrow">{label}</div>
      <div className={`hud-num text-2xl mt-1 ${accent ? 'text-accent' : ''}`}>
        {typeof value === 'number' ? <NumberTicker value={value} duration={500} /> : value}
      </div>
      {sub && <div className="text-[10px] text-muted mt-1 tabular">{sub}</div>}
    </div>
  );
}

function UsersView({
  users, query, setQuery, onSearch, onToggle, busyId,
}: {
  users: AdminUser[] | null;
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  onToggle: (u: AdminUser) => void;
  busyId: string | null;
}): JSX.Element {
  return (
    <div className="space-y-3">
      <form onSubmit={(e) => { e.preventDefault(); onSearch(); }} className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="name / username"
            className="w-full bg-elevated rounded-pill pl-9 pr-3 py-2.5 text-sm outline-none border border-hairline focus:border-accent transition"
          />
        </div>
        <button type="submit" className="px-5 rounded-pill bg-accentGrad text-white text-sm font-semibold shadow-glow transition active:scale-95">
          Найти
        </button>
      </form>

      {!users && <SkeletonRows />}
      {users && users.length === 0 && (
        <EmptyState title="Никого не найдено" subtitle="Попробуй другой запрос" />
      )}
      <div className="space-y-2 stagger">
        {users?.map((u) => (
          <div key={u.id} className="card p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">
                {u.firstName || u.username || 'без имени'}
                {u.username && <span className="text-muted text-xs"> @{u.username}</span>}
              </div>
              <div className="text-[10px] text-muted mt-0.5 tabular flex items-center gap-2">
                <span>tg:{u.telegramId}</span>
                <span>·</span>
                <span>🔥{u.streakCurrent}</span>
                <span>⭐{u.xpTotal}</span>
                <span>Lv{u.level}</span>
              </div>
            </div>
            <button
              onClick={() => onToggle(u)}
              disabled={busyId === u.id}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-pill border transition disabled:opacity-50 flex items-center gap-1 ${
                u.isPremium ? 'border-accent bg-accent/10 text-accent' : 'border-hairlineStrong text-muted hover:text-text'
              }`}
            >
              {busyId === u.id ? '…' : (
                <>
                  <Crown size={11} />
                  {u.isPremium ? 'Pro' : '+ Pro'}
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function FeedbackView({ feedback }: { feedback: AdminFeedback[] | null }): JSX.Element {
  if (!feedback) return <SkeletonRows />;
  if (feedback.length === 0) return <EmptyState title="Тишина" subtitle="Пока нет обратной связи." />;
  return (
    <div className="space-y-2.5 stagger">
      {feedback.map((f) => (
        <div key={f.id} className="card p-4">
          <div className="text-sm leading-snug">{f.message}</div>
          <div className="text-[10px] text-muted mt-2 tabular flex items-center justify-between">
            <span>{f.user}</span>
            <span>{new Date(f.createdAt).toLocaleString('ru-RU')}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="card aurora p-8 text-center space-y-2">
      <div className="text-2xl">⌗</div>
      <div className="font-semibold">{title}</div>
      {subtitle && <div className="text-xs text-muted">{subtitle}</div>}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-5">
      {[0, 1, 2].map((s) => (
        <div key={s} className="space-y-2">
          <div className="h-2 w-20 bg-white/10 rounded animate-pulse" />
          <div className="grid grid-cols-2 gap-2.5">
            {[0, 1, 2, 3].map((k) => <div key={k} className="surface h-20 animate-pulse" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="space-y-2.5">
      {[0, 1, 2, 3].map((k) => <div key={k} className="card h-14 animate-pulse" />)}
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Ошибка';
}
