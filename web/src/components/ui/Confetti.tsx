import { useEffect, useRef } from 'react';

interface Props {
  /** When true, run one burst then auto-hide. Resets on re-trigger via key. */
  active: boolean;
  duration?: number; // ms before pieces fade out
  pieces?: number;
}

const COLORS = ['#7c5cff', '#9b7dff', '#19d57a', '#f3c969', '#ff5e6c', '#5fe3a6'];

/**
 * Lightweight DIY confetti — no canvas-confetti dependency. Renders ~80 emoji
 * pieces with randomized initial velocity + gravity, fades after `duration`.
 * Triggered on day-completion celebration (all daily tasks ticked).
 */
export function Confetti({ active, duration = 2400, pieces = 80 }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';

    const fragments: HTMLSpanElement[] = [];
    for (let i = 0; i < pieces; i++) {
      const s = document.createElement('span');
      const color = COLORS[i % COLORS.length];
      const dx = (Math.random() - 0.5) * 600;
      const dy = -Math.random() * 240 - 120;
      const rot = (Math.random() - 0.5) * 720;
      const size = 6 + Math.random() * 6;
      const delay = Math.random() * 120;

      s.style.cssText = `
        position: absolute;
        left: 50%;
        top: 50%;
        width: ${size}px;
        height: ${size * 0.4}px;
        background: ${color};
        border-radius: 1px;
        transform: translate(-50%, -50%);
        opacity: 1;
        pointer-events: none;
        will-change: transform, opacity;
        animation: ahq-confetti ${duration}ms cubic-bezier(0.12, 0.7, 0.32, 1) ${delay}ms both;
        --dx: ${dx}px;
        --dy: ${dy}px;
        --rot: ${rot}deg;
      `;
      host.appendChild(s);
      fragments.push(s);
    }

    const cleanup = setTimeout(() => {
      for (const f of fragments) f.remove();
    }, duration + 200);
    return () => {
      clearTimeout(cleanup);
      for (const f of fragments) f.remove();
    };
  }, [active, duration, pieces]);

  if (!active) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90] overflow-hidden"
    />
  );
}
