import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

const COLORS = ['#FF5C8A', '#2F7BF5', '#12B886', '#FFB703', '#7B61FF', '#00B3D6'];

interface Piece {
  x: number;
  drift: number;
  spin: number;
  delay: number;
  color: string;
  w: number;
  h: number;
}

/** One-shot confetti burst falling over the whole screen. */
export function Confetti({ count = 44 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const [progress] = useState(() => new Animated.Value(0));
  const [pieces] = useState<Piece[]>(() =>
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 120,
      spin: (Math.random() - 0.5) * 1440,
      delay: Math.random() * 0.25,
      color: COLORS[i % COLORS.length],
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 8,
    })),
  );

  useEffect(() => {
    Animated.timing(progress, { toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const t = progress.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -30,
              width: p.w,
              height: p.h,
              borderRadius: 2,
              backgroundColor: p.color,
              opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height + 60] }) },
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
