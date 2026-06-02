import { useCallback, useEffect, useState } from 'react';
import { Flame, Zap, Settings, X, Wrench } from 'lucide-react';

import { api, setToken } from './lib/api';
import { detectLanguage, getInitData, ready } from './lib/telegram';
import { t, type Lang } from './lib/i18n';
import type { Goal, User } from './lib/types';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Progress } from './screens/Progress';
import { Subscription } from './screens/Subscription';
import { Admin } from './screens/Admin';
import { BottomNav, type Tab } from './components/BottomNav';
import { ConfirmDeleteGoalModal } from './components/ConfirmDeleteGoalModal';
import { NumberTicker } from './components/ui/NumberTicker';
import { AvatarFrame } from './components/ui/AvatarFrame';
import { SettingsSheet } from './components/SettingsSheet';

type Status = 'idle' | 'authenticating' | 'ready' | 'auth_failed';

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fallbackLang] = useState<Lang>(detectLanguage());
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [todayRefreshKey, setTodayRefreshKey] = useState(0);
  const [tab, setTab] = useState<Tab>('today');
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [goalCreatorOpen, setGoalCreatorOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<{ id: string; title: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Derive `lang` from the user so any `setUser(...)` (settings sheet, etc.)
  // instantly re-themes the UI. Fall back to the browser-detected language
  // until the first /me load completes.
  const lang: Lang = user?.languageCode ?? fallbackLang;
  const i = t(lang);

  const refreshUser = useCallback(async () => {
    const me = await api.me();
    setUser(me);
  }, []);

  const refreshGoals = useCallback(async () => {
    const list = await api.goals();
    setGoals(list);
  }, []);

  useEffect(() => {
    ready();
    let cancelled = false;

    async function boot() {
      setStatus('authenticating');
      try {
        const initData = getInitData();
        if (!initData) throw new Error('Open this app from Telegram');
        const { token } = await api.loginWithInitData(initData);
        setToken(token);
        await refreshUser();
        await refreshGoals();
        if (!cancelled) setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus('auth_failed');
        setError(err instanceof Error ? err.message : 'auth failed');
      }
    }

    void boot();
    return () => { cancelled = true; };
  }, [refreshUser, refreshGoals]);

  const activeGoal = goals?.find((g) => g.status === 'active') ?? null;

  if (status === 'authenticating' || status === 'idle') {
    return (
      <Center>
        <div className="flex flex-col items-center gap-3">
          <span className="relative w-10 h-10 rounded-full">
            <span className="absolute inset-0 rounded-full border-2 border-accent/30" />
            <span className="absolute inset-0 rounded-full border-2 border-t-accent border-r-transparent border-b-transparent border-l-transparent animate-spin" />
          </span>
          <div className="eyebrow text-muted">{i.loading}</div>
        </div>
      </Center>
    );
  }

  if (status === 'auth_failed') {
    // Client-side diagnostic — visible in the failure card so we can see
    // exactly what the Telegram SDK exposed without needing devtools.
    const tg = window.Telegram?.WebApp;
    const initData = tg?.initData ?? '';
    const diag = {
      hasTelegram: typeof window.Telegram !== 'undefined',
      hasWebApp: !!tg,
      initDataLen: initData.length,
      hasUser: !!tg?.initDataUnsafe?.user,
      apiBase: import.meta.env.VITE_API_BASE_URL ?? '(unset)',
    };
    return (
      <Center>
        <div className="card aurora max-w-sm w-full text-center space-y-4 p-6 animate-rise">
          <div className="mx-auto w-12 h-12 rounded-pill grid place-items-center bg-danger/15 border border-danger/30">
            <X size={20} className="text-danger" />
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold tracking-tight">{i.errors.auth}</div>
            {error && <div className="text-xs text-muted break-words">{error}</div>}
          </div>
          <details className="text-left">
            <summary className="text-[11px] text-muted cursor-pointer hover:text-text transition">diagnostics</summary>
            <pre className="text-[10px] text-left bg-bg/60 border border-hairline rounded-card p-3 mt-2 overflow-auto">
{JSON.stringify(diag, null, 2)}
            </pre>
          </details>
        </div>
      </Center>
    );
  }

  if (!user) return null;

  if (!activeGoal) {
    return (
      <div className="min-h-screen px-4 app-safe-top app-safe-bottom max-w-xl mx-auto">
        <Header
          user={user}
          lang={lang}
          onAdminClick={() => setAdminOpen(true)}
          onSettingsClick={() => setSettingsOpen(true)}
        />
        <Onboarding
          lang={lang}
          onCreated={async () => {
            await refreshUser();
            await refreshGoals();
          }}
        />
        {adminOpen && <Admin onClose={() => setAdminOpen(false)} />}
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-24 max-w-xl mx-auto">
      <Header
        user={user}
        lang={lang}
        onAdminClick={() => setAdminOpen(true)}
        onSettingsClick={() => setSettingsOpen(true)}
      />

      {tab === 'today' && (
        <Today
          lang={lang}
          user={user}
          activeGoalsCount={(goals ?? []).filter((g) => g.status === 'active').length}
          refreshKey={todayRefreshKey}
          onUserChange={(u) => setUser(u)}
          onPremiumClick={() => setSubscriptionOpen(true)}
          onAddGoal={() => setGoalCreatorOpen(true)}
          onDeleteGoal={(id, title) => setDeletingGoal({ id, title })}
        />
      )}

      {tab === 'progress' && (
        <Progress
          lang={lang}
          user={user}
          onUserChange={(u) => setUser(u)}
          onPremiumClick={() => setSubscriptionOpen(true)}
        />
      )}

      <BottomNav lang={lang} tab={tab} onTabChange={(next) => {
        if (next === 'premium') setSubscriptionOpen(true);
        else setTab(next);
      }} />

      {subscriptionOpen && (
        <Subscription
          lang={lang}
          user={user}
          onClose={() => setSubscriptionOpen(false)}
          onActivated={async () => {
            setSubscriptionOpen(false);
            await refreshUser();
          }}
        />
      )}

      {goalCreatorOpen && (
        <GoalCreatorModal
          lang={lang}
          onClose={() => setGoalCreatorOpen(false)}
          onCreated={async () => {
            setGoalCreatorOpen(false);
            await refreshUser();
            await refreshGoals();
            // Tell Today to re-fetch its tasks so the new goal's daily tasks
            // appear immediately. The increment is what changes the useEffect
            // dep, so even rapid back-to-back creates trigger reloads.
            setTodayRefreshKey((k) => k + 1);
          }}
        />
      )}

      {adminOpen && <Admin onClose={() => setAdminOpen(false)} />}

      {settingsOpen && (
        <SettingsSheet
          lang={lang}
          user={user}
          onUserChange={(u) => setUser(u)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {deletingGoal && (
        <ConfirmDeleteGoalModal
          lang={lang}
          goalId={deletingGoal.id}
          goalTitle={deletingGoal.title}
          onClose={() => setDeletingGoal(null)}
          onDeleted={async (xpLost, goalTitle) => {
            setDeletingGoal(null);
            await refreshUser();
            await refreshGoals();
            const tpl = i.deleteGoal.toastDeleted;
            setToast(tpl.replace('{title}', goalTitle).replace('{xp}', String(xpLost)));
            setTimeout(() => setToast(null), 4000);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
          <div className="bg-bg/95 border border-white/10 rounded-card px-4 py-3 text-sm shadow-lg max-w-md w-full text-center">
            {toast}
          </div>
        </div>
      )}
    </div>
  );
}

function GoalCreatorModal({
  lang,
  onClose,
  onCreated,
}: {
  lang: Lang;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-md overflow-y-auto animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg w-full max-w-xl rounded-t-3xl sm:rounded-card p-6 m-0 sm:my-6 max-h-[90vh] overflow-y-auto border border-hairline shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>
        <Onboarding lang={lang} onCreated={onCreated} />
      </div>
    </div>
  );
}

function Header({
  user,
  lang,
  onAdminClick,
  onSettingsClick,
}: {
  user: User;
  lang: Lang;
  onAdminClick?: () => void;
  onSettingsClick?: () => void;
}) {
  const i = t(lang);
  const letter = (user.firstName?.[0] ?? user.username?.[0] ?? '·').toUpperCase();
  const title = user.cosmetics?.title;
  return (
    <header className="flex items-center justify-between mb-6 gap-3">
      <div className="min-w-0 flex items-center gap-3">
        <AvatarFrame tier={user.cosmetics?.frame ?? 'none'} letter={letter} />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-semibold tracking-tight truncate">
              {user.firstName ?? user.username ?? i.appTitle}
            </span>
            {user.isPremium && (
              <span
                className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-pill bg-accentGrad text-white"
                title={i.subscription.activeTitle}
              >
                Pro
              </span>
            )}
          </div>
          {title ? (
            <div className="mt-0.5 text-[11px] font-semibold text-accent truncate leading-tight">
              {title}
            </div>
          ) : (
            <div className="eyebrow mt-0.5 truncate">Lv {user.level} · {i.appTitle}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <HudChip icon={<Flame size={13} className="text-warning" />} value={user.streak.current} />
        <HudChip icon={<Zap size={13} className="text-accent" />} value={user.xpTotal} />
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            aria-label="Settings"
            className="w-9 h-9 rounded-pill border border-hairline bg-surface/60 grid place-items-center text-muted hover:text-text transition"
          >
            <Settings size={15} />
          </button>
        )}
        {user.isAdmin && onAdminClick && (
          <button
            onClick={onAdminClick}
            aria-label="Admin"
            className="w-9 h-9 rounded-pill border border-hairline bg-surface/60 grid place-items-center text-accent hover:text-accentGlow transition"
            title="Admin"
          >
            <Wrench size={15} />
          </button>
        )}
      </div>
    </header>
  );
}

function HudChip({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-pill border border-hairline bg-surface/60">
      {icon}
      <span className="text-xs font-semibold tabular">
        <NumberTicker value={value} duration={500} />
      </span>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6">{children}</div>;
}
