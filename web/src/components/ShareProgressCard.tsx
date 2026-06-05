import { useEffect, useRef, useState } from 'react';
import { X, Download, Sparkles } from 'lucide-react';

import { api } from '../lib/api';
import { canShareToStory, haptic, notify, shareToStory } from '../lib/telegram';
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
  const [busy, setBusy] = useState<'story' | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const storySupported = canShareToStory();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawCard(canvas, { lang, user, rankName });
    // JPEG at quality 0.9 — Stories don't need transparency, and a JPEG of
    // this card is ~10× smaller than a PNG of the same gradients, which
    // keeps the upload safely below the backend's 1.8MB cap.
    setDataUrl(canvas.toDataURL('image/jpeg', 0.9));
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
    a.download = `ahq-progress-${Date.now()}.jpg`;
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

  // Chat-share was removed: Telegram's t.me/share/url flow attaches a URL
  // message, not the rendered image, and the WebView blocks navigator.share
  // with files. If a future Telegram WebApp API lets a Mini App attach a
  // file directly to a chat, bring this back.

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
          <canvas ref={canvasRef} width={1080} height={1920} className="w-full h-auto block" />
        </div>

        {/* Two-button row: Download + Story (chat removed — TG WebApp can't
            attach images directly to chats yet) */}
        <div className="grid grid-cols-2 gap-2">
          <ActionBtn
            onClick={download}
            disabled={!dataUrl}
            icon={<Download size={16} />}
            label={i.share.download}
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
  const W = canvas.width;   // 1080
  const H = canvas.height;  // 1920 (9:16 → fits Telegram Stories without zoom)

  // Onyx gradient base
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#11131a');
  bg.addColorStop(0.5, '#0c0d12');
  bg.addColorStop(1, '#06070a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Violet bloom — top
  const g1 = ctx.createRadialGradient(W * 0.5, H * 0.12, 0, W * 0.5, H * 0.12, W * 0.9);
  g1.addColorStop(0, 'rgba(124,92,255,0.55)');
  g1.addColorStop(1, 'rgba(124,92,255,0)');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  // Emerald bloom — bottom-right
  const g2 = ctx.createRadialGradient(W * 0.85, H * 0.85, 0, W * 0.85, H * 0.85, W * 0.9);
  g2.addColorStop(0, 'rgba(25,213,122,0.30)');
  g2.addColorStop(1, 'rgba(25,213,122,0)');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);

  // Faint grid texture for depth
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 64) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Eyebrow
  ctx.fillStyle = '#9b7dff';
  ctx.font = '700 38px Manrope, sans-serif';
  ctx.fillText('AI HABIT QUEST', W / 2, 240);

  // Username
  ctx.fillStyle = '#f5f7fb';
  ctx.font = '600 56px Manrope, sans-serif';
  ctx.fillText(user.firstName || user.username || '·', W / 2, 360);

  // Rank — shimmer
  const rankGrad = ctx.createLinearGradient(0, 0, W, 0);
  rankGrad.addColorStop(0, '#f5f7fb');
  rankGrad.addColorStop(0.5, '#c4a6ff');
  rankGrad.addColorStop(1, '#f5f7fb');
  ctx.fillStyle = rankGrad;
  ctx.font = '800 152px Manrope, sans-serif';
  ctx.fillText(rankName, W / 2, 600);

  // Level chip
  drawChip(ctx, W / 2, 740, `${lang === 'en' ? 'Level' : 'Уровень'} ${user.level}`);

  // HUD stats — three big columns centred vertically. Glyphs are drawn as
  // vector shapes so the card looks consistent across iOS/Android emoji
  // fonts (and matches the in-app lucide icon style).
  const yStat = H / 2 + 180;
  drawStat(ctx, W * 0.18, yStat, 'flame', String(user.streak.current), lang === 'en' ? 'STREAK' : 'СЕРИЯ');
  drawStat(ctx, W * 0.50, yStat, 'zap', String(user.xpTotal), 'XP');
  drawStat(ctx, W * 0.82, yStat, 'trophy', String(user.streak.best), lang === 'en' ? 'BEST' : 'РЕКОРД');

  // Bottom CTA
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '500 32px Manrope, sans-serif';
  ctx.fillText(
    lang === 'en' ? 'Build habits with AI' : 'Привычки с AI',
    W / 2,
    H - 220,
  );
  ctx.fillStyle = '#9b7dff';
  ctx.font = '700 34px Manrope, sans-serif';
  ctx.fillText('@AI_Habit_Tracking_bot', W / 2, H - 170);

  // Accent divider
  ctx.strokeStyle = '#7c5cff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(W * 0.35, H - 110);
  ctx.lineTo(W * 0.65, H - 110);
  ctx.stroke();
}

