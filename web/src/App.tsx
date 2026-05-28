import { useCallback, useEffect, useState } from 'react';

import { api, setToken } from './lib/api';
import { detectLanguage, getInitData, ready } from './lib/telegram';
import { t, type Lang } from './lib/i18n';
import type { Goal, User } from './lib/types';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Progress } from './screens/Progress';
import { Subscription } from './screens/Subscription';
import { BottomNav, type Tab } from './components/BottomNav';

type Status = 'idle' | 'authenticating' | 'ready' | 'auth_failed';

export function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>(detectLanguage());
  const [user, setUser] = useState<User | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);

  const i = t(lang);

  const refreshUser = useCallback(async () => {
    const me = await api.me();
    setUser(me);
    setLang(me.languageCode);
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
        <div className="text-muted">{i.loading}</div>
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
        <div className="surface max-w-sm text-center space-y-3">
          <div className="text-2xl">🔒</div>
          <div className="text-muted">{i.errors.auth}</div>
          {error && <div className="text-xs text-muted/70 break-words">{error}</div>}
          <pre className="text-[10px] text-left bg-black/20 rounded p-2 overflow-auto">{JSON.stringify(diag, null, 2)}</pre>
        </div>
      </Center>
    );
  }

  if (!user) return null;

  if (!activeGoal) {
    return (
      <div className="min-h-screen px-4 pt-6 pb-24 max-w-xl mx-auto">
        <Header user={user} lang={lang} />
        <Onboarding
          lang={lang}
          onCreated={async () => {
            await refreshUser();
            await refreshGoals();
          }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pt-6 pb-24 max-w-xl mx-auto">
      <Header user={user} lang={lang} />

      {tab === 'today' && (
        <Today
          lang={lang}
          user={user}
          goal={activeGoal}
          onUserChange={(u) => setUser(u)}
          onPremiumClick={() => setSubscriptionOpen(true)}
        />
      )}

      {tab === 'progress' && <Progress lang={lang} user={user} />}

      <BottomNav lang={lang} tab={tab} onTabChange={(next) => {
        if (next === 'premium') setSubscriptionOpen(true);
        else setTab(next);
      }} />

      {subscriptionOpen && (
        <Subscription
          lang={lang}
          onClose={() => setSubscriptionOpen(false)}
          onActivated={async () => {
            setSubscriptionOpen(false);
            await refreshUser();
          }}
        />
      )}
    </div>
  );
}

function Header({ user, lang }: { user: User; lang: Lang }) {
  const i = t(lang);
  return (
    <header className="flex items-center justify-between mb-5">
      <div>
        <div className="text-lg font-semibold">{i.appTitle}</div>
        <div className="text-xs text-muted">{user.firstName ?? user.username ?? ''}</div>
      </div>
      <div className="text-right text-xs text-muted">
        🔥 {user.streak.current} · ⭐ {user.xpTotal} · Lv {user.level}
      </div>
    </header>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center p-6">{children}</div>;
}
