import { useEffect, useRef, useState } from 'react';
import { X, Download, Share2 } from 'lucide-react';

import { haptic, notify, shareUrl } from '../lib/telegram';
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
 * Render a sharable PNG card with rank / streak / XP. Drawn into an offscreen
 * <canvas> so we can both display it as preview and offer a Download button
 * (works on iOS + Android Telegram WebView via a data URL anchor).
 */
export function ShareProgressCard({ lang, user, rankName, onClose }: Props) {
  const i = t(lang);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCard(canvas, { lang, user, rankName });
    setDataUrl(canvas.toDataURL('image/png'));
  }, [lang, user, rankName]);

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

  function shareText(): void {
    haptic('light');
    const link = `https://t.me/${BOT_USERNAME}?startapp=ref_${user.referralCode}`;
    const text = lang === 'en'
      ? `🏆 ${rankName} · 🔥 ${user.streak.current}d streak · ⚡ ${user.xpTotal} XP in AI Habit Quest`
      : `🏆 ${rankName} · 🔥 серия ${user.streak.current}д · ⚡ ${user.xpTotal} XP в AI Habit Quest`;
    shareUrl(link, text);
  }

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-bg rounded-card border border-hairline shadow-card w-full max-w-md p-5 space-y-4"
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

        {/* Preview — visually scaled to fit modal; PNG saved is full 1080×1350 */}
        <div className="rounded-card overflow-hidden border border-hairline">
          <canvas ref={canvasRef} width={1080} height={1350} className="w-full h-auto block" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={download} className="btn-ghost flex items-center justify-center gap-1.5">
            <Download size={14} />
            {i.share.download}
          </button>
          <button onClick={shareText} className="btn-primary flex items-center justify-center gap-1.5">
            <Share2 size={14} />
            {i.share.shareTo}
          </button>
        </div>

        <div className="text-[11px] text-muted leading-relaxed text-center">{i.share.hint}</div>
      </div>
    </div>
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

  // Background — onyx gradient + glow blobs (matches app palette)
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#11131a');
  bg.addColorStop(0.5, '#0c0d12');
  bg.addColorStop(1, '#06070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Violet blob top-left
  const g1 = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.2, H * 0.15, W * 0.5);
  g1.addColorStop(0, 'rgba(124,92,255,0.45)');
  g1.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Emerald blob bottom-right
  const g2 = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, W * 0.6);
  g2.addColorStop(0, 'rgba(25,213,122,0.30)');
  g2.addColorStop(1, 'rgba(25,213,122,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // App eyebrow
  ctx.fillStyle = '#7c5cff';
  ctx.font = '700 32px Manrope, sans-serif';
  ctx.letterSpacing = '0.2em';
  ctx.fillText('AI HABIT QUEST', W / 2, 110);

  // Username
  ctx.fillStyle = '#f5f7fb';
  ctx.font = '600 48px Manrope, sans-serif';
  ctx.fillText(user.firstName || user.username || '·', W / 2, 200);

  // Rank — big shimmer text
  const rankGrad = ctx.createLinearGradient(0, 0, W, 0);
  rankGrad.addColorStop(0, '#f5f7fb');
  rankGrad.addColorStop(0.5, '#c4a6ff');
  rankGrad.addColorStop(1, '#f5f7fb');
  ctx.fillStyle = rankGrad;
  ctx.font = '800 120px Manrope, sans-serif';
  ctx.fillText(rankName, W / 2, 360);

  // Level chip
  ctx.fillStyle = '#7c5cff';
  ctx.font = '600 36px Manrope, sans-serif';
  ctx.fillText(`${lang === 'en' ? 'Level' : 'Уровень'} ${user.level}`, W / 2, 440);

  // Big HUD stats — 3 columns
  const yStat = 700;
  drawStat(ctx, W * 0.18, yStat, '🔥', String(user.streak.current), lang === 'en' ? 'STREAK' : 'СЕРИЯ');
  drawStat(ctx, W * 0.50, yStat, '⚡', String(user.xpTotal), 'XP');
  drawStat(ctx, W * 0.82, yStat, '🏆', String(user.streak.best), lang === 'en' ? 'BEST' : 'РЕКОРД');

  // Bottom CTA
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 28px Manrope, sans-serif';
  ctx.fillText(
    lang === 'en' ? 'Build habits with AI · @AI_Habit_Tracking_bot' : 'Привычки с AI · @AI_Habit_Tracking_bot',
    W / 2,
    H - 120,
  );

  // Footer accent line
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