function drawChip(ctx: CanvasRenderingContext2D, cx: number, cy: number, text: string): void {
  ctx.font = '700 36px Manrope, sans-serif';
  const m = ctx.measureText(text);
  const padX = 32;
  const w = m.width + padX * 2;
  const h = 64;
  const x = cx - w / 2;
  const y = cy - h / 2;
  ctx.fillStyle = 'rgba(124,92,255,0.18)';
  ctx.strokeStyle = 'rgba(124,92,255,0.5)';
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, w, h, 999);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c4a6ff';
  ctx.fillText(text, cx, cy);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawStat(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  icon: 'flame' | 'zap' | 'trophy',
  value: string,
  label: string,
): void {
  // Vector glyphs replacing emoji — keeps the card visually consistent
  // across iOS/Android emoji fonts.
  ctx.save();
  ctx.translate(cx, cy - 80);
  ctx.strokeStyle = '#c4a6ff';
  ctx.fillStyle = '#c4a6ff';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (icon === 'flame') drawFlame(ctx);
  else if (icon === 'zap') drawZap(ctx);
  else drawTrophy(ctx);
  ctx.restore();

  ctx.fillStyle = '#f5f7fb';
  ctx.font = '800 96px Manrope, sans-serif';
  ctx.fillText(value, cx, cy);

  ctx.fillStyle = '#7c8290';
  ctx.font = '700 24px Manrope, sans-serif';
  ctx.fillText(label, cx, cy + 70);
}

// Inline approximations of lucide-react Flame / Zap / Trophy SVGs scaled
// to ~56px square, rendered around (0, 0).
function drawFlame(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(0, -28);
  ctx.bezierCurveTo(14, -10, 22, 0, 22, 12);
  ctx.bezierCurveTo(22, 24, 12, 32, 0, 32);
  ctx.bezierCurveTo(-12, 32, -22, 24, -22, 12);
  ctx.bezierCurveTo(-22, 0, -8, -8, 0, -28);
  ctx.closePath();
  ctx.stroke();
}

function drawZap(ctx: CanvasRenderingContext2D): void {
  ctx.beginPath();
  ctx.moveTo(6, -28);
  ctx.lineTo(-16, 4);
  ctx.lineTo(-2, 4);
  ctx.lineTo(-6, 28);
  ctx.lineTo(16, -4);
  ctx.lineTo(2, -4);
  ctx.closePath();
  ctx.stroke();
}

function drawTrophy(ctx: CanvasRenderingContext2D): void {
  // cup
  ctx.beginPath();
  ctx.moveTo(-16, -22);
  ctx.lineTo(16, -22);
  ctx.lineTo(14, 6);
  ctx.bezierCurveTo(14, 14, 8, 18, 0, 18);
  ctx.bezierCurveTo(-8, 18, -14, 14, -14, 6);
  ctx.closePath();
  ctx.stroke();
  // handles
  ctx.beginPath();
  ctx.moveTo(-16, -18);
  ctx.bezierCurveTo(-28, -16, -28, 4, -16, 6);
  ctx.moveTo(16, -18);
  ctx.bezierCurveTo(28, -16, 28, 4, 16, 6);
  ctx.stroke();
  // base
  ctx.beginPath();
  ctx.moveTo(-2, 18);
  ctx.lineTo(-2, 26);
  ctx.lineTo(-10, 30);
  ctx.lineTo(10, 30);
  ctx.lineTo(2, 26);
  ctx.lineTo(2, 18);
  ctx.stroke();
}
