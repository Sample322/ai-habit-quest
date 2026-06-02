import { useMemo, useState } from 'react';
import { X, Bell, Globe, Clock, User as UserIcon, MapPin, BellRing } from 'lucide-react';

import { api } from '../lib/api';
import { haptic, notify } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { User } from '../lib/types';

interface Props {
  lang: Lang;
  user: User;
  onClose: () => void;
  onUserChange: (u: User) => void;
}

// Curated timezone shortlist — Telegram audience is mostly RU/CIS/EU; users
// can fall through to a search-style picker if needed. Each entry shows the
// IANA id we send to the backend.
const TIMEZONES: { id: string; ru: string; en: string }[] = [
  { id: 'Europe/Kaliningrad', ru: 'Калининград (UTC+2)', en: 'Kaliningrad (UTC+2)' },
  { id: 'Europe/Moscow', ru: 'Москва (UTC+3)', en: 'Moscow (UTC+3)' },
  { id: 'Europe/Samara', ru: 'Самара (UTC+4)', en: 'Samara (UTC+4)' },
  { id: 'Asia/Yekaterinburg', ru: 'Екатеринбург (UTC+5)', en: 'Yekaterinburg (UTC+5)' },
  { id: 'Asia/Omsk', ru: 'Омск (UTC+6)', en: 'Omsk (UTC+6)' },
  { id: 'Asia/Krasnoyarsk', ru: 'Красноярск (UTC+7)', en: 'Krasnoyarsk (UTC+7)' },
  { id: 'Asia/Irkutsk', ru: 'Иркутск (UTC+8)', en: 'Irkutsk (UTC+8)' },
  { id: 'Asia/Yakutsk', ru: 'Якутск (UTC+9)', en: 'Yakutsk (UTC+9)' },
  { id: 'Asia/Vladivostok', ru: 'Владивосток (UTC+10)', en: 'Vladivostok (UTC+10)' },
  { id: 'Asia/Magadan', ru: 'Магадан (UTC+11)', en: 'Magadan (UTC+11)' },
  { id: 'Asia/Kamchatka', ru: 'Камчатка (UTC+12)', en: 'Kamchatka (UTC+12)' },
  { id: 'Europe/Kiev', ru: 'Киев (UTC+2/+3)', en: 'Kyiv (UTC+2/+3)' },
  { id: 'Europe/Minsk', ru: 'Минск (UTC+3)', en: 'Minsk (UTC+3)' },
  { id: 'Asia/Almaty', ru: 'Алматы (UTC+6)', en: 'Almaty (UTC+6)' },
  { id: 'Asia/Tbilisi', ru: 'Тбилиси (UTC+4)', en: 'Tbilisi (UTC+4)' },
  { id: 'Asia/Yerevan', ru: 'Ереван (UTC+4)', en: 'Yerevan (UTC+4)' },
  { id: 'Asia/Tashkent', ru: 'Ташкент (UTC+5)', en: 'Tashkent (UTC+5)' },
  { id: 'Europe/Berlin', ru: 'Берлин (UTC+1/+2)', en: 'Berlin (UTC+1/+2)' },
  { id: 'Europe/London', ru: 'Лондон (UTC+0/+1)', en: 'London (UTC+0/+1)' },
  { id: 'America/New_York', ru: 'Нью-Йорк (UTC−5/−4)', en: 'New York (UTC−5/−4)' },
];

