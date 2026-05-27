import { t, type Lang } from '../lib/i18n';

export type Tab = 'today' | 'progress' | 'premium';

export function BottomNav({
  lang,
  tab,
  onTabChange,
}: {
  lang: Lang;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
}) {
  const i = t(lang);
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'today', label: i.nav.today, icon: '✅' },
    { id: 'progress', label: i.nav.progress, icon: '📈' },
    { id: 'premium', label: i.nav.premium, icon: '⭐' },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-surface/90 backdrop-blur border-t border-white/5 px-2 py-2">
      <div className="max-w-xl mx-auto grid grid-cols-3 gap-1">
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => onTabChange(it.id)}
            className={`flex flex-col items-center gap-1 py-2 rounded-card transition ${
              tab === it.id ? 'text-accent' : 'text-muted'
            }`}
          >
            <span className="text-lg">{it.icon}</span>
            <span className="text-xs">{it.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
