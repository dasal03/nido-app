import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { ScrollView, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { PetArt } from '@/components/Pet';
import { Button, PressableScale, tap } from '@/components/ui';
import type { TranslationKey } from '@/i18n/es';
import { makeStyles, usePreferences, useTheme } from '@/providers/Preferences';
import { radius, spacing, type } from '@/theme';

const SLIDES: { icon: IconName | 'pet'; title: TranslationKey; body: TranslationKey }[] = [
  { icon: 'users', title: 'welcome.title1', body: 'welcome.body1' },
  { icon: 'handshake', title: 'welcome.title2', body: 'welcome.body2' },
  { icon: 'pet', title: 'welcome.title3', body: 'welcome.body3' },
];

/** Three intro slides shown the first time the app opens (before signing in). */
export default function WelcomeScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, setPref } = usePreferences();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  // Marking it done makes the router move on to the sign-in screen.
  const finish = () => {
    tap('success');
    setPref('onboarded', true);
  };
  const next = () => {
    if (last) return finish();
    tap('selection');
    ref.current?.scrollTo({ x: width * (page + 1), animated: true });
    setPage(page + 1);
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(e.nativeEvent.contentOffset.x / width));

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.top}>
        {!last && (
          <PressableScale onPress={finish} haptic={false} style={s.skip} accessibilityRole="button">
            <Text style={s.skipText}>{t('welcome.skip')}</Text>
          </PressableScale>
        )}
      </View>
      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        scrollEventThrottle={16}>
        {SLIDES.map((slide) => (
          <View key={slide.title} style={[s.slide, { width }]}>
            <LinearGradient colors={colors.coupleGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.art}>
              {slide.icon === 'pet' ? (
                <PetArt stage={2} mood="happy" size={170} />
              ) : (
                <View style={s.iconCircle}>
                  <Icon name={slide.icon} size={64} color={colors.accent} strokeWidth={1.8} />
                </View>
              )}
            </LinearGradient>
            <Text style={s.title}>{t(slide.title)}</Text>
            <Text style={s.body}>{t(slide.body)}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={s.bottom}>
        <View style={s.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[s.dot, i === page && s.dotActive]} />
          ))}
        </View>
        <Button label={t(last ? 'welcome.start' : 'welcome.next')} iconRight="chevron" onPress={next} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { height: 48, alignItems: 'flex-end', justifyContent: 'center', paddingHorizontal: spacing.md },
  skip: { paddingHorizontal: spacing.sm, paddingVertical: 6 },
  skipText: { ...type.bodyStrong, color: colors.textMuted },
  slide: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.md },
  art: { width: 260, height: 260, borderRadius: radius.lg * 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.display, fontSize: 30, lineHeight: 36, color: colors.text, textAlign: 'center' },
  body: { ...type.body, fontSize: 16, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  bottom: { padding: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  dotActive: { width: 26, backgroundColor: colors.accent },
}));
