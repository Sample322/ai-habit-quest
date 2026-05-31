import { useCallback, useEffect, useState } from 'react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import type { AdminStats, AdminUser, AdminFeedback } from '../lib/types';

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
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pt-5 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">🛠 Админка</h2>
          <button onClick={onClose} className="text-muted text-2xl leading-none px-2">×</button>
        </div>

        <div className="flex gap-2 mb-4">
          {([['stats', 'Статистика'], ['users', 'Пользователи'], ['feedback', 'Фидбек']] as [AdminTab, string][]).map(([id, label]) => (
            <button
              key={id}
              onClick={() => { haptic('light'); setTab(id); }}
              className={`flex-1 py-2 rounded-card text-sm transition border ${tab === id ? 'border-accent text-accent' : 'border-white/10 text-muted'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <div className="text-xs text-danger mb-3 break-words">{error}</div>}

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

function StatsView({ stats }: { stats: AdminStats | null }): JSX.Element {
  if (!stats) return <div className="text-muted text-sm">Загрузка…</div>;
  const card = (label: string, value: string | number, hint?: string) => (
    <div className="surface">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted mt-1">{label}</div>
      {hint && <div className="text-[11px] text-muted/70 mt-1">{hint}</div>}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="text-xs text-muted">Пользователи</div>
      <div className="grid grid-cols-2 gap-3">
        {card('Всего', stats.users.total)}
        {card('Premium', stats.users.premium)}
        {card('Новые 24ч', stats.users.new24h)}
        {card('Новые 7д', stats.users.new7d)}
      </div>
      <div className="text-xs text-muted">Цели и планы</div>
      <div className="grid grid-cols-2 gap-3">
        {card('Целей', stats.goals.total, `активных: ${stats.goals.active}`)}
        {card('AI-планы', stats.plans.openai, `заглушек: ${stats.plans.stub}`)}
        {card('AI-здоровье', `${stats.plans.aiHealthPct}%`, 'openai / всего')}
        {card('Выполнение', `${stats.tasks.completionPct}%`, `${stats.tasks.completed}/${stats.tasks.total}`)}
      </div>
      <div className="text-xs text-muted">Деньги и обратная связь</div>
      <div className="grid grid-cols-2 gap-3">
        {card('Платежи', stats.payments.events, `успешных: ${stats.payments.succeeded}`)}
        {card('Фидбек', stats.feedback)}
      </div>
      <div className="text-[10px] text-muted/60">обновлено: {new Date(stats.generatedAt).toLocaleString('ru-RU')}</div>
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
      <form
        onSubmit={(e) => { e.preventDefault(); onSearch(); }}
        className="flex gap-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени / username"
          className="flex-1 bg-surface rounded-card px-3 py-2 text-sm outline-none border border-white/10 focus:border-accent"
        />
        <button type="submit" className="px-4 rounded-card bg-accent text-accentText text-sm font-medium">Найти</button>
      </form>

      {!users && <div className="text-muted text-sm">Загрузка…</div>}
      {users && users.length === 0 && <div className="text-muted text-sm">Никого не найдено.</div>}
      {users?.map((u) => (
        <div key={u.id} className="surface flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">
              {u.firstName || u.username || 'без имени'}
              {u.username && <span className="text-muted text-xs"> @{u.username}</span>}
            </div>
            <div className="text-[11px] text-muted">
              tg:{u.telegramId} · 🔥{u.streakCurrent} · ⭐{u.xpTotal} · Lv{u.level}
            </div>
          </div>
          <button
            onClick={() => onToggle(u)}
            disabled={busyId === u.id}
            className={`shrink-0 text-xs font-medium px-3 py-1.5 rounded-card border transition disabled:opacity-50 ${
              u.isPremium ? 'border-accent text-accent' : 'border-white/15 text-muted'
            }`}
          >
            {busyId === u.id ? '…' : u.isPremium ? '★ Premium' : '+ Premium'}
          </button>
        </div>
      ))}
    </div>
  );
}

function FeedbackView({ feedback }: { feedback: AdminFeedback[] | null }): JSX.Element {
  if (!feedback) return <div className="text-muted text-sm">Загрузка…</div>;
  if (feedback.length === 0) return <div className="text-muted text-sm">Пока нет обратной связи.</div>;
  return (
    <div className="space-y-3">
      {feedback.map((f) => (
        <div key={f.id} className="surface">
          <div className="text-sm">{f.message}</div>
          <div className="text-[11px] text-muted mt-2">{f.user} · {new Date(f.createdAt).toLocaleString('ru-RU')}</div>
        </div>
      ))}
    </div>
  );
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : 'Ошибка';
}
