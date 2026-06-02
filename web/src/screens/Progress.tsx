import { useEffect, useState } from 'react';
import { Flame, Snowflake, Lock, Award, Users, ChevronRight, Crown, Trophy, Sparkles } from 'lucide-react';

import { api } from '../lib/api';
import { t, type Lang } from '../lib/i18n';
import type { Achievement, AchievementRarity, LeaderboardScope, LeaguesMe, ProgressOverview, Leaderboard, SeasonView, User } from '../lib/types';
import { ProgressRing } from '../components/ui/ProgressRing';
import { NumberTicker } from '../components/ui/NumberTicker';

export function Progress({ lang, user, onUserChange, onPremiumClick }: {
  lang: Lang;
  user: User;
  onUserChange: (u: User) => void;
  onPremiumClick: () => void;
}) {
  const i = t(lang);
  const L = (ru: string, en: string): string => (lang === 'en' ? en : ru);
  const [data, setData] = useState<ProgressOverview | null>(null);
  const [board, setBoard] = useState<Leaderboard | null>(null);
  const [league, setLeague] = useState<LeaguesMe | null>(null);
  const [season, setSeason] = useState<SeasonView | null>(null);
  const [boardScope, setBoardScope] = useState<LeaderboardScope>('global');
  const [freezeMsg, setFreezeMsg] = useState<string | null>(null);
  const [freezeBusy, setFreezeBusy] = useState(false);

  useEffect(() => {
    void (async () => setData(await api.progress()))();
    void (async () => { try { setLeague(await api.leaguesMe()); } catch { /* non-fatal */ } })();
    void (async () => { try { setSeason(await api.season()); } catch { /* non-fatal */ } })();
  }, []);

  // Re-fetch leaderboard whenever the scope toggle changes.
  useEffect(() => {
    void (async () => {
      try { setBoard(await api.leaderboard(boardScope)); } catch { /* non-fatal */ }
    })();
  }, [boardScope]);

  async function useFreeze(): Promise<void> {
    if (!user.isPremium) { onPremiumClick(); return; }
    if (freezeBusy) return;
    setFreezeBusy(true);
    try {
      const res = await api.streakFreeze();
      setFreezeMsg(i.progress.freezeUsed);
      onUserChange({
        ...user,
        streak: { ...user.streak, current: res.streakCurrent, freezesLeft: res.streakFreezesLeft },
      });
      setData(await api.progress());
    } catch (err) {
      const code = ((err as { body?: { code?: string } }).body)?.code;
      setFreezeMsg(code === 'out_of_freezes' ? i.progress.freezeNone : i.errors.generic);
    } finally {
      setFreezeBusy(false);
      setTimeout(() => setFreezeMsg(null), 4000);
    }
  }

  if (!data) return <ProgressSkeleton />;

  const earned = data.achievements.filter((a) => a.earned).length;

  return (
    <div className="space-y-5 stagger">
      {/* Hero rank ring + big number */}
      <section className="card aurora p-6">
        <div className="flex items-center gap-5">
          <ProgressRing pct={data.rank.progressPct} size={132} stroke={10}>
            <div className="eyebrow">{L('Уровень', 'Level')}</div>
            <div className="hud-num text-4xl leading-none mt-1">
              <NumberTicker value={data.rank.level} duration={600} />
            </div>
          </ProgressRing>
          <div className="flex-1 min-w-0">
            <div className="eyebrow text-accent">{L('Ранг', 'Rank')}</div>
            <div className="text-2xl font-bold leading-tight mt-1 truncate">{data.rank.name}</div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="hud-num text-3xl text-text">
                <NumberTicker value={data.xpTotal} duration={900} />
              </span>
              <span className="text-xs text-muted">XP</span>
            </div>
            <div className="text-[11px] text-muted mt-1">
              {L('До ур.', 'To lv')} {data.rank.level + 1}: {Math.max(0, data.rank.nextLevelXp - data.xpTotal)} XP
            </div>
          </div>
        </div>
      </section>

      {/* Quick stats */}
      <section className="grid grid-cols-3 gap-2.5">
        <Stat icon={<Flame size={14} className="text-warning" />} label={i.today.streak} value={data.streakCurrent} sub={`${i.progress.bestStreak} ${data.streakBest}`} />
        <Stat label={L('Выполнено', 'Done')} value={data.completedTasks} />
        <Stat icon={<Award size={14} className="text-accent" />} label={L('Бейджи', 'Badges')} value={earned} sub={`/ ${data.achievements.length}`} />
      </section>

      {/* Streak freeze */}
      <section className={`card p-4 ${user.isPremium ? '' : 'opacity-90'}`}>
        <div className="flex items-center gap-3">
          <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
            <Snowflake size={18} className="text-accentGlow" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold leading-tight">{i.progress.freezeAction}</div>
            <div className="text-[11px] text-muted mt-0.5">
              {user.isPremium
                ? `${i.progress.freezeLeft}: ${user.streak.freezesLeft}/2`
                : i.progress.freezeFree}
            </div>
          </div>
          {user.isPremium ? (
            <button
              onClick={useFreeze}
              disabled={freezeBusy || user.streak.freezesLeft <= 0}
              className="shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-semibold bg-accent text-white hover:bg-accentGlow disabled:opacity-40 transition active:scale-95"
            >
              {freezeBusy ? '…' : i.progress.freezeAction}
            </button>
          ) : (
            <button onClick={onPremiumClick} className="shrink-0 rounded-pill px-3 py-1.5 text-xs font-semibold border border-accent/40 text-accent hover:bg-accent/10 transition flex items-center gap-1">
              <Crown size={12} /> Pro
            </button>
          )}
        </div>
        {freezeMsg && <div className="text-[11px] text-muted mt-2">{freezeMsg}</div>}
      </section>

      {/* Weekly league */}
      {league && <LeagueCard league={league} lang={lang} />}

      {/* 7-day strip */}
      <section className="surface">
        <div className="flex items-baseline justify-between mb-3">
          <div className="eyebrow">{i.progress.last7}</div>
          <div className="text-[11px] text-muted tabular">
            {data.last7.reduce((s, d) => s + d.done, 0)}/{data.last7.reduce((s, d) => s + d.total, 0)}
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {data.last7.map((d) => {
            const ratio = d.total === 0 ? 0 : d.done / d.total;
            const heightPct = Math.max(4, Math.round(ratio * 100));
            const isPerfect = ratio === 1;
            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5">
                <div className="w-full h-24 bg-white/[0.05] rounded-sm relative overflow-hidden">
                  <div
                    className={`absolute bottom-0 inset-x-0 rounded-sm transition-all duration-700 ${isPerfect ? 'bg-successGrad' : 'bg-accentGrad'}`}
                    style={{ height: `${heightPct}%`, opacity: ratio === 0 ? 0.2 : 1 }}
                  />
                </div>
                <div className="text-[9px] text-muted tabular">{d.date.slice(8)}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Achievements */}
      <section className="space-y-3">
        <SectionHead title={L('Достижения', 'Achievements')} right={`${earned}/${data.achievements.length}`} />
        <div className="grid grid-cols-2 gap-2.5">
          {data.achievements.map((a) => (
            <AchievementCard key={a.code} a={a} lang={lang} />
          ))}
        </div>
      </section>

      {/* Season card */}
      {season && <SeasonCard season={season} lang={lang} />}

      {/* Leaderboard with scope tabs */}
      {board && (
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <div className="text-sm font-semibold tracking-tight">{L('Лидерборд', 'Leaderboard')}</div>
            <div className="text-[11px] text-muted tabular">#{board.myRank} / {board.totalPlayers}</div>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-pill bg-elevated border border-hairline">
            <ScopeTab active={boardScope === 'global'} onClick={() => setBoardScope('global')}>
              {i.progress.tabGlobal}
            </ScopeTab>
            <ScopeTab active={boardScope === 'friends'} onClick={() => setBoardScope('friends')}>
              {i.progress.tabFriends}
            </ScopeTab>
          </div>
          {board.top.length === 0 ? (
            <div className="card p-6 text-center text-sm text-muted">
              {boardScope === 'friends'
                ? L('Пригласи друзей — увидишь свой круг здесь.', 'Invite friends to populate this board.')
                : L('Пусто.', 'Empty.')}
            </div>
          ) : (
            <div className="card divide-y divide-hairline overflow-hidden">
              {board.top.slice(0, 12).map((e) => (
                <div
                  key={e.id}
                  className={`px-4 py-2.5 flex items-center gap-3 transition ${e.isMe ? 'bg-accent/10' : ''}`}
                >
                  <div className={`w-7 text-center font-bold ${e.position <= 3 ? 'text-warning' : 'text-muted text-xs'}`}>
                    {e.position === 1 ? '🥇' : e.position === 2 ? '🥈' : e.position === 3 ? '🥉' : e.position}
                  </div>
                  <div className="flex-1 min-w-0 truncate text-sm font-medium">
                    {e.name}
                    {e.isMe && <span className="text-accent text-[10px] uppercase tracking-wider ml-1">· {L('ты', 'you')}</span>}
                  </div>
                  <div className="text-[10px] text-muted tabular shrink-0">🔥{e.streak}</div>
                  <div className="text-sm font-bold tabular shrink-0 text-text min-w-[3rem] text-right">{e.xp}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!user.isPremium && (
        <button onClick={onPremiumClick} className="w-full text-left card aurora p-5 transition active:scale-[0.99]">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-11 h-11 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
              <Crown size={18} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base leading-tight">{i.today.premiumCta}</div>
              <div className="text-xs text-muted mt-0.5">
                {L('Несколько целей, 30-дневный план, перегенерация и больше.', 'Multiple goals, 30-day plans, regeneration and more.')}
              </div>
            </div>
            <ChevronRight size={18} className="text-muted" />
          </div>
        </button>
      )}
    </div>
  );
}

function SeasonCard({ season, lang }: { season: SeasonView; lang: Lang }) {
  const i = t(lang);
  const L = (ru: string, en: string): string => (lang === 'en' ? en : ru);
  return (
    <section className="card aurora p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-11 h-11 rounded-pill grid place-items-center bg-accentGrad shadow-glow">
          <Trophy size={18} className="text-white" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles size={13} className="text-accentGlow" />
            <span className="eyebrow">{i.progress.season} {season.number}</span>
          </div>
          <div className="text-base font-bold leading-tight mt-0.5">
            {season.daysLeft}d <span className="text-muted font-normal text-sm">{i.progress.seasonDaysLeft}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="hud-num text-3xl leading-none">#{season.myRank}</div>
          <div className="eyebrow mt-1 tabular">{season.myXp} XP</div>
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="eyebrow text-muted px-1">{i.progress.seasonRewards}</div>
        {season.rewardTiers.map((tier) => {
          const inTier = season.myRank <= tier.maxRank;
          return (
            <div
              key={tier.maxRank}
              className={`rounded-pill px-3 py-1.5 flex items-center gap-2 text-xs border ${
                inTier ? 'border-positive/40 bg-positive/10 text-text' : 'border-hairline bg-bg/30 text-muted'
              }`}
            >
              <span className={`shrink-0 w-5 h-5 rounded-pill grid place-items-center text-[10px] font-bold ${inTier ? 'bg-positive text-bg' : 'bg-white/5 text-muted'}`}>
                {tier.maxRank === 1 ? '🥇' : tier.maxRank}
              </span>
              <span className="flex-1 font-medium">
                {i.progress.seasonRewardTier
                  .replace('{n}', String(tier.maxRank))
                  .replace('{d}', String(tier.days))}
              </span>
              {inTier && <span className="text-positive text-[10px] uppercase tracking-wider font-bold">{L('Идёшь!', 'On track!')}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ScopeTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill py-2 text-sm font-semibold transition ${
        active ? 'bg-accentGrad text-white shadow-glow' : 'text-muted hover:text-text'
      }`}
    >
      {children}
    </button>
  );
}

function LeagueCard({ league, lang }: { league: LeaguesMe; lang: Lang }) {
  const i = t(lang);
  return (
    <section className="card aurora p-5 space-y-4">
      <div className="flex items-center gap-3">
        <span className="shrink-0 w-11 h-11 rounded-pill grid place-items-center bg-elevated border border-hairlineStrong text-2xl">
          {league.league.tierIcon}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Users size={14} className="text-muted" />
            <span className="eyebrow">{i.progress.league}</span>
          </div>
          <div className="text-base font-bold leading-tight mt-0.5">{league.league.tierName}</div>
          <div className="text-[10px] text-muted mt-0.5">
            {i.progress.leagueDaysLeft}: {league.league.daysLeft}d
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="hud-num text-3xl leading-none">#{league.myRank}</div>
          <div className="eyebrow mt-1 tabular">{league.myWeeklyXp} XP</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider">
        <span className="text-positive font-semibold">↑ TOP {league.promoteCount}</span>
        <span className="h-px flex-1 bg-hairline" />
        <span className="text-danger font-semibold">↓ {league.demoteCount}</span>
      </div>
      <div className="space-y-1">
        {league.members.slice(0, 10).map((m) => {
          const isPromo = m.position <= league.promoteCount;
          const isDemo = m.position > league.members.length - league.demoteCount;
          return (
            <div
              key={m.id}
              className={`rounded-card px-3 py-2 flex items-center gap-3 text-xs border ${
                m.isMe ? 'border-accent/40 bg-accent/10' : 'border-transparent bg-bg/30'
              }`}
            >
              <div className="w-1 self-stretch rounded-full" style={{ background: isPromo ? '#19d57a' : isDemo ? '#ef4444' : 'transparent' }} />
              <div className={`w-5 text-center font-bold ${isPromo ? 'text-positive' : isDemo ? 'text-danger' : 'text-muted'}`}>
                {m.position}
              </div>
              <div className="flex-1 truncate font-medium">{m.name}</div>
              <div className="text-[10px] text-muted">🔥{m.streak}</div>
              <div className="font-semibold tabular tabular text-text min-w-[2.5rem] text-right">{m.weeklyXp}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SectionHead({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <div className="text-sm font-semibold tracking-tight">{title}</div>
      {right && <div className="text-[11px] text-muted tabular">{right}</div>}
    </div>
  );
}

function rarityStyle(r: AchievementRarity): { ring: string; glow: string; chip: string } {
  if (r === 'gold') return { ring: 'border-rarGold/50', glow: 'shadow-[0_0_28px_-8px_rgba(243,201,105,0.6)]', chip: 'text-rarGold' };
  if (r === 'silver') return { ring: 'border-rarSilver/50', glow: '', chip: 'text-rarSilver' };
  if (r === 'secret') return { ring: 'border-rarSecret/60', glow: 'shadow-[0_0_32px_-8px_rgba(213,123,255,0.6)]', chip: 'text-rarSecret' };
  return { ring: 'border-rarBronze/50', glow: '', chip: 'text-rarBronze' };
}

function rarityLabel(r: AchievementRarity, lang: Lang): string {
  if (lang === 'en') return r === 'secret' ? 'Secret' : r[0].toUpperCase() + r.slice(1);
  return { bronze: 'Бронза', silver: 'Серебро', gold: 'Золото', secret: 'Секрет' }[r];
}

function AchievementCard({ a, lang }: { a: Achievement; lang: Lang }) {
  const rs = rarityStyle(a.rarity);
  return (
    <div
      className={`relative overflow-hidden rounded-card p-3 border transition ${
        a.earned ? `${rs.ring} bg-elevated ${rs.glow}` : 'border-hairline bg-surface/60'
      }`}
    >
      {a.earned && a.rarity === 'secret' && (
        <span className="pointer-events-none absolute -top-8 -right-8 w-24 h-24 rounded-full blur-2xl bg-rarSecret/30" />
      )}
      <div className="relative flex items-center gap-2">
        <span
          className={`shrink-0 w-9 h-9 rounded-pill grid place-items-center text-lg border ${
            a.earned ? rs.ring + ' bg-bg/40' : 'border-hairline bg-bg/40'
          } ${a.earned ? '' : a.hidden ? 'opacity-60' : 'opacity-40 grayscale'}`}
        >
          {a.hidden ? <Lock size={14} className="text-muted" /> : <span>{a.icon}</span>}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-sm font-semibold truncate ${a.earned ? '' : 'text-muted'}`}>{a.title}</div>
          <div className={`text-[9px] uppercase tracking-wider font-bold ${a.earned ? rs.chip : 'text-dim'}`}>
            {rarityLabel(a.rarity, lang)}{a.bonusXp > 0 && a.earned ? ` · +${a.bonusXp} XP` : ''}
          </div>
        </div>
      </div>
      <div className="relative text-[11px] text-muted mt-2 leading-snug line-clamp-2">{a.description}</div>
      {!a.earned && !a.hidden && (
        <div className="relative mt-2 h-1 rounded-full bg-bg/40 overflow-hidden">
          <div className="h-full bg-accent/60 transition-all duration-700" style={{ width: `${Math.min(100, Math.round((a.current / a.target) * 100))}%` }} />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, sub }: { icon?: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <div className="surface">
      <div className="eyebrow flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      <div className="hud-num text-2xl mt-1.5">
        <NumberTicker value={value} duration={600} />
      </div>
      {sub && <div className="text-[10px] text-muted mt-1 tabular">{sub}</div>}
    </div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-5">
      <div className="card p-6 h-44 animate-pulse" />
      <div className="grid grid-cols-3 gap-2.5">
        {[0, 1, 2].map((k) => <div key={k} className="surface h-20 animate-pulse" />)}
      </div>
      <div className="card p-4 h-16 animate-pulse" />
    </div>
  );
}
