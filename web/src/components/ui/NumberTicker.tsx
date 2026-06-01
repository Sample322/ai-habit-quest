import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  duration?: number;
  className?: string;
}

/**
 * Animated number that interpolates from previous value to new one over `duration` ms.
 * Used for XP, streak, level — anything that should feel earned, not just appear.
 */
export function NumberTicker({ value, duration = 700, className = '' }: Props) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();

    const step = (t: number): void => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      const next = Math.round(from + (to - from) * eased);
      setDisplay(next);
      if (p < 1) raf.current = requestAnimationFrame(step);
      else prev.current = to;
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <span className={`tabular ${className}`}>{display.toLocaleString('ru-RU')}</span>;
}
