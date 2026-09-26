import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';

import type { Mood } from '@/game/progress';
import { makeStyles } from '@/providers/Preferences';
import { fonts, radius, spacing } from '@/theme';
import { tap } from './ui';

const NATIVE = Platform.OS !== 'web';

/** Palette per stage: body gradient, belly, accent (beak/feet). */
const LOOK = [
  { body: ['#FFF7E8', '#F2D7A0'], belly: '#FFFFFF', accent: '#F2A93B' },
  { body: ['#FFE680', '#FFC93C'], belly: '#FFF4C2', accent: '#FF9F1C' },
  { body: ['#FFE066', '#FFB703'], belly: '#FFF3B8', accent: '#FF8C00' },
  { body: ['#6FB1FF', '#2F6BEF'], belly: '#DDEBFF', accent: '#FF9F1C' },
  { body: ['#9B7BFF', '#FF5C8A'], belly: '#FFE3F0', accent: '#FFB703' },
] as const;

function Eyes({ mood, blink, y = 92, gap = 22, size = 1 }: { mood: Mood; blink: boolean; y?: number; gap?: number; size?: number }) {
  const ink = '#1A1F36';
  const eye = (cx: number, flip: 1 | -1) => {
    if (mood === 'happy') return <Path key={cx} d={`M${cx - 8 * size} ${y + 3} Q${cx} ${y - 8 * size} ${cx + 8 * size} ${y + 3}`} stroke={ink} strokeWidth={4.5 * size} strokeLinecap="round" fill="none" />;
    if (mood === 'sleepy' || blink) return <Path key={cx} d={`M${cx - 7 * size} ${y} L${cx + 7 * size} ${y}`} stroke={ink} strokeWidth={4.5 * size} strokeLinecap="round" />;
    return (
      <G key={cx}>
        <Circle cx={cx} cy={y} r={7.5 * size} fill={ink} />
        <Circle cx={cx + 2.5 * size} cy={y - 2.5 * size} r={2.6 * size} fill="#FFFFFF" />
        {mood === 'sad' && <Path d={`M${cx - 9 * flip * size} ${y - 11 * size} L${cx + 6 * flip * size} ${y - 16 * size}`} stroke={ink} strokeWidth={3.5 * size} strokeLinecap="round" />}
      </G>
    );
  };
  return (
    <G>
      {eye(100 - gap, 1)}
      {eye(100 + gap, -1)}
    </G>
  );
}

function Face({ mood, blink, accent, y = 92 }: { mood: Mood; blink: boolean; accent: string; y?: number }) {
  return (
    <G>
      <Eyes mood={mood} blink={blink} y={y} />
      <Path d={`M92 ${y + 14} L108 ${y + 14} L100 ${y + 25} Z`} fill={accent} stroke={accent} strokeWidth={3} strokeLinejoin="round" />
      {mood !== 'sad' && (
        <G opacity={0.55}>
          <Ellipse cx={66} cy={y + 18} rx={9} ry={5.5} fill="#FF7FA6" />
          <Ellipse cx={134} cy={y + 18} rx={9} ry={5.5} fill="#FF7FA6" />
        </G>
      )}
    </G>
  );
}