export function SettingsSheet({ lang, user, onClose, onUserChange }: Props) {
  const i = t(lang);
  const [hour, setHour] = useState(user.reminder.hour);
  const [minute, setMinute] = useState(user.reminder.minute);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState(user.firstName ?? '');
  const [tz, setTz] = useState(user.timezone);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);

  const tzLabel = useMemo(() => {
    const found = TIMEZONES.find((z) => z.id === tz);
    if (found) return lang === 'en' ? found.en : found.ru;
    return tz;
  }, [tz, lang]);

  async function saveReminder(): Promise<void> {
    setBusy(true);
    haptic('light');
    try {
      const updated = await api.updatePrefs({ reminderHour: hour, reminderMinute: minute });
      onUserChange(updated);
      notify('success');
      setSavedMsg(i.settings.saved);
      setTimeout(() => setSavedMsg(null), 2000);
    } catch {
      notify('error');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(): Promise<void> {
    setProfileBusy(true);
    haptic('light');
    try {
      const updated = await api.updatePrefs({ firstName: name, timezone: tz });
      onUserChange(updated);
      notify('success');
      setProfileMsg(i.settings.saved);
      setTimeout(() => setProfileMsg(null), 2000);
    } catch {
      notify('error');
    } finally {
      setProfileBusy(false);
    }
  }

  type NotifKey =
    | 'notifReminders'
    | 'notifAchievements'
    | 'notifSeasons'
    | 'notifStreakBreak'
    | 'notifWeeklyRecap';

  async function updateNotif(key: NotifKey, value: boolean): Promise<void> {
    haptic('light');
    try {
      const updated = await api.updatePrefs({ [key]: value });
      onUserChange(updated);
      notify('success');
    } catch {
      notify('error');
    }
  }

  async function switchLang(next: Lang): Promise<void> {
    if (next === lang) return;
    haptic('light');
    try {
      const updated = await api.updatePrefs({ languageCode: next });
      onUserChange(updated);
      notify('success');
    } catch {
      notify('error');
    }
  }

  const timeLabel = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-3 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-card border border-hairline shadow-card w-full max-w-md p-5 space-y-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">{i.settings.title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Profile */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
              <UserIcon size={16} className="text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">{i.settings.profile}</div>
              <div className="text-[11px] text-muted mt-0.5">{i.settings.profileHint}</div>
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="eyebrow flex items-center gap-1"><UserIcon size={11} />{i.settings.name}</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder={user.username ?? 'Ivan'}
                className="mt-1.5 w-full bg-elevated text-text rounded-card px-3 py-2.5 outline-none border border-hairline focus:border-accent text-sm transition"
                style={{ colorScheme: 'dark', WebkitTextFillColor: '#f5f7fb' }}
              />
            </div>
            <div>
              <div className="eyebrow flex items-center gap-1"><MapPin size={11} />{i.settings.timezone}</div>
              <select
                value={tz}
                onChange={(e) => setTz(e.target.value)}
                className="mt-1.5 w-full bg-elevated text-text rounded-card px-3 py-2.5 outline-none border border-hairline focus:border-accent text-sm transition appearance-none"
                style={{ colorScheme: 'dark' }}
              >
                {!TIMEZONES.find((z) => z.id === tz) && (
                  <option value={tz}>{tz}</option>
                )}
                {TIMEZONES.map((z) => (
                  <option key={z.id} value={z.id}>
                    {lang === 'en' ? z.en : z.ru}
                  </option>
                ))}
              </select>
              <div className="text-[10px] text-muted mt-1 tabular">{tzLabel}</div>
            </div>
          </div>
          <button onClick={saveProfile} disabled={profileBusy} className="btn-primary">
            {profileBusy ? '…' : (profileMsg ?? i.common.done)}
          </button>
        </section>

        {/* Reminders */}
        <section className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
              <Bell size={16} className="text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">{i.settings.reminders}</div>
              <div className="text-[11px] text-muted mt-0.5">{i.settings.reminderHint}</div>
            </div>
            <div className="hud-num text-lg">{timeLabel}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <TimePicker
              icon={<Clock size={13} className="text-muted" />}
              label="ЧЧ"
              value={hour}
              min={0}
              max={23}
              onChange={setHour}
            />
            <TimePicker
              icon={<Clock size={13} className="text-muted" />}
              label="ММ"
              value={minute}
              min={0}
              max={59}
              step={5}
              onChange={setMinute}
            />
          </div>

          <button onClick={saveReminder} disabled={busy} className="btn-primary">
            {busy ? '…' : (savedMsg ?? i.common.done)}
          </button>
        </section>

        {/* Notification preferences */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
              <BellRing size={16} className="text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">{i.settings.notifications}</div>
              <div className="text-[11px] text-muted mt-0.5">{i.settings.notificationsHint}</div>
            </div>
          </div>
          <div className="space-y-1.5">
            <NotifToggle
              label={i.settings.notifReminders}
              value={user.notifications.reminders}
              onChange={(v) => updateNotif('notifReminders', v)}
            />
            <NotifToggle
              label={i.settings.notifAchievements}
              value={user.notifications.achievements}
              onChange={(v) => updateNotif('notifAchievements', v)}
            />
            <NotifToggle
              label={i.settings.notifStreakBreak}
              value={user.notifications.streakBreak}
              onChange={(v) => updateNotif('notifStreakBreak', v)}
            />
            <NotifToggle
              label={i.settings.notifWeeklyRecap}
              value={user.notifications.weeklyRecap}
              onChange={(v) => updateNotif('notifWeeklyRecap', v)}
            />
            <NotifToggle
              label={i.settings.notifSeasons}
              value={user.notifications.seasons}
              onChange={(v) => updateNotif('notifSeasons', v)}
            />
          </div>
        </section>

        {/* Language */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
              <Globe size={16} className="text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">{i.settings.language}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <LangButton active={lang === 'ru'} onClick={() => switchLang('ru')}>Русский</LangButton>
            <LangButton active={lang === 'en'} onClick={() => switchLang('en')}>English</LangButton>
          </div>
        </section>
      </div>
    </div>
  );
}

function TimePicker({
  icon, label, value, min, max, step = 1, onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="surface p-3">
      <div className="eyebrow flex items-center gap-1">{icon}{label}</div>
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={() => onChange(Math.max(min, value - step))}
          className="w-8 h-8 rounded-pill border border-hairlineStrong text-muted hover:text-accent transition active:scale-95"
        >
          −
        </button>
        <div className="flex-1 text-center hud-num text-xl">{String(value).padStart(2, '0')}</div>
        <button
          onClick={() => onChange(Math.min(max, value + step))}
          className="w-8 h-8 rounded-pill border border-hairlineStrong text-muted hover:text-accent transition active:scale-95"
        >
          +
        </button>
      </div>
    </div>
  );
}

function NotifToggle({
  label, value, onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 py-2 px-3 rounded-card bg-bg/40 border border-hairline cursor-pointer hover:bg-bg/60 transition">
      <span className="flex-1 text-sm font-medium text-text">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative shrink-0 w-10 h-6 rounded-pill transition ${value ? 'bg-accent' : 'bg-white/10'}`}
        aria-pressed={value}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-pill bg-white shadow-card transition-all"
          style={{ left: value ? '18px' : '2px' }}
        />
      </button>
    </label>
  );
}

function LangButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-pill py-2.5 text-sm font-semibold transition border ${
        active ? 'bg-accentGrad text-white border-transparent shadow-glow' : 'border-hairlineStrong text-text bg-white/[0.02] hover:bg-white/[0.04]'
      }`}
    >
      {children}
    </button>
  );
}
