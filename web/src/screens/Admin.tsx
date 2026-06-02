import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Wrench, BarChart3, Users as UsersIcon, MessageSquare, Search, Crown, Infinity as InfinityIcon, Activity, UserPlus, Target, CreditCard } from 'lucide-react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import type { AdminStats, AdminUser, AdminFeedback, AdminEvent } from '../lib/types';
import { NumberTicker } from '../components/ui/NumberTicker';

type AdminTab = 'stats' | 'users' | 'events' | 'feedback';

export function Admin({ onClose }: { onClose: () => void }): JSX.Element {
  const [tab, setTab] = useState<AdminTab>('stats');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback[] | null>(null);
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
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
  const loadEvents = useCallback(async () => {
    try { setEvents(await api.adminEvents()); } catch (e) { setError(msg(e)); }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadUsers();
    void loadFeedback();
    void loadEvents();
  }, [loadStats, loadUsers, loadFeedback, loadEvents]);

  async function grantPremium(
    u: AdminUser,
    opts: { isPremium: boolean; days?: number; forever?: boolean },
  ): Promise<void> {
    setBusyId(u.id);
    haptic('medium');
    try {
      const res = await api.adminSetPremium(u.id, opts);
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
      <div className="max-w-xl mx-auto px-4 app-safe-top app-safe-bottom">
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

        <div className="grid grid-cols-4 gap-1.5 p-1 rounded-pill bg-elevated border border-hairline mb-4">
          <TabButton active={tab === 'stats'} onClick={() => { haptic('light'); setTab('stats'); }}>
            <BarChart3 size={13} /> Stats
          </TabButton>
          <TabButton active={tab === 'users'} onClick={() => { haptic('light'); setTab('users'); }}>
            <UsersIcon size={13} /> Users
          </TabButton>
          <TabButton active={tab === 'events'} onClick={() => { haptic('light'); setTab('events'); }}>
            <Activity size={13} /> Events
          </TabButton>
          <TabButton active={tab === 'feedback'} onClick={() => { haptic('light'); setTab('feedback'); }}>
            <MessageSquare size={13} /> Feedback
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
            onGrant={grantPremium}
            busyId={busyId}
          />
        )}
        {tab === 'events' && <EventsView events={events} />}
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
  users, query, setQuery, onSearch, onGrant, busyId,
}: {
  users: AdminUser[] | null;
  query: string;
  setQuery: (q: string) => void;
  onSearch: () => void;
  onGrant: (u: AdminUser, opts: { isPremium: boolean; days?: number; forever?: boolean }) => Promise<void>;
  busyId: string | null;
}): JSX.Element {
  const [menuFor, setMenuFor] = useState<string | null>(null);

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
          <UserRow
            key={u.id}
            user={u}
            busy={busyId === u.id}
            menuOpen={menuFor === u.id}
            onOpenMenu={() => setMenuFor(menuFor === u.id ? null : u.id)}
            onCloseMenu={() => setMenuFor(null)}
            onGrant={async (opts) => {
              await onGrant(u, opts);
              setMenuFor(null);
            }}
          />
        ))}
      </div>
    </div>
  );
}

