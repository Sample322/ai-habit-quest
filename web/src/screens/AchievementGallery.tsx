import { useEffect, useState } from 'react';
import { X, Lock, Star } from 'lucide-react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { Achievement, AchievementRarity, ProgressOverview, User } from '../lib/types';
import { iconFor } from '../lib/achievement-icons';

interface Props {
  lang: Lang;
  user: User;
  onClose: () => void;
  onUserChange: (u: User) => void;
}

const MAX_SHOWCASE = 3;

export function AchievementGallery({ lang, user, onClose, onUserChange }: Props) {
  const i = t(lang);
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [showcase, setShowcase] = useState<string[]>(user.showcase ?? []);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try { setData(await api.progress()); } catch { /* non-fatal */ }
    })();
  }, []);

  async function toggle(code: string, earned: boolean): Promise<void> {
    if (!earned) return;
    haptic('light');
    const has = showcase.includes(code);
    let next: string[];
    if (has) next = showcase.filter((c) => c !== code);
    else if (showcase.length >= MAX_SHOWCASE) { setErr(i.gallery.showcaseFull); return; }
    else next = [...showcase, code];

    setShowcase(next);
    setErr(null);
    try {
      const updated = await api.updatePrefs({ showcaseAchievements: next });
      onUserChange(updated);
      notify('success');
    } catch (e) {
      notify('error');
      setShowcase(showcase); // rollback
      setErr(e instanceof Error ? e.message : i.errors.generic);
    }
  }

  const list = data?.achievements ?? [];
  const earnedCount = list.filter((a) => a.earned).length;

  return (
    <div className="fixed inset-0 z-50 bg-bg overflow-y-auto animate-fade-in">
      <div className="max-w-xl mx-auto px-4 app-safe-top app-safe-bottom">
        <header className="flex items-center justify-between mb-5 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center bg-accent/15 border border-accent/30">
              <Star size={16} className="text-accent" />
            </span>
            <div>
              <div className="eyebrow text-accent">{i.gallery.title}</div>
              <div className="text-xl font-bold tracking-tight">
                {earnedCount} / {list.length}
              </div>
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

        <div className="text-xs text-muted mb-3 px-1">{i.gallery.hint}</div>
        {err && <div className="surface text-xs text-danger mb-3 border-danger/30 bg-danger/5">{err}</div>}

        <div className="grid grid-cols-2 gap-2.5 pb-8">
          {list.map((a) => (
            <Card
              key={a.code}
              a={a}
              picked={showcase.includes(a.code)}
              lang={lang}
              onToggle={() => toggle(a.code, a.earned)}
            />
          ))}
          {list.length === 0 && (
            <div className="col-span-2 surface text-muted text-sm text-center">…</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({
  a, picked, lang, onToggle,
}: {
  a: Achievement;
  picked: boolean;
  lang: Lang;
  onToggle: () => void;
}) {
  const i = t(lang);
  const rs = rarityStyle(a.rarity);
  return (
    <button
      onClick={onToggle}
      disabled={!a.earned}
      className={`relative text-left rounded-card p-3 border transition active:scale-[0.99] ${
        a.earned ? `${rs.ring} bg-elevated ${rs.glow}` : 'border-hairline bg-surface/60 cursor-not-allowed'
      } ${picked ? 'ring-2 ring-accent/60' : ''}`}
    >
      {picked && (
        <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-pill bg-accent/20 text-accent">
          <Star size={9} className="inline-block mr-0.5" /> {i.gallery.showcasePicked}
        </span>
      )}
      <div className="flex items-center gap-2">
        <span className={`shrink-0 w-9 h-9 rounded-pill grid place-items-center border ${a.earned ? rs.ring + ' bg-bg/40' : 'border-hairline bg-bg/40 opacity-40'}`}>
          {a.hidden ? <Lock size={14} className="text-muted" /> : (() => { const IC = iconFor(a.code); return <IC size={16} className={a.earned ? 'text-accent' : 'text-muted'} />; })()}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold truncate ${a.earned ? '' : 'text-muted'}`}>
            {a.title}
          </div>
          <div className={`text-[9px] uppercase tracking-wider font-bold ${a.earned ? rs.chip : 'text-dim'}`}>
            {a.rarity}{a.bonusXp > 0 && a.earned ? ` · +${a.bonusXp} XP` : ''}
          </div>
        </div>
      </div>
      <div className="text-[11px] text-muted mt-1.5 leading-snug line-clamp-2">{a.description}</div>
      {!a.earned && !a.hidden && (
        <div className="mt-2 h-1 rounded-full bg-bg/40 overflow-hidden">
          <div
            className="h-full bg-accent/60 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.round((a.current / a.target) * 100))}%` }}
          />
        </div>
      )}
    </button>
  );
}

function rarityStyle(r: AchievementRarity): { ring: string; glow: string; chip: string } {
  if (r === 'gold') return { ring: 'border-rarGold/50', glow: 'shadow-[0_0_24px_-8px_rgba(243,201,105,0.55)]', chip: 'text-rarGold' };
  if (r === 'silver') return { ring: 'border-rarSilver/50', glow: '', chip: 'text-rarSilver' };
  if (r === 'secret') return { ring: 'border-rarSecret/60', glow: 'shadow-[0_0_28px_-8px_rgba(213,123,255,0.55)]', chip: 'text-rarSecret' };
  return { ring: 'border-rarBronze/50', glow: '', chip: 'text-rarBronze' };
}
