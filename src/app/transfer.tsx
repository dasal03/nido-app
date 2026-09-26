import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Confetti } from '@/components/Confetti';
import { GoalIcon } from '@/components/GoalIcon';
import { Icon } from '@/components/Icon';
import { Keypad, applyKey } from '@/components/Keypad';
import { Button, Chip, ErrorBanner, ScreenHeader, Segmented, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { firstName, joinNames, useMoney, useSavings } from '@/store/SavingsContext';
import type { TransactionType } from '@/store/types';
import { fonts, radius, spacing, type } from '@/theme';
import { currencySymbol, formatAmountInput, hasCents } from '@/utils/format';
import { goBack } from '@/utils/navigation';
import { amountIssue, amountLimits } from '@/utils/limits';
import { useAction } from '@/utils/useAction';

export default function TransferScreen() {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useT();
  const params = useLocalSearchParams<{ type?: string; goalId?: string }>();
  const { goals, currency, savedFor, couple, others } = useSavings();
  const money = useMoney();

  const [kind, setKind] = useState<TransactionType>(params.type === 'withdraw' ? 'withdraw' : 'deposit');
  const [goalId, setGoalId] = useState<string | null>(params.goalId && goals.some((g) => g.id === params.goalId) ? params.goalId : null);
  const [raw, setRaw] = useState('0');
  const [note, setNote] = useState('');
  const [done, setDone] = useState<'done' | 'requested' | null>(null);
  const amount = Number(raw);
  const save = useAction(async () => {
    if (kind === 'deposit') return backend.addTransaction({ amount, goalId, note: note.trim() });
    await backend.requestWithdraw({ amount, goalId, note: note.trim() });
  });

  const available = savedFor(goalId);
  const overdraft = kind === 'withdraw' && amount > available;
  const limits = amountLimits(currency);
  // A withdrawal may take everything that's left even if it's below the minimum.
  const issue = amount > 0 ? amountIssue(amount, currency, kind === 'withdraw' ? available : undefined) : null;
  const invalid = overdraft || !!issue;
  const canSubmit = amount > 0 && !invalid;
  const goal = goals.find((g) => g.id === goalId);
  const destination = goal ? goal.name : t('common.commonFund');
  const isDeposit = kind === 'deposit';
  const decimalSeparator = formatAmountInput('0.5', currency).charAt(1);

  const submit = async () => {
    if (await save.run()) {
      tap('success');
      // Withdrawals wait for the others' approval (sample partners approve right away).
      const latest = backend.getSnapshot().couples[couple.id]?.requests[0];
      setDone(!isDeposit && latest?.status === 'pending' ? 'requested' : 'done');
    }
  };

  if (done === 'requested') {
    return (
      <Success
        title={t('transfer.requestSent')}
        amount={money(amount)}
        body={t('transfer.requestBody', {
          dest: destination,
          names: joinNames(
            others.map((o) => firstName(o.name)),
            t('common.and'),
          ),
        })}
        icon="hourglass"
        onDone={goBack}
        doneLabel={t('common.done')}
      />
    );
  }

  if (done) {
    const remaining = goal ? goal.target - savedFor(goal.id) : 0;
    return (
      <Success
        title={t(isDeposit ? 'transfer.successDeposit' : 'transfer.successWithdraw')}
        amount={money(amount)}
        body={t(isDeposit ? 'transfer.youDepositedTo' : 'transfer.youWithdrewFrom', { dest: destination })}
        hint={
          goal && isDeposit
            ? remaining <= 0
              ? t('transfer.goalDone')
              : t('transfer.goalRemaining', { amount: money(remaining) })
            : undefined
        }
        celebrate={!!goal && isDeposit && remaining <= 0}
        onDone={goBack}
        doneLabel={t('common.done')}
      />
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <ScreenHeader leading="close" onLeading={goBack} />
      <View style={s.segmentWrap}>
        <Segmented<TransactionType>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'deposit', label: t('transfer.deposit'), icon: 'deposit' },
            { value: 'withdraw', label: t('transfer.withdraw'), icon: 'withdraw' },
          ]}
        />
      </View>

      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={s.amountWrap}>
          <Text style={[s.currency, amount === 0 && s.muted]}>{currencySymbol(currency)}</Text>
          <Text style={[s.amount, amount === 0 && s.muted, invalid && { color: colors.danger }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatAmountInput(raw, currency)}
          </Text>
        </View>
        <Text style={[s.available, overdraft && { color: colors.danger }]}>
          {overdraft
            ? t('transfer.overdraft', { amount: money(available) })
            : t('transfer.available', { dest: destination, amount: money(available) })}
        </Text>
        <Text style={[s.limits, issue && { color: colors.danger }]}>
          {issue === 'tooSmall'
            ? t('transfer.belowMin', { amount: money(limits.min) })
            : issue === 'tooLarge'
              ? t('transfer.aboveMax', { amount: money(limits.max) })
              : t('transfer.limits', { min: money(limits.min), max: money(limits.max) })}
        </Text>
        {!isDeposit && others.length > 0 && (
          <View style={s.approvalNote}>
            <Icon name="handshake" size={15} color={colors.accent} />
            <Text style={s.approvalText}>{t('transfer.needsApproval')}</Text>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dests} style={s.destsWrap}>
          <Chip
            label={t('common.commonFund')}
            selected={goalId === null}
            onPress={() => setGoalId(null)}
            leading={<GoalIcon icon="wallet" color="#5B6475" size={22} />}
          />
          {goals.map((g) => (
            <Chip
              key={g.id}
              label={g.name}
              selected={goalId === g.id}
              onPress={() => setGoalId(g.id)}
              leading={<GoalIcon icon={g.icon} color={g.color} size={22} />}
            />
          ))}
        </ScrollView>

        <View style={s.noteWrap}>
          <Icon name="edit" size={17} color={colors.textSubtle} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t('transfer.note')}
            placeholderTextColor={colors.textSubtle}
            keyboardAppearance={dark ? 'dark' : 'light'}
            style={s.note}
            maxLength={60}
          />
        </View>
      </ScrollView>

      <View style={s.bottom}>
        <ErrorBanner message={save.error} />
        <Keypad onKey={(k) => setRaw((v) => applyKey(v, k))} allowDecimal={hasCents(currency)} decimalSeparator={decimalSeparator} />
        <Button
          label={
            amount > 0
              ? t(isDeposit ? 'transfer.depositCta' : others.length ? 'transfer.requestCta' : 'transfer.withdrawCta', {
                  amount: money(amount),
                })
              : t(isDeposit ? 'transfer.deposit' : 'transfer.withdraw')
          }
          onPress={submit}
          disabled={!canSubmit}
          loading={save.loading}
          style={{ marginTop: spacing.sm }}
        />
      </View>
    </SafeAreaView>
  );
}