function UserRow({
  user, busy, menuOpen, onOpenMenu, onCloseMenu, onGrant,
}: {
  user: AdminUser;
  busy: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  onCloseMenu: () => void;
  onGrant: (opts: { isPremium: boolean; days?: number; forever?: boolean }) => void | Promise<void>;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  // Click outside the menu closes it.
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onCloseMenu();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, onCloseMenu]);

  const isAdminSentinel = user.premiumUntil
    ? new Date(user.premiumUntil).getUTCFullYear() === 2099
    : false;
  const premiumLabel = isAdminSentinel
    ? '∞'
    : user.isPremium && user.premiumUntil
    ? new Date(user.premiumUntil).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
    : '';

  return (
    <div ref={ref} className="relative card p-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">
            {user.firstName || user.username || 'без имени'}
            {user.username && <span className="text-muted text-xs"> @{user.username}</span>}
          </div>
          <div className="text-[10px] text-muted mt-0.5 tabular flex items-center gap-2 flex-wrap">
            <span>tg:{user.telegramId}</span>
            <span>·</span>
            <span>🔥{user.streakCurrent}</span>
            <span>⭐{user.xpTotal}</span>
            <span>Lv{user.level}</span>
            {premiumLabel && <span className="text-accent">· {premiumLabel}</span>}
          </div>
        </div>
        <button
          onClick={onOpenMenu}
          disabled={busy}
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-pill border transition disabled:opacity-50 flex items-center gap-1 ${
            user.isPremium ? 'border-accent bg-accent/10 text-accent' : 'border-hairlineStrong text-muted hover:text-text'
          }`}
        >
          {busy ? '…' : (
            <>
              {isAdminSentinel ? <InfinityIcon size={11} /> : <Crown size={11} />}
              {user.isPremium ? 'Pro' : '+ Pro'}
            </>
          )}
        </button>
      </div>
      {menuOpen && (
        <div className="mt-3 pt-3 border-t border-hairline space-y-1.5 animate-fade-in">
          <div className="eyebrow mb-1">Grant Premium</div>
          <div className="grid grid-cols-3 gap-1.5">
            <MenuChip onClick={() => onGrant({ isPremium: true, days: 7 })}>+7 дней</MenuChip>
            <MenuChip onClick={() => onGrant({ isPremium: true, days: 30 })}>+30 дней</MenuChip>
            <MenuChip onClick={() => onGrant({ isPremium: true, days: 90 })}>+90 дней</MenuChip>
            <MenuChip onClick={() => onGrant({ isPremium: true, days: 365 })}>+1 год</MenuChip>
            <MenuChip onClick={() => onGrant({ isPremium: true, forever: true })} accent>
              <InfinityIcon size={11} className="inline mr-1" />бессрочно
            </MenuChip>
            {user.isPremium && (
              <MenuChip onClick={() => onGrant({ isPremium: false })} danger>
                снять
              </MenuChip>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MenuChip({
  onClick, children, accent, danger,
}: {
  onClick: () => void;
  children: React.ReactNode;
  accent?: boolean;
  danger?: boolean;
}) {
  const cls = accent
    ? 'border-accent bg-accent/10 text-accent'
    : danger
    ? 'border-danger/40 bg-danger/5 text-danger'
    : 'border-hairlineStrong text-text bg-white/[0.02] hover:bg-white/[0.06]';
  return (
    <button
      onClick={onClick}
      className={`rounded-pill border px-2 py-1.5 text-[11px] font-semibold transition active:scale-95 ${cls}`}
    >
      {children}
    </button>
  );
}

function EventsView({ events }: { events: AdminEvent[] | null }): JSX.Element {
  if (!events) return <SkeletonRows />;
  if (events.length === 0) return <EmptyState title="Тихо" subtitle="Активности пока нет." />;

  const iconFor = (kind: AdminEvent['kind']) => {
    switch (kind) {
      case 'signup': return <UserPlus size={14} className="text-accent" />;
      case 'goal': return <Target size={14} className="text-warning" />;
      case 'payment': return <CreditCard size={14} className="text-positive" />;
      case 'feedback': return <MessageSquare size={14} className="text-muted" />;
    }
  };

  return (
    <div className="space-y-1.5 stagger">
      {events.map((e) => (
        <div key={e.id} className="card p-3 flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-pill grid place-items-center border border-hairline bg-bg/40">
            {iconFor(e.kind)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              <span className="text-text">{e.who}</span>
              <span className="text-muted"> · </span>
              <span className="text-muted">{e.label}</span>
              {e.meta && <span className="text-[10px] text-accent ml-2 tabular">{e.meta}</span>}
            </div>
            <div className="text-[10px] text-muted/70 mt-0.5 tabular">
              {new Date(e.at).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      ))}
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
