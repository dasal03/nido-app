import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { Card, PressableScale, ScreenHeader, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { CURRENCIES, formatMoney } from '@/utils/format';
import { goBack } from '@/utils/navigation';

export default function CurrencyScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { currency } = useSavings();

  const select = async (code: string) => {
    tap('success');
    await backend.setCurrency(code);
    goBack();
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('currency.title')} leading="close" onLeading={goBack} />
      <ScrollView contentContainerStyle={s.content}>
        <Text style={s.intro}>{t('currency.intro')}</Text>
        <Card style={{ paddingVertical: spacing.xs }}>
          {CURRENCIES.map((c, i) => {
            const selected = c.code === currency;
            return (
              <PressableScale
                key={c.code}
                onPress={() => select(c.code)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                haptic={false}
                scaleTo={0.985}
                style={[s.row, i > 0 && s.divider]}>
                <View style={s.flag}>
                  <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name}>{t(`currency.${c.code}`)}</Text>
                  <Text style={s.sample}>
                    {c.code} · {formatMoney(1234.5, c.code)}
                  </Text>
                </View>
                {selected && (
                  <View style={s.check}>
                    <Icon name="check" size={14} color={colors.onPrimary} strokeWidth={3} />
                  </View>
                )}
              </PressableScale>
            );
          })}
        </Card>
        <View style={s.note}>
          <Icon name="idea" size={16} color={colors.textMuted} />
          <Text style={s.noteText}>{t('currency.note')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  intro: { ...type.body, color: colors.textMuted, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4, paddingVertical: spacing.sm + 4 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  flag: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  name: { ...type.bodyStrong, color: colors.text },
  sample: { ...type.small, color: colors.textMuted, marginTop: 2 },
  check: { width: 24, height: 24, borderRadius: radius.pill, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: 4 },
  noteText: { ...type.small, color: colors.textSubtle, lineHeight: 18, flex: 1 },
}));
