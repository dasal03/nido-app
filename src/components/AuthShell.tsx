import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { makeStyles, usePreferences, useTheme } from '@/providers/Preferences';
import { fonts, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

/** Minimal layout shared by the auth and linking screens: wordmark, language pill, headline and content. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { language, setLanguage } = usePreferences();
  const s = useStyles();

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.topBar}>
        <View style={s.brand}>
          <Image source={require('../../assets/logo.png')} style={s.logo} accessibilityIgnoresInvertColors />
          <Text style={s.wordmark}>Nido</Text>
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={language === 'es' ? 'English' : 'Español'}
          haptic={false}
          scaleTo={0.92}
          onPress={() => {
            tap('selection');
            setLanguage(language === 'es' ? 'en' : 'es');
          }}
          style={s.langPill}>
          <Icon name="language" size={15} color={colors.text} />
          <Text style={s.langText}>{language.toUpperCase()}</Text>
        </PressableScale>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + spacing.lg }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <Text style={s.title}>{title}</Text>
          {subtitle && <Text style={s.subtitle}>{subtitle}</Text>}
          <View style={s.body}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  logo: { width: 38, height: 38, borderRadius: 11 },
  wordmark: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: -0.6 },
  langPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    ...elevation,
  },
  langText: { ...type.smallStrong, color: colors.text },
  content: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
  title: { fontFamily: fonts.extrabold, fontSize: 36, lineHeight: 43, letterSpacing: -0.6, color: colors.text },
  subtitle: { ...type.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  body: { gap: spacing.md, marginTop: spacing.xl },
}));
