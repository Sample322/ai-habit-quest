import type { FrameTier } from '../../lib/types';

interface Props {
  tier: FrameTier;
  letter: string;
  size?: number;
}

/**
 * Monogram avatar with a frame whose ring + halo encode the user's earned
 * cosmetics tier. Visibility tuned so even bronze reads on a dark surface.
 *
 * Layered structure:
 *   • outer wrapper provides the halo (soft outer glow via box-shadow)
 *   • inner disc carries the tier ring + gradient fill + monogram
 */
export function AvatarFrame({ tier, letter, size = 40 }: Props) {
  const { ring, halo, bg, textShadow } = frameStyle(tier);
  return (
    <div
      className="relative shrink-0 rounded-pill grid place-items-center"
      style={{ width: size, height: size, boxShadow: halo }}
    >
      {tier === 'aurora' && (
        <span
          aria-hidden
          className="absolute -inset-1 rounded-pill animate-pulse-glow"
          style={{ background: 'radial-gradient(circle, rgba(213,123,255,0.45) 0%, transparent 65%)' }}
        />
      )}
      <div
        className={`relative w-full h-full rounded-pill grid place-items-center border-2 ${ring} font-semibold text-sm`}
        style={{ background: bg, textShadow }}
      >
        <span>{letter}</span>
      </div>
    </div>
  );
}

function frameStyle(tier: FrameTier): { ring: string; halo: string; bg: string; textShadow: string } {
  switch (tier) {
    case 'aurora':
      return {
        ring: 'border-rarSecret',
        halo: '0 0 22px -2px rgba(213,123,255,0.7), 0 0 0 1px rgba(213,123,255,0.4)',
        bg: 'linear-gradient(135deg, rgba(213,123,255,0.4), rgba(124,92,255,0.3))',
        textShadow: '0 0 8px rgba(213,123,255,0.6)',
      };
    case 'gold':
      return {
        ring: 'border-rarGold',
        halo: '0 0 16px -2px rgba(243,201,105,0.55), 0 0 0 1px rgba(243,201,105,0.3)',
        bg: 'linear-gradient(135deg, rgba(243,201,105,0.32), rgba(243,201,105,0.10))',
        textShadow: '0 0 6px rgba(243,201,105,0.5)',
      };
    case 'silver':
      return {
        ring: 'border-rarSilver',
        halo: '0 0 12px -2px rgba(201,209,220,0.45)',
        bg: 'linear-gradient(135deg, rgba(201,209,220,0.28), rgba(201,209,220,0.08))',
        textShadow: '0 0 4px rgba(201,209,220,0.45)',
      };
    case 'bronze':
      return {
        ring: 'border-rarBronze',
        halo: '0 0 10px -2px rgba(192,138,79,0.45)',
        bg: 'linear-gradient(135deg, rgba(192,138,79,0.30), rgba(192,138,79,0.08))',
        textShadow: '0 0 4px rgba(192,138,79,0.5)',
      };
    default:
      return {
        ring: 'border-hairlineStrong',
        halo: '0 0 0 0 transparent',
        bg: '#181b24',
        textShadow: 'none',
      };
  }
}
