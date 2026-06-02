import type { FrameTier } from '../../lib/types';

interface Props {
  tier: FrameTier;
  letter: string;
  size?: number;
}

/**
 * Monogram avatar with a frame whose ring + shadow encode the user's earned
 * cosmetics tier. `aurora` is reserved for secret-achievement unlocks.
 */
export function AvatarFrame({ tier, letter, size = 40 }: Props) {
  const { ring, glow, bg } = frameStyle(tier);
  return (
    <div
      className={`shrink-0 rounded-pill grid place-items-center font-semibold text-sm border-[1.5px] ${ring} ${glow}`}
      style={{ width: size, height: size, background: bg }}
    >
      {tier === 'aurora' && (
        <span
          className="absolute inset-0 rounded-pill blur-md -z-10"
          style={{ background: 'radial-gradient(circle, #d57bff 0%, transparent 70%)' }}
          aria-hidden
        />
      )}
      <span className="relative">{letter}</span>
    </div>
  );
}

function frameStyle(tier: FrameTier): { ring: string; glow: string; bg: string } {
  switch (tier) {
    case 'aurora':
      return {
        ring: 'border-rarSecret',
        glow: 'shadow-[0_0_18px_-2px_rgba(213,123,255,0.7)]',
        bg: 'linear-gradient(135deg, rgba(213,123,255,0.18), rgba(124,92,255,0.18))',
      };
    case 'gold':
      return {
        ring: 'border-rarGold',
        glow: 'shadow-[0_0_14px_-2px_rgba(243,201,105,0.55)]',
        bg: 'linear-gradient(135deg, rgba(243,201,105,0.18), rgba(243,201,105,0.04))',
      };
    case 'silver':
      return {
        ring: 'border-rarSilver/70',
        glow: '',
        bg: 'linear-gradient(135deg, rgba(201,209,220,0.14), rgba(201,209,220,0.02))',
      };
    case 'bronze':
      return {
        ring: 'border-rarBronze/60',
        glow: '',
        bg: 'linear-gradient(135deg, rgba(192,138,79,0.14), rgba(192,138,79,0.02))',
      };
    default:
      return { ring: 'border-hairlineStrong', glow: '', bg: '#181b24' };
  }
}
