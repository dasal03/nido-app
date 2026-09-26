import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalIcon } from '@/components/GoalIcon';
import { GOAL_ICON_NAMES, Icon, type GoalIconName } from '@/components/Icon';
import { Button, Chip, ErrorBanner, PressableScale, ScreenHeader, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { GOAL_COLORS, fonts, radius, spacing, type } from '@/theme';
import { currencySymbol, formatAmountInput } from '@/utils/format';
import { goBack } from '@/utils/navigation';
import { useAction } from '@/utils/useAction';

const TERMS = [0, 3, 6, 12, 24, 60];

export default function NewGoalScreen() {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useT();
  const { goals, currency } = useSavings();
  const money = useMoney();
  const [icon, setIcon] = useState<GoalIconName>('plane');
  const [color, setColor] = useState(GOAL_COLORS[goals.length % GOAL_COLORS.length]);
  const [name, setName] = useState('');
  /** Whole-unit target amount as raw digits, e.g. "250000". */
  const [digits, setDigits] = useState('');
  const [months, setMonths] = useState(12);
  const create = useAction(backend.addGoal);

  const target = Number(digits || 0);
  const valid = name.trim().length > 0 && target > 0;
  const perMonthEach = months > 0 && target > 0 ? target / months / 2 : 0;

  const termLabel = (m: number) => {
    if (m === 0) return t('newGoal.noTerm');
    if (m === 12) return t('newGoal.oneYear');
    if (m % 12 === 0) return t('newGoal.years', { n: m / 12 });
    return t('newGoal.months', { n: m });
  };

  const submit = async () => {
    let deadline: string | null = null;
    if (months > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + months);
      deadline = d.toISOString();
    }
    if (await create.run({ name: name.trim(), icon, color, target, deadline })) {
      tap('success');
      goBack();
    }
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader title={t('newGoal.title')} leading="close" onLeading={goBack} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.preview}>
            <GoalIcon icon={icon} color={color} size={88} />
            <Text style={s.previewName} numberOfLines={1}>
              {name.trim() || t('newGoal.placeholderName')}
            </Text>
            <Text style={s.previewAmount}>{target > 0 ? money(target, { compact: true }) : '—'}</Text>
          </View>

          <Text style={s.label}>{t('newGoal.category')}</Text>
          <View style={s.iconGrid}>
            {GOAL_ICON_NAMES.map((g) => {
              const selected = icon === g;
              return (
                <PressableScale
                  key={g}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t(`icon.${g}`)}
                  haptic={false}
                  scaleTo={0.92}
                  containerStyle={s.iconCell}
                  onPress={() => {
                    tap('selection');
                    setIcon(g);
                  }}
                  style={s.iconInner}>
                  <View style={[s.iconBubble, selected && { backgroundColor: color, borderColor: color }]}>
                    <Icon name={g} size={22} color={selected ? '#FFFFFF' : colors.textMuted} strokeWidth={selected ? 2.3 : 1.9} />
                  </View>
                  <Text style={[s.iconLabel, selected && s.iconLabelActive]} numberOfLines={1}>
                    {t(`icon.${g}`)}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          <Text style={s.label}>{t('newGoal.color')}</Text>
          <View style={s.colors}>
            {GOAL_COLORS.map((c) => (
              <PressableScale
                key={c}
                accessibilityLabel={c}
                haptic={false}
                scaleTo={0.85}
                onPress={() => {
                  tap('selection');
                  setColor(c);
                }}
                style={[s.colorRing, color === c && { borderColor: c }]}>
                <View style={[s.colorDot, { backgroundColor: c }]} />
              </PressableScale>
            ))}
          </View>

          <Text style={s.label}>{t('newGoal.name')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('newGoal.namePlaceholder')}
            placeholderTextColor={colors.textSubtle}
            keyboardAppearance={dark ? 'dark' : 'light'}
            style={s.input}
            maxLength={32}
          />

          <Text style={s.label}>{t('newGoal.amount')}</Text>
          <View style={s.amountBox}>
            <Text style={s.amountSymbol}>{currencySymbol(currency)}</Text>
            <TextInput
              value={digits ? formatAmountInput(digits, currency) : ''}
              onChangeText={(v) => setDigits(v.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10))}
              placeholder="0"
              placeholderTextColor={colors.textSubtle}
              keyboardType="number-pad"
              keyboardAppearance={dark ? 'dark' : 'light'}
              style={s.amountField}
            />
            <View style={s.amountCode}>
              <Text style={s.amountCodeText}>{currency}</Text>
            </View>
          </View>

          <Text style={s.label}>{t('newGoal.term')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.terms} style={s.termsWrap}>
            {TERMS.map((m) => (
              <Chip key={m} label={termLabel(m)} selected={months === m} onPress={() => setMonths(m)} />
            ))}
          </ScrollView>

          {perMonthEach > 0 && (
            <View style={s.tip}>
              <Icon name="idea" size={18} color={colors.accent} />
              <Text style={s.tipText}>{t('newGoal.tip', { amount: money(perMonthEach) })}</Text>
            </View>
          )}
          <View style={{ marginTop: spacing.md }}>
            <ErrorBanner message={create.error} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.footer}>
        <Button label={t('newGoal.create')} icon="check" onPress={submit} loading={create.loading} disabled={!valid} />
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.surface },
  body: { padding: spacing.md, paddingBottom: spacing.xl },
  preview: { alignItems: 'center', marginTop: spacing.sm, gap: 4 },
  previewName: { ...type.h2, color: colors.text, marginTop: spacing.sm + 4 },
  previewAmount: { ...type.body, color: colors.textMuted },
  label: { ...type.h3, color: colors.text, marginTop: spacing.lg + 4, marginBottom: spacing.sm + 4 },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  iconCell: { width: '25%' },
  iconInner: { alignItems: 'center', gap: 6 },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconLabel: { ...type.small, fontSize: 12, color: colors.textMuted },
  iconLabelActive: { fontFamily: fonts.bold, color: colors.text },
  colors: { flexDirection: 'row', gap: spacing.sm },
  colorRing: { width: 42, height: 42, borderRadius: 21, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  input: {
    height: 54,
    borderRadius: radius.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    ...type.body,
    color: colors.text,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 68,
    borderRadius: radius.sm + 4,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  amountSymbol: { fontFamily: fonts.bold, fontSize: 22, color: colors.textMuted },
  amountField: { flex: 1, minWidth: 0, height: '100%', fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.6, outlineWidth: 0 },
  amountCode: { backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  amountCodeText: { ...type.tiny, color: colors.textMuted },
  termsWrap: { marginHorizontal: -spacing.md },
  terms: { gap: spacing.sm, paddingHorizontal: spacing.md },
  tip: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm + 4,
    padding: spacing.md - 2,
    marginTop: spacing.lg,
  },
  tipText: { ...type.small, color: colors.text, lineHeight: 19, flex: 1 },
  footer: { padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
}));