function Success({
  title,
  amount,
  body,
  hint,
  celebrate,
  icon = 'check',
  onDone,
  doneLabel,
}: {
  icon?: 'check' | 'hourglass';
  title: string;
  amount: string;
  body: string;
  hint?: string;
  celebrate?: boolean;
  onDone: () => void;
  doneLabel: string;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  const pendingTone = icon !== 'check';
  const [pop] = useState(() => new Animated.Value(0));
  const [fade] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const native = Platform.OS !== 'web';
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, useNativeDriver: native, speed: 14, bounciness: 12 }),
      Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: native }),
    ]).start();
  }, [pop, fade]);
  const rise = fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });

  return (
    <SafeAreaView style={[s.safe, s.success]}>
      <Animated.View style={[s.successHalo, pendingTone && { backgroundColor: colors.accentSoft }, { transform: [{ scale: pop }] }]}>
        <View style={[s.successIcon, pendingTone && { backgroundColor: colors.accent }]}>
          <Icon name={icon} size={icon === 'check' ? 52 : 44} color="#FFFFFF" strokeWidth={icon === 'check' ? 3 : 2.4} />
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }], alignItems: 'center', alignSelf: 'stretch' }}>
        <Text style={s.successTitle}>{title}</Text>
        <Text style={s.successAmount}>{amount}</Text>
        <Text style={s.successBody}>{body}</Text>
        {hint && (
          <View style={s.successHint}>
            <Icon name="target" size={15} color={colors.accent} />
            <Text style={s.successHintText}>{hint}</Text>
          </View>
        )}
        <Button label={doneLabel} onPress={onDone} style={s.successButton} />
      </Animated.View>
      {celebrate && <Confetti />}
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.surface },
  segmentWrap: { paddingHorizontal: spacing.xl + 8, marginTop: spacing.xs },
  body: { paddingHorizontal: spacing.md, paddingTop: spacing.md },
  amountWrap: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  currency: { fontFamily: fonts.bold, fontSize: 28, color: colors.text, marginTop: 12, marginRight: 4 },
  amount: { fontFamily: fonts.extrabold, fontSize: 68, color: colors.text, letterSpacing: -2.5 },
  muted: { color: colors.textSubtle },
  limits: { ...type.small, fontSize: 12, color: colors.textSubtle, textAlign: 'center', marginTop: 2 },
  available: { ...type.small, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xs },
  destsWrap: { marginHorizontal: -spacing.md, marginTop: spacing.lg },
  dests: { paddingHorizontal: spacing.md, gap: spacing.sm },
  noteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm + 2,
    paddingHorizontal: spacing.md - 2,
    marginTop: spacing.md,
  },
  note: { flex: 1, minWidth: 0, height: 48, ...type.body, color: colors.text, outlineWidth: 0 },
  approvalNote: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  approvalText: { ...type.smallStrong, fontSize: 12, color: colors.accent },
  bottom: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.xs },
  success: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  successHalo: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  successIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  successTitle: { ...type.h2, color: colors.text },
  successAmount: { ...type.display, fontSize: 44, color: colors.text, marginTop: spacing.sm },
  successBody: { ...type.body, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  successHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  successHintText: { ...type.smallStrong, color: colors.accent },
  successButton: { alignSelf: 'stretch', marginTop: spacing.xl },
}));
