import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GoalRow } from '@/components/GoalCard';
import { Icon } from '@/components/Icon';
import { useTabBarSpace } from '@/components/TabBar';
import { Button, Card, EmptyState, PressableScale, ProgressBar, TabHeader } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { spacing, type } from '@/theme';
import { goBackToHome } from '@/utils/navigation';

export default function GoalsScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const tabBarSpace = useTabBarSpace();
  const { goals, savedFor, commonFund } = useSavings();
  const money = useMoney();
  const totalTarget = goals.reduce((sum, g) => sum + g.target, 0);
  const totalSaved = goals.reduce((sum, g) => sum + Math.min(Math.max(savedFor(g.id), 0), g.target), 0);
  const completed = goals.filter((g) => savedFor(g.id) >= g.target).length;
  const overall = totalTarget > 0 ? totalSaved / totalTarget : 0;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <TabHeader
          title={t('goals.title')}
          onBack={goBackToHome}
          trailing={
            <PressableScale style={s.addButton} onPress={() => router.push('/new-goal')} accessibilityLabel={t('goals.create')} scaleTo={0.9}>
              <Icon name="add" size={22} color={colors.onPrimary} strokeWidth={2.6} />
            </PressableScale>
          }
        />

        {goals.length > 0 && (
          <Card style={{ gap: spacing.sm + 4 }}>
            <View style={s.summaryRow}>
              <View>
                <Text style={s.summaryLabel}>{t('goals.totalProgress')}</Text>
                <Text style={s.summaryValue}>{Math.round(overall * 100)}%</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.summaryLabel}>{t('goals.achieved')}</Text>
                <Text style={s.summaryValue}>
                  {completed}/{goals.length}
                </Text>
              </View>
            </View>
            <ProgressBar progress={overall} height={10} />
            <Text style={s.summaryFoot}>{t('goals.ofAmount', { saved: money(totalSaved), target: money(totalTarget) })}</Text>
          </Card>
        )}

        <View style={{ gap: spacing.sm + 4 }}>
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} />
          ))}
        </View>

        {goals.length === 0 && (
          <>
            <EmptyState icon="target" title={t('goals.emptyTitle')} body={t('goals.emptyBody')} />
            <Button label={t('goals.create')} icon="add" onPress={() => router.push('/new-goal')} />
          </>
        )}

        <Card style={s.fund}>
          <View style={s.fundIcon}>
            <Icon name="wallet" size={22} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.fundTitle}>{t('common.commonFund')}</Text>
            <Text style={s.fundBody}>{t('goals.commonFundBody')}</Text>
          </View>
          <Text style={s.fundAmount}>{money(commonFund)}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, gap: spacing.md },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...elevation,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { ...type.small, color: colors.textMuted },
  summaryValue: { ...type.h1, color: colors.text, marginTop: 2 },
  summaryFoot: { ...type.small, color: colors.textMuted },
  fund: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  fundIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  fundTitle: { ...type.h3, color: colors.text },
  fundBody: { ...type.small, color: colors.textMuted, marginTop: 2 },
  fundAmount: { ...type.bodyStrong, color: colors.text },
}));
