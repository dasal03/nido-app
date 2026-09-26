import { LinearGradient } from 'expo-linear-gradient';

import { Icon } from './Icon';

/** Lightens a hex color toward white by `amount` (0–1). */
function tint(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(mix);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

/** Rounded-square gradient badge with a white glyph — the visual identity of a goal. */
export function GoalIcon({ icon, color, size = 44 }: { icon: string; color: string; size?: number }) {
  return (
    <LinearGradient
      colors={[tint(color, 0.3), color]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size * 0.32, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={size * 0.48} color="#FFFFFF" strokeWidth={2.2} />
    </LinearGradient>
  );
}
