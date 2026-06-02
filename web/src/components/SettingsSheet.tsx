import { useState } from 'react';
import { X, Bell, Globe, Clock } from 'lucide-react';

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

export function SettingsSheet({ lang, user, onClose, onUserChange }: Props) {
  const i = t(lang);
  const [hour, setHour] = useState(user.reminder.hour);
  const [minute, setMinute] = useState(user.reminder.minute);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(): Promise<void> {
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

          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? '…' : (savedMsg ?? i.common.done)}
          </button>
        </section>

        {/* Language */}
        <section className="card p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="shrink-0 w-10 h-10 rounded-pill grid place-items-center border border-hairlineStrong bg-bg/40">
              <Globe size={16} className="text-accent" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">{i.settings.language}</div>
              <div className="text-[11px] text-muted mt-0.5">{user.timezone}</div>
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
