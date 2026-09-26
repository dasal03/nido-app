import { useState } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useMoney, useSavings } from '@/store/SavingsContext';
import type { Transaction } from '@/store/types';
import { spacing, type } from '@/theme';
import { formatTime } from '@/utils/format';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { TransactionSheet } from './TransactionSheet';
import { PressableScale } from './ui';

export function TransactionRow({ tx, showDivider }: { tx: Transaction; showDivider?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const { goals, me, member, memberColor } = useSavings();
  const money = useMoney();
  const goal = tx.goalId ? goals.find((g) => g.id === tx.goalId) : null;
  const isDeposit = tx.type === 'deposit';
  const author = member(tx.by);
  const mine = tx.by === me.id;
  const title = mine
    ? t(isDeposit ? 'tx.youDeposited' : 'tx.youWithdrew')
    : t(isDeposit ? 'tx.deposited' : 'tx.withdrew', { name: author.name });
  const destination = goal ? goal.name : t('common.commonFund');
  const [open, setOpen] = useState(false);
  const reactions = Object.values(tx.reactions);

  return (
    <>
      <PressableScale onPress={() => setOpen(true)} scaleTo={0.985} haptic={false} style={[s.row, showDivider && s.divider]}>
        <View>
          <Avatar user={author} color={memberColor(tx.by)} size={44} />
          <View
            style={[
              s.badge,
              {
                backgroundColor: isDeposit ? colors.success : colors.textMuted,
              },
            ]}>
            <Icon name={isDeposit ? 'deposit' : 'withdraw'} size={10} color="#FFFFFF" strokeWidth={3} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {tx.note ? `${tx.note} · ` : ''}
            {destination}
          </Text>
          {(reactions.length > 0 || tx.comments.length > 0 || tx.recurringId) && (
            <View style={s.social}>
              {tx.recurringId && <Icon name="repeat" size={12} color={colors.accent} />}
              {reactions.length > 0 && <Text style={s.emojis}>{reactions.join('')}</Text>}
              {tx.comments.length > 0 && (
                <View style={s.commentCount}>
                  <Icon name="message" size={12} color={colors.textMuted} />
                  <Text style={s.commentText}>{tx.comments.length}</Text>
                </View>
              )}
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.amount, { color: isDeposit ? colors.success : colors.text }]}>
            {isDeposit ? '+' : '−'}
            {money(tx.amount)}
          </Text>
          <Text style={s.time}>{formatTime(tx.date, locale)}</Text>
        </View>
      </PressableScale>
      {open && <TransactionSheet txId={tx.id} onClose={() => setOpen(false)} />}
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingVertical: spacing.sm + 5,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.h3, fontSize: 15, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  amount: { ...type.bodyStrong },
  social: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  emojis: { fontSize: 13, letterSpacing: 1 },
  commentCount: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  commentText: { ...type.tiny, color: colors.textMuted },
  time: { ...type.small, fontSize: 12, color: colors.textSubtle, marginTop: 2 },
}));
