import { Check, BarChart3, Crown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { t, type Lang } from '../lib/i18n';

export type Tab = 'today' | 'progress' | 'premium';

interface NavItem {
  id: Tab;
  label: string;
  Icon: LucideIcon;
}

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
  const items: NavItem[] = [
    { id: 'today', label: i.nav.today, Icon: Check },
    { id: 'progress', label: i.nav.progress, Icon: BarChart3 },
    { id: 'premium', label: i.nav.premium, Icon: Crown },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-2 pointer-events-none">
      <div className="max-w-xl mx-auto pointer-events-auto">
        <div className="relative grid grid-cols-3 gap-1 rounded-pill border border-hairlineStrong bg-elevated/80 backdrop-blur-xl p-1.5 shadow-card">
          {items.map((it) => {
            const active = tab === it.id;
            return (
              <button
                key={it.id}
                onClick={() => onTabChange(it.id)}
                className={`relative flex flex-col items-center gap-0.5 py-2 px-1 rounded-pill transition
                  ${active ? 'text-white' : 'text-muted hover:text-text'}
                `}
                aria-label={it.label}
              >
                {active && (
                  <span
                    className="absolute inset-0 rounded-pill bg-accentGrad shadow-glow"
                    style={{ filter: 'saturate(1.05)' }}
                  />
                )}
                <span className="relative">
                  <it.Icon size={18} strokeWidth={2.2} />
                </span>
                <span className="relative text-[10px] font-semibold tracking-wide">{it.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
