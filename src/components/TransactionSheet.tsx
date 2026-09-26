import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import type { Transaction } from '@/store/types';
import { fonts, radius, spacing, type } from '@/theme';
import { formatShortDate, formatTime } from '@/utils/format';
import { Avatar } from './Avatar';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { PressableScale, tap } from './ui';

export const REACTIONS = ['❤️', '🔥', '👏', '🎉', '😮'];

/** Details of a movement with emoji reactions and a small comment thread. */
export function TransactionSheet({ txId, onClose }: { txId: string | null; onClose: () => void }) {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t, locale } = useT();
  const { transactions, goals, me, member, memberColor } = useSavings();
  const money = useMoney();
  const [draft, setDraft] = useState('');
  const tx: Transaction | undefined = transactions.find((x) => x.id === txId);

  if (!tx)
    return (
      <Sheet visible={false} onClose={onClose}>
        {null}
      </Sheet>
    );

  const author = member(tx.by);
  const isDeposit = tx.type === 'deposit';
  const goal = goals.find((g) => g.id === tx.goalId);
  const mine = tx.reactions[me.id];

  const send = async () => {
    if (!draft.trim()) return;
    await backend.comment(tx.id, draft);
    tap('success');
    setDraft('');
  };

  return (
    <Sheet visible={!!txId} onClose={onClose}>
      <View style={s.header}>
        <Avatar user={author} color={memberColor(tx.by)} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>
            {tx.refund
              ? tx.by === me.id
                ? t('tx.youRefunded')
                : t('tx.refunded', { name: author.name })
              : tx.by === me.id
                ? t(isDeposit ? 'tx.youDeposited' : 'tx.youWithdrew')
                : t(isDeposit ? 'tx.deposited' : 'tx.withdrew', { name: author.name })}
          </Text>
          <Text style={s.meta}>
            {goal?.name ?? t('common.commonFund')} · {formatShortDate(tx.date, locale)} {formatTime(tx.date, locale)}
          </Text>
        </View>
        <Text style={[s.amount, { color: isDeposit ? colors.success : colors.text }]}>
          {isDeposit ? '+' : '−'}
          {money(tx.amount)}
        </Text>
      </View>
      {!!tx.note && <Text style={s.note}>“{tx.note}”</Text>}
      {tx.recurringId && (
        <View style={s.tag}>
          <Icon name="repeat" size={13} color={colors.accent} />
          <Text style={s.tagText}>{t('txs.recurring')}</Text>
        </View>
      )}

      <View style={s.reactions}>
        {REACTIONS.map((emoji) => {
          const count = Object.values(tx.reactions).filter((r) => r === emoji).length;
          const selected = mine === emoji;
          return (
            <PressableScale
              key={emoji}
              haptic={false}
              scaleTo={0.85}
              onPress={() => {
                tap('selection');
                backend.react(tx.id, emoji);
              }}
              style={[s.reaction, selected && s.reactionOn]}>
              <Text style={{ fontSize: 22 }}>{emoji}</Text>
              {count > 0 && <Text style={s.reactionCount}>{count}</Text>}
            </PressableScale>
          );
        })}
      </View>

      <Text style={s.section}>{t('txs.comments')}</Text>
      <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={{ gap: spacing.sm + 2 }}>
        {tx.comments.length === 0 && <Text style={s.empty}>{t('txs.noComments')}</Text>}
        {tx.comments.map((c) => {
          const who = member(c.by);
          const own = c.by === me.id;
          return (
            <View key={c.id} style={[s.comment, own && s.commentOwn]}>
              {!own && <Avatar user={who} color={memberColor(c.by)} size={28} />}
              <View style={[s.bubble, own && s.bubbleOwn]}>
                <Text style={[s.bubbleText, own && { color: colors.onPrimary }]}>{c.text}</Text>
                <Text style={[s.bubbleTime, own && { color: colors.onPrimary, opacity: 0.7 }]}>{formatTime(c.date, locale)}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={s.composer}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={t('txs.commentPlaceholder')}
          placeholderTextColor={colors.textSubtle}
          keyboardAppearance={dark ? 'dark' : 'light'}
          style={s.input}
          maxLength={280}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <PressableScale onPress={send} disabled={!draft.trim()} accessibilityLabel={t('txs.send')} scaleTo={0.88} style={s.send}>
          <Icon name="send" size={18} color={colors.onPrimary} />
        </PressableScale>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  title: { ...type.h3, color: colors.text },
  meta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  amount: { fontFamily: fonts.extrabold, fontSize: 18 },
  note: { ...type.body, color: colors.text, marginTop: spacing.md, fontStyle: 'italic' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  tagText: { ...type.tiny, color: colors.accent },
  reactions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  reaction: {
    minWidth: 58,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reactionOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  reactionCount: { ...type.smallStrong, color: colors.text },
  section: { ...type.tiny, color: colors.textSubtle, textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  empty: { ...type.small, color: colors.textSubtle },
  comment: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  commentOwn: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%',
    backgroundColor: colors.surfaceAlt,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bubbleOwn: { backgroundColor: colors.primary, borderBottomLeftRadius: 18, borderBottomRightRadius: 6 },
  bubbleText: { ...type.body, fontSize: 14, color: colors.text },
  bubbleTime: { ...type.small, fontSize: 10, color: colors.textSubtle, marginTop: 2, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  input: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    ...type.body,
    color: colors.text,
    outlineWidth: 0,
  },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
}));
