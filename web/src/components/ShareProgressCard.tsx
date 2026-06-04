import { useEffect, useRef, useState } from 'react';
import { X, Download, Sparkles, Send } from 'lucide-react';

import { api } from '../lib/api';
import { canShareToStory, haptic, notify, shareToStory, shareUrl } from '../lib/telegram';
import { t, type Lang } from '../lib/i18n';
import type { User } from '../lib/types';

interface Props {
  lang: Lang;
  user: User;
  rankName: string;
  onClose: () => void;
}

const BOT_USERNAME = import.meta.env.VITE_TG_BOT_USERNAME || 'AI_Habit_Tracking_bot';

/**
 * Render a sharable PNG card with rank / streak / XP. The canvas is drawn
 * once, then exposed via download (local PNG), share-to-story (upload to
 * backend → tg.shareToStory) and share-to-chat (native share with the file
 * if supported, falling back to text + referral link).
 */
export function ShareProgressCard({ lang, user, rankName, onClose }: Props) {
  const i = t(lang);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'story' | 'chat' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const storySupported = canShareToStory();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCard(canvas, { lang, user, rankName });
    setDataUrl(canvas.toDataURL('image/png'));
  }, [lang, user, rankName]);

  function showInfo(msg: string): void {
    setInfo(msg);
    setTimeout(() => setInfo(null), 3000);
  }

  function download(): void {
    if (!dataUrl) return;
    haptic('light');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `ahq-progress-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    notify('success');
  }

  async function uploadDataUrl(): Promise<string | null> {
    if (!dataUrl) return null;
    // Hard 20s timeout — Telegram WebView occasionally drops fetch promises
    // silently on slow connections; we'd rather show an error than freeze
    // the buttons forever.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000));
    try {
      const result = await Promise.race([
        api.uploadShare(dataUrl).then((r) => r.url).catch(() => null),
        timeout,
      ]);
      if (!result) { notify('error'); showInfo(i.errors.generic); return null; }
      return result;
    } catch {
      notify('error');
      return null;
    }
  }

  async function story(): Promise<void> {
    if (!dataUrl || busy) return;
    if (!storySupported) { showInfo(i.share.noStorySupport); return; }
    setBusy('story');
    haptic('light');
    try {
      const url = await uploadDataUrl();
      if (!url) return;
      const link = `https://t.me/${BOT_USERNAME}?startapp=ref_${user.referralCode}`;
      const ok = shareToStory(url, i.share.storyText, link);
      if (!ok) { showInfo(i.share.noStorySupport); return; }
      notify('success');
    } finally {
      setBusy(null);
    }
  }

  async function chat(): Promise<void> {
    if (!dataUrl || busy) return;
    setBusy('chat');
    haptic('light');
    try {
      // Upload the PNG to the backend → get a public URL. We share that URL
      // in a Telegram chat, Telegram unfurls the image inline as a preview.
      // We deliberately do NOT call navigator.share / fetch(data:URL) — both
      // hang inside Telegram WebView.
      const url = await uploadDataUrl();
      if (!url) return;
      const text = lang === 'en'
        ? `🏆 ${rankName} · 🔥 ${user.streak.current}d · ⚡ ${user.xpTotal} XP`
        : `🏆 ${rankName} · 🔥 ${user.streak.current}д · ⚡ ${user.xpTotal} XP`;
      // Share the image URL itself; Telegram auto-previews image/png URLs.
      shareUrl(url, text);
      notify('success');
    } catch {
      notify('error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-card border border-hairline shadow-card w-full max-w-md p-5 space-y-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold tracking-tight">{i.share.title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 -mr-2 grid place-items-center rounded-pill text-muted hover:text-text hover:bg-white/5 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-card overflow-hidden border border-hairline">
          <canvas ref={canvasRef} width={1080} height={1350} className="w-full h-auto block" />
        </div>

        {/* Uniform 3-button row */}
        <div className="grid grid-cols-3 gap-2">
          <ActionBtn
            onClick={download}
            disabled={!dataUrl}
            icon={<Download size={16} />}
            label={i.share.download}
            variant="ghost"
          />
          <ActionBtn
            onClick={chat}
            disabled={!dataUrl || busy !== null}
            icon={<Send size={16} />}
            label={busy === 'chat' ? '…' : i.share.shareToChat}
            variant="ghost"
          />
          <ActionBtn
            onClick={story}
            disabled={!dataUrl || busy !== null || !storySupported}
            icon={<Sparkles size={16} />}
            label={busy === 'story' ? '…' : i.share.shareToStory}
            variant="primary"
          />
        </div>
        {info && <div className="text-[11px] text-muted text-center">{info}</div>}
        <div className="text-[11px] text-muted leading-relaxed text-center">{i.share.hint}</div>
      </div>
    </div>
  );
}

function ActionBtn({
  onClick, disabled, icon, label, variant,
}: {
  onClick: () => void;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  variant: 'primary' | 'ghost';
}) {
  const base = 'h-14 rounded-card flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 px-2';
  const cls = variant === 'primary'
    ? `${base} text-white shadow-glow`
    : `${base} text-text border border-hairlineStrong bg-white/[0.02] hover:bg-white/[0.05]`;
  const style = variant === 'primary'
    ? { backgroundImage: 'linear-gradient(135deg,#7c5cff 0%,#9b7dff 60%,#c4a6ff 100%)' }
    : undefined;
  return (
    <button onClick={onClick} disabled={disabled} className={cls} style={style}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function drawCard(
  canvas: HTMLCanvasElement,
  { lang, user, rankName }: { lang: Lang; user: User; rankName: string },
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#11131a');
  bg.addColorStop(0.5, '#0c0d12');
  bg.addColorStop(1, '#06070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const g1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.5);
  g1.addColorStop(0, 'rgba(124,92,255,0.45)');
  g1.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, W * 0.6);
  g2.addColorStop(0, 'rgba(25,213,122,0.30)');
  g2.addColorStop(1, 'rgba(25,213,122,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#7c5cff';
  ctx.font = '700 32px Manrope, sans-serif';
  ctx.fillText('AI HABIT QUEST', W / 2, 110);

  ctx.fillStyle = '#f5f7fb';
  ctx.font = '600 48px Manrope, sans-serif';
  ctx.fillText(user.firstName || user.username || '·', W / 2, 200);

  const rankGrad = ctx.createLinearGradient(0, 0, W, 0);
  rankGrad.addColorStop(0, '#f5f7fb');
  rankGrad.addColorStop(0.5, '#c4a6ff');
  rankGrad.addColorStop(1, '#f5f7fb');
  ctx.fillStyle = rankGrad;
  ctx.font = '800 120px Manrope, sans-serif';
  ctx.fillText(rankName, W / 2, 360);

  ctx.fillStyle = '#7c5cff';
  ctx.font = '600 36px Manrope, sans-serif';
  ctx.fillText(`${lang === 'en' ? 'Level' : 'Уровень'} ${user.level}`, W / 2, 440);

  const yStat = 700;
  drawStat(ctx, W * 0.18, yStat, '🔥', String(user.streak.current), lang === 'en' ? 'STREAK' : 'СЕРИЯ');
  drawStat(ctx, W * 0.50, yStat, '⚡', String(user.xpTotal), 'XP');
  drawStat(ctx, W * 0.82, yStat, '🏆', String(user.streak.best), lang === 'en' ? 'BEST' : 'РЕКОРД');

  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 28px Manrope, sans-serif';
  ctx.fillText(
    lang === 'en' ? 'Build habits with AI · @AI_Habit_Tracking_bot' : 'Привычки с AI · @AI_Habit_Tracking_bot',
    W / 2,
    H - 120,
  );

  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(W * 0.3, H - 80);
  ctx.lineTo(W * 0.7, H - 80);
  ctx.stroke();
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  icon: string,
  value: string,
  label: string,
): void {
  ctx.fillStyle = '#f5f7fb';
  ctx.font = '500 56px Manrope, sans-serif';
  ctx.fillText(icon, cx, cy - 70);

  ctx.fillStyle = '#f5f7fb';
  ctx.font = '800 96px Manrope, sans-serif';
  ctx.fillText(value, cx, cy);

  ctx.fillStyle = '#7c8290';
  ctx.font = '700 24px Manrope, sans-serif';
  ctx.fillText(label, cx, cy + 70);
}
