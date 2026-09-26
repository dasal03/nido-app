import { useMemo, useState } from 'react';
import { ScrollView, SectionList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { useTabBarSpace } from '@/components/TabBar';
import { TransactionRow } from '@/components/TransactionRow';
import { ExportSheet } from '@/components/ExportSheet';
import { Chip, EmptyState, IconButton, TabHeader } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { firstName, useMoney, useSavings } from '@/store/SavingsContext';
import type { Transaction } from '@/store/types';
import { radius, spacing, type } from '@/theme';
import { formatDayLabel } from '@/utils/format';
import { goBackToHome } from '@/utils/navigation';

/** 'all', a movement type, or a member's user id. */
type Filter = 'all' | 'deposit' | 'withdraw' | (string & {});

function matches(filter: Filter) {
  return (tx: Transaction) =>
    filter === 'all' ? true : filter === 'deposit' || filter === 'withdraw' ? tx.type === filter : tx.by === filter;
}

export default function ActivityScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const tabBarSpace = useTabBarSpace();
  const { transactions, me, others, memberColor } = useSavings();
  const money = useMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [exporting, setExporting] = useState(false);

  const { sections, totalIn, totalOut } = useMemo(() => {
    const list = transactions.filter(matches(filter));
    const labels = { today: t('date.today'), yesterday: t('date.yesterday') };
    const groups = new Map<string, Transaction[]>();
    for (const tx of list) {
      const key = formatDayLabel(tx.date, locale, labels);
      groups.set(key, [...(groups.get(key) ?? []), tx]);
    }
    return {
      sections: [...groups].map(([title, data]) => ({ title, data })),
      totalIn: list.filter((tx) => tx.type === 'deposit').reduce((sum, tx) => sum + tx.amount, 0),
      totalOut: list.filter((tx) => tx.type === 'withdraw').reduce((sum, tx) => sum + tx.amount, 0),
    };
  }, [transactions, filter, t, locale]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.headerWrap}>
        <TabHeader
          title={t('activity.title')}
          onBack={goBackToHome}
          trailing={<IconButton icon="download" label={t('settings.export')} onPress={() => setExporting(true)} />}
        />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filters}>
          <Chip label={t('activity.all')} selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip
            label={t('activity.me')}
            selected={filter === me.id}
            onPress={() => setFilter(me.id)}
            leading={<Avatar user={me} color={colors.me} size={20} />}
          />
          {others.map((m) => (
            <Chip
              key={m.id}
              label={firstName(m.name)}
              selected={filter === m.id}
              onPress={() => setFilter(m.id)}
              leading={<Avatar user={m} color={memberColor(m.id)} size={20} />}
            />
          ))}
          <Chip label={t('activity.deposits')} selected={filter === 'deposit'} onPress={() => setFilter('deposit')} />
          <Chip label={t('activity.withdrawals')} selected={filter === 'withdraw'} onPress={() => setFilter('withdraw')} />
        </ScrollView>
      </View>

      <View style={s.totals}>
        <View style={[s.totalBox, { backgroundColor: colors.successSoft }]}>
          <View style={[s.totalIcon, { backgroundColor: colors.success }]}>
            <Icon name="deposit" size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.totalLabel}>{t('activity.in')}</Text>
            <Text style={[s.totalValue, { color: colors.success }]} numberOfLines={1}>
              +{money(totalIn)}
            </Text>
          </View>
        </View>
        <View style={[s.totalBox, { backgroundColor: colors.surface }]}>
          <View style={[s.totalIcon, { backgroundColor: colors.textMuted }]}>
            <Icon name="withdraw" size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.totalLabel}>{t('activity.out')}</Text>
            <Text style={s.totalValue} numberOfLines={1}>
              −{money(totalOut)}
            </Text>
          </View>
        </View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        contentContainerStyle={[s.list, { paddingBottom: tabBarSpace }]}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
        renderSectionHeader={({ section }) => <Text style={s.sectionTitle}>{section.title}</Text>}
        renderItem={({ item, index, section }) => (
          <View style={[s.item, index === 0 && s.itemFirst, index === section.data.length - 1 && s.itemLast]}>
            <TransactionRow tx={item} showDivider={index > 0} />
          </View>
        )}
        ListEmptyComponent={<EmptyState icon="receipt" title={t('activity.emptyTitle')} body={t('activity.emptyBody')} />}
      />
      <ExportSheet visible={exporting} onClose={() => setExporting(false)} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerWrap: { paddingHorizontal: spacing.md, marginBottom: spacing.xs },
  filters: { paddingHorizontal: spacing.md, gap: spacing.sm },
  totals: { flexDirection: 'row', gap: spacing.sm + 4, paddingHorizontal: spacing.md, marginTop: spacing.md },
  totalBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, borderRadius: radius.md, padding: spacing.md - 2 },
  totalIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  totalLabel: { ...type.small, color: colors.textMuted },
  totalValue: { ...type.bodyStrong, color: colors.text, marginTop: 1 },
  list: { padding: spacing.md },
  sectionTitle: { ...type.tiny, color: colors.textSubtle, textTransform: 'uppercase', marginTop: spacing.md, marginBottom: spacing.sm },
  item: { backgroundColor: colors.surface, paddingHorizontal: spacing.md },
  itemFirst: { borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, paddingTop: spacing.xs },
  itemLast: { borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md, paddingBottom: spacing.xs },
}));
