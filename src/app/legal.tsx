import { useLocalSearchParams } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui';
import { LEGAL, type LegalDoc } from '@/data/legal';
import { makeStyles, useT } from '@/providers/Preferences';
import { spacing, type } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { goBack } from '@/utils/navigation';

/** Privacy policy or terms of use (`/legal?doc=privacy|terms`); reachable signed in or out. */
export default function LegalScreen() {
  const s = useStyles();
  const { t, language, locale } = useT();
  const { doc } = useLocalSearchParams<{ doc?: string }>();
  const text = LEGAL[language][(doc === 'terms' ? 'terms' : 'privacy') as LegalDoc];

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={text.title} onLeading={goBack} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.updated}>{t('legal.updated', { date: formatShortDate(`${text.updated}T12:00:00`, locale) })}</Text>
        {text.sections.map((section) => (
          <View key={section.heading} style={{ gap: spacing.xs }}>
            <Text style={s.heading}>{section.heading}</Text>
            <Text style={s.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.lg },
  updated: { ...type.small, color: colors.textSubtle },
  heading: { ...type.h3, color: colors.text },
  body: { ...type.body, color: colors.textMuted, lineHeight: 22 },
}));
