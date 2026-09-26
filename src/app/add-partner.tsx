import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LinkForm } from '@/components/LinkForm';
import { ScreenHeader } from '@/components/ui';
import { makeStyles, useT } from '@/providers/Preferences';
import { spacing, type } from '@/theme';
import { goBack } from '@/utils/navigation';

/** Links an additional partner, creating a new nest that becomes the active one. */
export default function AddPartnerScreen() {
  const s = useStyles();
  const { t } = useT();
  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('addPartner.title')} leading="close" onLeading={goBack} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <Text style={s.intro}>{t('nests.addHint')}</Text>
          <LinkForm onLinked={goBack} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg },
  intro: { ...type.body, color: colors.textMuted },
}));
