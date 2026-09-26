import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalIcon } from '@/components/GoalIcon';
import { Button, Chip, ErrorBanner, ScreenHeader, Segmented, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { ensureNotificationPermission } from '@/services/notifications';
import { useSavings } from '@/store/SavingsContext';
import type { Frequency } from '@/store/types';
import { fonts, radius, spacing, type } from '@/theme';
import { currencySymbol, formatAmountInput } from '@/utils/format';
import { goBack } from '@/utils/navigation';
import { useAction } from '@/utils/useAction';

type Start = 'today' | 'week' | 'month';

function startDate(start: Start) {
  const d = new Date();
  if (start === 'week') d.setDate(d.getDate() + 7);
  if (start === 'month') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export default function NewRecurringScreen() {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useT();
  const { goals, currency } = useSavings();
  const [digits, setDigits] = useState('');
  const [goalId, setGoalId] = useState<string | null>(goals[0]?.id ?? null);
  const [frequency, setFrequency] = useState<Frequency>('biweekly');
  const [start, setStart] = useState<Start>('today');
  const create = useAction(backend.addRecurring);
  const amount = Number(digits || 0);

  const submit = async () => {
    if (await create.run({ amount, goalId, frequency, startDate: startDate(start) })) {
      tap('success');
      ensureNotificationPermission().catch(() => {});
      goBack();
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('recurring.new')} leading="close" onLeading={goBack} />
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>{t('recurring.amount')}</Text>
        <View style={s.amountBox}>
          <Text style={s.symbol}>{currencySymbol(currency)}</Text>
          <TextInput
            value={digits ? formatAmountInput(digits, currency) : ''}
            onChangeText={(v) => setDigits(v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9))}
            placeholder="0"
            placeholderTextColor={colors.textSubtle}
            keyboardType="number-pad"
            keyboardAppearance={dark ? 'dark' : 'light'}
            style={s.amountField}
            autoFocus
          />
        </View>

        <Text style={s.label}>{t('recurring.frequency')}</Text>
        <Segmented<Frequency>
          value={frequency}
          onChange={setFrequency}
          options={[
            { value: 'weekly', label: t('recurring.weekly') },
            { value: 'biweekly', label: t('recurring.biweekly') },
            { value: 'monthly', label: t('recurring.monthly') },
          ]}
        />

        <Text style={s.label}>{t('recurring.destination')}</Text>
        <View style={s.chips}>
          <Chip label={t('common.commonFund')} selected={goalId === null} onPress={() => setGoalId(null)} leading={<GoalIcon icon="wallet" color="#5B6475" size={22} />} />
          {goals.map((g) => (
            <Chip key={g.id} label={g.name} selected={goalId === g.id} onPress={() => setGoalId(g.id)} leading={<GoalIcon icon={g.icon} color={g.color} size={22} />} />
          ))}
        </View>

        <Text style={s.label}>{t('recurring.start')}</Text>
        <View style={s.chips}>
          <Chip label={t('recurring.startToday')} selected={start === 'today'} onPress={() => setStart('today')} />
          <Chip label={t('recurring.startWeek')} selected={start === 'week'} onPress={() => setStart('week')} />
          <Chip label={t('recurring.startMonth')} selected={start === 'month'} onPress={() => setStart('month')} />
        </View>
        <ErrorBanner message={create.error} />
      </ScrollView>
      <View style={s.footer}>
        <Button label={t('recurring.create')} icon="repeat" onPress={submit} loading={create.loading} disabled={amount <= 0} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
  label: { ...type.h3, color: colors.text, marginTop: spacing.md, marginBottom: 4 },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 72,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  symbol: { fontFamily: fonts.bold, fontSize: 24, color: colors.textMuted },
  amountField: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.extrabold, fontSize: 32, color: colors.text, outlineWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
}));
