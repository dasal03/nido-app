import { Text, View } from 'react-native';

import type { TranslationKey } from '@/i18n/es';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { firstName, joinNames, useMoney, useSavings } from '@/store/SavingsContext';
import type { ApprovalRequest, Couple } from '@/store/types';
import { radius, spacing, type } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { computeRefunds } from '@/utils/settlement';
import { Avatar } from './Avatar';
import { useConfirm } from './ConfirmDialog';
import { Icon, type IconName } from './Icon';
import { Button, tap } from './ui';

const KIND_ICON: Record<ApprovalRequest['kind'], IconName> = { withdraw: 'withdraw', dissolve: 'unlink', leave: 'door' };

/** Pending approvals of the active nest: approve/reject others' requests, or cancel your own. */
export function PendingRequests({ compact }: { compact?: boolean }) {
  const s = useStyles();
  const { t } = useT();
  const { pending } = useSavings();
  if (!pending.length) return null;
  return (
    <View style={{ gap: spacing.sm + 2 }}>
      {!compact && <Text style={s.section}>{t('requests.title')}</Text>}
      {pending.map((r) => (
        <RequestCard key={r.id} request={r} />
      ))}
    </View>
  );
}

function RequestCard({ request }: { request: ApprovalRequest }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const confirm = useConfirm();
  const money = useMoney();
  const { me, members, member, memberColor, goals, couple, isFamily } = useSavings();
  const author = member(request.by);
  const mine = request.by === me.id;
  const waitingFor = members.filter((m) => !request.approvals.includes(m.id));
  const approved = members.length - waitingFor.length;
  const goal = goals.find((g) => g.id === request.goalId);
  const who = firstName(author.name);

  const titleKey =
    request.kind === 'withdraw'
      ? 'requests.withdrawTitle'
      : request.kind === 'leave'
        ? 'requests.leaveTitle'
        : isFamily
          ? 'requests.dissolveFamilyTitle'
          : 'requests.dissolveTitle';
  const title = t(mine ? (`${titleKey}Mine` as TranslationKey) : titleKey, { name: who, amount: money(request.amount ?? 0) });
  const detail =
    request.kind === 'withdraw'
      ? [goal ? goal.name : t('common.commonFund'), request.note].filter(Boolean).join(' · ')
      : t(request.kind === 'dissolve' ? 'requests.dissolveDetail' : 'requests.leaveDetail');

  const approve = () => {
    const run = async () => {
      await backend.approveRequest(request.id);
      tap('success');
    };
    if (request.kind === 'withdraw') return run();
    confirm(
      t('requests.approveTitle'),
      t(request.kind === 'dissolve' ? 'requests.approveDissolveBody' : 'requests.approveLeaveBody'),
      t('requests.approve'),
      run,
      {
        tone: request.kind === 'dissolve' ? 'danger' : 'primary',
        icon: KIND_ICON[request.kind],
        content: <RefundBreakdown couple={couple} only={request.kind === 'leave' ? [request.by] : undefined} />,
      },
    );
  };

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View>
          <Avatar user={author} color={memberColor(request.by)} size={42} />
          <View style={s.kindBadge}>
            <Icon name={KIND_ICON[request.kind]} size={11} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{title}</Text>
          {!!detail && (
            <Text style={s.detail} numberOfLines={2}>
              {detail}
            </Text>
          )}
          <Text style={s.meta}>
            {formatShortDate(request.createdAt, locale)} · {t('requests.progress', { n: approved, total: members.length })}
          </Text>
        </View>
      </View>

      {mine ? (
        <View style={s.waitingRow}>
          <View style={s.waiting}>
            <Icon name="hourglass" size={14} color={colors.textMuted} />
            <Text style={s.waitingText} numberOfLines={1}>
              {t('requests.waitingFor', {
                names: joinNames(
                  waitingFor.map((m) => firstName(m.name)),
                  t('common.and'),
                ),
              })}
            </Text>
          </View>
          <Button
            label={t('requests.cancel')}
            variant="secondary"
            onPress={() =>
              confirm(t('requests.cancelTitle'), '', t('requests.cancelConfirm'), () => backend.cancelRequest(request.id), {
                cancelLabel: t('requests.keep'),
              })
            }
            style={s.smallButton}
          />
        </View>
      ) : request.approvals.includes(me.id) ? (
        <View style={s.waiting}>
          <Icon name="check-circle" size={14} color={colors.success} />
          <Text style={s.waitingText} numberOfLines={1}>
            {t('requests.youApproved', {
              names: joinNames(
                waitingFor.map((m) => firstName(m.name)),
                t('common.and'),
              ),
            })}
          </Text>
        </View>
      ) : (
        <View style={s.actions}>
          <Button
            label={t('requests.reject')}
            variant="secondary"
            icon="close"
            onPress={() =>
              confirm(t('requests.rejectTitle'), t('requests.rejectBody'), t('requests.reject'), () => backend.rejectRequest(request.id))
            }
            style={{ flex: 1 }}
          />
          <Button label={t('requests.approve')} icon="check" onPress={approve} style={{ flex: 1 }} />
        </View>
      )}
    </View>
  );
}

/** "Who gets what back" when a nest is dissolved (or `only` those members leave). */
export function RefundBreakdown({ couple, only }: { couple: Couple; only?: string[] }) {
  const s = useStyles();
  const { t } = useT();
  const money = useMoney();
  const { member, memberColor, me } = useSavings();
  const refunds = computeRefunds(couple);
  const ids = only ?? couple.memberIds;
  return (
    <View style={s.breakdown}>
      <Text style={s.breakdownTitle}>{t('requests.refundTitle')}</Text>
      {ids.map((id) => (
        <View key={id} style={s.breakdownRow}>
          <Avatar user={member(id)} color={memberColor(id)} size={26} />
          <Text style={s.breakdownName} numberOfLines={1}>
            {id === me.id ? t('requests.you') : firstName(member(id).name)}
          </Text>
          <Text style={s.breakdownAmount}>{money(refunds[id] ?? 0)}</Text>
        </View>
      ))}
      <Text style={s.breakdownHint}>{t('requests.refundHint')}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  section: { ...type.h2, color: colors.text, marginTop: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md - 2,
    borderWidth: 1.5,
    borderColor: colors.accentSoft,
    ...elevation,
  },
  head: { flexDirection: 'row', gap: spacing.md - 4, alignItems: 'flex-start' },
  kindBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...type.bodyStrong, color: colors.text },
  detail: { ...type.small, color: colors.textMuted, marginTop: 2 },
  meta: { ...type.small, fontSize: 12, color: colors.textSubtle, marginTop: 4 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  waitingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  waiting: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    height: 40,
  },
  waitingText: { ...type.small, color: colors.textMuted, flexShrink: 1 },
  smallButton: { height: 40, paddingHorizontal: spacing.md },
  breakdown: {
    alignSelf: 'stretch',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  breakdownTitle: { ...type.tiny, color: colors.textSubtle, textTransform: 'uppercase' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakdownName: { ...type.bodyStrong, color: colors.text, flex: 1 },
  breakdownAmount: { ...type.bodyStrong, color: colors.text },
  breakdownHint: { ...type.small, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
}));
