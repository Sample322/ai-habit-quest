interface Props {
  pct: number;       // 0-100
  size?: number;     // px
  stroke?: number;   // px
  children?: React.ReactNode;
  trackOpacity?: number;
}

/**
 * Circular progress ring with gradient stroke. Used as the day-progress hero
 * indicator on Today. Defaults are tuned for a 144px hero ring.
 */
export function ProgressRing({ pct, size = 144, stroke = 10, children, trackOpacity = 0.08 }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.max(0, Math.min(100, pct)) / 100);
  const id = `pr-${size}-${stroke}`;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c5cff" />
            <stop offset="60%" stopColor="#9b7dff" />
            <stop offset="100%" stopColor="#19d57a" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white" strokeOpacity={trackOpacity} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}