/** Nidito, the couple's bird. Renders the given evolution stage (0–4) with a mood-driven face. */
export function PetArt({ stage, mood, size = 160, crack = 0 }: { stage: number; mood: Mood; size?: number; crack?: number }) {
  const [blink, setBlink] = useState(false);
  // Gradient ids must be unique per instance, or several pets on screen would share one palette.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const bodyFill = `url(#body${uid})`;
  useEffect(() => {
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3200 + Math.random() * 1500);
    return () => clearInterval(id);
  }, []);

  const look = LOOK[Math.min(Math.max(stage, 0), 4)];
  const body = (
    <Defs>
      <LinearGradient id={`body${uid}`} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={look.body[0]} />
        <Stop offset="1" stopColor={look.body[1]} />
      </LinearGradient>
      <RadialGradient id={`gold${uid}`} cx="0.5" cy="0.4" r="0.6">
        <Stop offset="0" stopColor="#FFF3B0" />
        <Stop offset="1" stopColor="#FFB703" />
      </RadialGradient>
    </Defs>
  );

  let art;
  if (stage === 0) {
    // Egg: cracks appear as it gets close to hatching.
    art = (
      <G>
        <Ellipse cx={100} cy={112} rx={54} ry={68} fill={bodyFill} />
        <Ellipse cx={80} cy={95} rx={9} ry={12} fill="#E7C27D" opacity={0.6} />
        <Ellipse cx={122} cy={128} rx={11} ry={8} fill="#E7C27D" opacity={0.6} />
        <Ellipse cx={108} cy={80} rx={6} ry={5} fill="#E7C27D" opacity={0.6} />
        <Ellipse cx={82} cy={80} rx={10} ry={18} fill="#FFFFFF" opacity={0.45} />
        {crack > 0.35 && <Path d="M70 110 L82 102 L90 114 L101 104 L110 115 L121 106 L131 112" stroke="#9C7A3C" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
        {crack > 0.75 && <Path d="M101 104 L99 92 L106 86" stroke="#9C7A3C" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />}
      </G>
    );
  } else if (stage === 1) {
    // Hatchling peeking out of its shell.
    art = (
      <G>
        <Circle cx={100} cy={98} r={46} fill={bodyFill} />
        <Path d="M78 50 L88 40 L98 50 L108 38 L118 50 L124 46 Q122 62 100 62 Q80 62 78 50 Z" fill="#FFF7E8" stroke="#E7C27D" strokeWidth={2} />
        <Face mood={mood} blink={blink} accent={look.accent} y={98} />
        <Path d="M44 124 L58 110 L70 124 L84 108 L100 122 L116 108 L130 124 L142 110 L156 124 L152 168 Q100 186 48 168 Z" fill="#FFF7E8" stroke="#E7C27D" strokeWidth={2.5} />
      </G>
    );
  } else {
    const big = stage >= 3;
    art = (
      <G>
        {big && (
          <G>
            <Path d="M146 130 Q178 128 184 104 Q166 116 150 112 Z" fill={look.body[1]} />
            <Path d="M146 138 Q182 146 190 124 Q170 132 150 126 Z" fill={look.body[0]} />
          </G>
        )}
        <Ellipse cx={100} cy={big ? 112 : 116} rx={big ? 62 : 56} ry={big ? 64 : 56} fill={bodyFill} />
        <Ellipse cx={100} cy={big ? 132 : 132} rx={big ? 38 : 32} ry={big ? 34 : 28} fill={look.belly} opacity={0.9} />
        <Ellipse cx={big ? 42 : 48} cy={120} rx={14} ry={24} fill={look.body[1]} transform={`rotate(20 ${big ? 42 : 48} 120)`} />
        <Ellipse cx={big ? 158 : 152} cy={120} rx={14} ry={24} fill={look.body[1]} transform={`rotate(-20 ${big ? 158 : 152} 120)`} />
        {/* Crest / tuft */}
        {big ? (
          <G>
            <Path d="M96 52 Q88 28 100 20 Q104 36 104 52 Z" fill={look.body[1]} />
            <Path d="M104 52 Q112 30 126 30 Q116 42 110 56 Z" fill={look.body[0]} />
          </G>
        ) : (
          <Path d="M92 62 Q96 46 100 60 Q104 44 108 62" stroke={look.body[1]} strokeWidth={5} strokeLinecap="round" fill="none" />
        )}
        <Face mood={mood} blink={blink} accent={look.accent} y={big ? 92 : 100} />
        <Path d="M84 168 L84 178 M78 180 L90 180 M116 168 L116 178 M110 180 L122 180" stroke={look.accent} strokeWidth={5} strokeLinecap="round" />
        {stage === 4 && (
          <G>
            <Path d="M72 42 L80 18 L92 34 L100 12 L108 34 L120 18 L128 42 Z" fill={`url(#gold${uid})`} stroke="#E09B00" strokeWidth={2.5} strokeLinejoin="round" />
            <Circle cx={100} cy={34} r={4} fill="#FF5C8A" />
            <Path d="M30 60 L34 70 L44 74 L34 78 L30 88 L26 78 L16 74 L26 70 Z" fill="#FFD166" />
            <Path d="M172 44 L175 52 L183 55 L175 58 L172 66 L169 58 L161 55 L169 52 Z" fill="#FFD166" />
          </G>
        )}
      </G>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 200 200">
      {body}
      <Ellipse cx={100} cy={188} rx={stage === 0 ? 44 : 52} ry={7} fill="#000000" opacity={0.12} />
      {art}
      {mood === 'sleepy' && stage > 0 && (
        <G>
          <Path d="M150 48 L162 48 L150 60 L162 60" stroke="#8C94A3" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <Path d="M168 30 L176 30 L168 38 L176 38" stroke="#8C94A3" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </G>
      )}
    </Svg>
  );
}

/**
 * Animated pet: idles with a gentle bob (the egg wobbles), and on tap jumps, floats hearts
 * and says something.
 */
export function PetStage({
  stage,
  mood,
  size = 180,
  crack = 0,
  phrases,
  interactive = true,
}: {
  stage: number;
  mood: Mood;
  size?: number;
  crack?: number;
  phrases?: string[];
  interactive?: boolean;
}) {
  const s = useStyles();
  const [idle] = useState(() => new Animated.Value(0));
  const [jump] = useState(() => new Animated.Value(0));
  const [hearts] = useState(() => new Animated.Value(0));
  const [bubble, setBubble] = useState<string | null>(null);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(idle, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(idle, { toValue: 0, duration: 1300, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [idle]);

  const onTap = () => {
    if (!interactive) return;
    tap('success');
    jump.setValue(0);
    hearts.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(jump, { toValue: 1, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
        Animated.spring(jump, { toValue: 0, useNativeDriver: NATIVE, speed: 14, bounciness: 14 }),
      ]),
      Animated.timing(hearts, { toValue: 1, duration: 1100, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    ]).start();
    if (phrases?.length) {
      setBubble(phrases[Math.floor(Math.random() * phrases.length)]);
      setTimeout(() => setBubble(null), 2200);
    }
  };

  const idleTransform =
    stage === 0
      ? [{ rotate: idle.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] }) }]
      : [{ translateY: idle.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.035] }) }];
  const jumpY = jump.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.16] });
  const squash = jump.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  return (
    <Pressable onPress={onTap} disabled={!interactive} accessibilityRole={interactive ? 'button' : undefined} style={{ width: size, height: size, alignItems: 'center' }}>
      {bubble && (
        <View style={[s.bubble, { bottom: size * 0.92 }]}>
          <Text style={s.bubbleText}>{bubble}</Text>
        </View>
      )}
      <Animated.View
        pointerEvents="none"
        style={[
          s.hearts,
          {
            opacity: hearts.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ translateY: hearts.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.35] }) }],
          },
        ]}>
        <Text style={{ fontSize: size * 0.12 }}>💛</Text>
        <Text style={{ fontSize: size * 0.09, marginTop: size * 0.08 }}>💖</Text>
      </Animated.View>
      <Animated.View style={{ transform: [...idleTransform, { translateY: jumpY }, { scale: squash }] }}>
        <PetArt stage={stage} mood={mood} size={size} crack={crack} />
      </Animated.View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  bubble: {
    position: 'absolute',
    zIndex: 2,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    maxWidth: 240,
    ...elevation,
  },
  bubbleText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text, textAlign: 'center' },
  hearts: { position: 'absolute', top: '18%', flexDirection: 'row', gap: 26, zIndex: 1 },
}));
