import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NestAvatars } from '@/components/Avatar';
import { LogoutButton } from '@/components/LogoutButton';
import { BalanceCard } from '@/components/BalanceCard';
import { DueContributions } from '@/components/DueContributions';
import { GoalTile } from '@/components/GoalCard';
import { Icon, type IconName } from '@/components/Icon';
import { useTabBarSpace } from '@/components/TabBar';
import { TransactionRow } from '@/components/TransactionRow';
import { NestSwitcherSheet } from '@/components/NestSheets';
import { PetCard } from '@/components/PetCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Card, EmptyState, PressableScale, SectionHeader } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';

function greetingKey() {
  const h = new Date().getHours();
  if (h < 12) return 'home.morning' as const;
  if (h < 19) return 'home.afternoon' as const;
  return 'home.evening' as const;
}

export default function HomeScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const tabBarSpace = useTabBarSpace();
  const { goals, transactions, commonFund, members, couple, nestName, needsMyApproval, pending } = useSavings();
  const [switcher, setSwitcher] = useState(false);
  const money = useMoney();
  const recent = transactions.slice(0, 4);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <PressableScale style={s.headerLeft} onPress={() => setSwitcher(true)} accessibilityLabel={t('nests.switcherTitle')}>
            <NestAvatars users={members} size={42} />
            <View style={{ flexShrink: 1 }}>
              <Text style={s.greeting}>{t(greetingKey())}</Text>
              <View style={s.nestRow}>
                <Text style={s.names} numberOfLines={1}>
                  {nestName}
                </Text>
                <Icon name="chevron-down" size={16} color={colors.textMuted} strokeWidth={2.4} />
              </View>
            </View>
          </PressableScale>
          <View style={s.headerRight}>
            <ThemeToggle />
            <LogoutButton />
          </View>
        </View>

        <BalanceCard />
        {pending.length > 0 && (
          <PressableScale style={s.requestsBanner} onPress={() => router.navigate('/couple')} scaleTo={0.98}>
            <View style={s.requestsIcon}>
              <Icon name="handshake" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.requestsTitle}>
                {needsMyApproval.length
                  ? t(needsMyApproval.length === 1 ? 'requests.bannerTitleOne' : 'requests.bannerTitle', { n: needsMyApproval.length })
                  : t(pending.length === 1 ? 'requests.bannerWaitingOne' : 'requests.bannerWaiting', { n: pending.length })}
              </Text>
              <Text style={s.requestsBody}>{t('requests.bannerBody')}</Text>
            </View>
            {needsMyApproval.length > 0 && <View style={s.requestsDot} />}
            <Icon name="chevron" size={18} color={colors.textSubtle} />
          </PressableScale>
        )}
        <DueContributions />

        <View style={s.quickActions}>
          <QuickAction icon="target" label={t('home.qNewGoal')} onPress={() => router.push('/new-goal')} />
          <QuickAction icon="repeat" label={t('home.qRecurring')} onPress={() => router.push('/recurring')} />
          <QuickAction icon="receipt" label={t('home.qActivity')} onPress={() => router.push('/activity')} />
          <QuickAction icon="egg" label={couple.petName ?? t('pet.defaultName')} onPress={() => router.push('/pet')} />
        </View>

        <View style={{ marginTop: spacing.lg }}>
          <PetCard />
        </View>

        <SectionHeader
          title={t('home.ourGoals')}
          action={goals.length ? t('home.seeAll') : undefined}
          onAction={() => router.push('/goals')}
        />
        {goals.length === 0 ? (
          <PressableScale onPress={() => router.push('/new-goal')} style={s.newGoalCard}>
            <View style={s.newGoalIcon}>
              <Icon name="add" size={24} color={colors.accent} strokeWidth={2.4} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.newGoalTitle}>{t('home.firstGoalTitle')}</Text>
              <Text style={s.newGoalBody}>{t('home.firstGoalBody')}</Text>
            </View>
            <Icon name="chevron" size={20} color={colors.textSubtle} />
          </PressableScale>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.carousel} style={s.carouselWrap}>
            {goals.map((g) => (
              <GoalTile key={g.id} goal={g} />
            ))}
            <PressableScale onPress={() => router.push('/new-goal')} style={s.addTile}>
              <View style={s.addTileIcon}>
                <Icon name="add" size={22} color={colors.accent} strokeWidth={2.6} />
              </View>
              <Text style={s.addTileText}>{t('home.newGoal')}</Text>
            </PressableScale>
          </ScrollView>
        )}

        {commonFund > 0 && (
          <View style={s.fundCard}>
            <View style={s.fundIcon}>
              <Icon name="wallet" size={20} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.fundTitle}>{t('home.fundTitle', { amount: money(commonFund) })}</Text>
              <Text style={s.fundText}>{t('home.fundBody')}</Text>
            </View>
          </View>
        )}

        <SectionHeader
          title={t('home.recent')}
          action={recent.length ? t('home.seeAllActivity') : undefined}
          onAction={() => router.push('/activity')}
        />
        <Card style={{ paddingVertical: spacing.xs }}>
          {recent.length === 0 ? (
            <EmptyState icon="sparkles" title={t('home.emptyTitle')} body={t('home.emptyBody')} />
          ) : (
            recent.map((tx, i) => <TransactionRow key={tx.id} tx={tx} showDivider={i > 0} />)
          )}
        </Card>
      </ScrollView>
      <NestSwitcherSheet visible={switcher} onClose={() => setSwitcher(false)} />
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale containerStyle={s.quickAction} style={s.quickInner} onPress={onPress} scaleTo={0.92}>
      <View style={s.quickIcon}>
        <Icon name={icon} size={22} color={colors.text} />
      </View>
      <Text style={s.quickLabel} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md + 4, gap: spacing.sm },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  greeting: { ...type.small, color: colors.textMuted },
  names: { ...type.h3, fontFamily: type.h2.fontFamily, color: colors.text, flexShrink: 1 },
  nestRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.lg },
  quickAction: { width: '24%' },
  quickInner: { alignItems: 'center', gap: spacing.sm },
  quickIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation,
  },
  quickLabel: { ...type.smallStrong, fontSize: 12, color: colors.text },
  carouselWrap: { marginHorizontal: -spacing.md },
  carousel: { paddingHorizontal: spacing.md, gap: spacing.sm + 4, paddingBottom: spacing.md, paddingTop: 2 },
  addTile: {
    width: 120,
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addTileIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTileText: { ...type.smallStrong, color: colors.accent },
  newGoalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    ...elevation,
  },
  newGoalIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newGoalTitle: { ...type.h3, color: colors.text },
  newGoalBody: { ...type.small, color: colors.textMuted, marginTop: 2 },
  requestsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    marginTop: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md - 2,
    borderWidth: 1.5,
    borderColor: colors.accentSoft,
    ...elevation,
  },
  requestsIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestsTitle: { ...type.bodyStrong, color: colors.text },
  requestsBody: { ...type.small, color: colors.textMuted, marginTop: 1 },
  requestsDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  fundCard: {
    flexDirection: 'row',
    gap: spacing.md - 4,
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  fundIcon: { width: 40, height: 40, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  fundTitle: { ...type.bodyStrong, color: colors.text },
  fundText: { ...type.small, color: colors.textMuted, marginTop: 2 },
}));
