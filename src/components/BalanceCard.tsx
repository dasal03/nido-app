import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { makeStyles, usePreferences, useT, useTheme } from '@/providers/Preferences';
import { firstName, useMoney, useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { PressableScale, tap } from './ui';

export function BalanceCard() {
  const { balance, thisMonth, byMember, members, memberColor } = useSavings();
  const { colors } = useTheme();
  const { t } = useT();
  const s = useStyles();
  const money = useMoney();
  const { prefs } = usePreferences();
  const [hidden, setHidden] = useState(prefs.hideBalances);
  const totalIn = members.reduce((sum, m) => sum + (byMember[m.id] ?? 0), 0);
  const shareOf = (id: string) => (totalIn > 0 ? (byMember[id] ?? 0) / totalIn : 1 / members.length);
  const mask = (v: string) => (hidden ? '••••' : v);

  return (
    <LinearGradient colors={colors.heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card}>
      <View style={s.glow} pointerEvents="none" />
      <View style={s.labelRow}>
        <Text style={s.label}>{t('home.balance')}</Text>
        <Pressable
          hitSlop={10}
          onPress={() => {
            tap('selection');
            setHidden((h) => !h);
          }}
          accessibilityLabel={t(hidden ? 'home.showBalance' : 'home.hideBalance')}>
          <Icon name={hidden ? 'eye-off' : 'eye'} size={18} color="rgba(255,255,255,0.75)" />
        </Pressable>
      </View>
      <Text style={s.amount} adjustsFontSizeToFit numberOfLines={1}>
        {hidden ? '••••••' : money(balance)}
      </Text>
      <View style={s.monthPill}>
        <Icon name={thisMonth >= 0 ? 'trend-up' : 'trend-down'} size={14} color="#FFFFFF" strokeWidth={2.5} />
        <Text style={s.monthText}>{t('home.thisMonth', { amount: mask(`${thisMonth >= 0 ? '+' : ''}${money(thisMonth)}`) })}</Text>
      </View>

      <View style={s.split}>
        {members.map((m) => (
          <View key={m.id} style={[s.splitBar, { flex: shareOf(m.id), backgroundColor: memberColor(m.id) }]} />
        ))}
      </View>
      <View style={s.legend}>
        {members.map((m, i) => (
          <Legend
            key={m.id}
            color={memberColor(m.id)}
            name={firstName(m.name)}
            value={mask(money(byMember[m.id] ?? 0, { compact: true }))}
            end={members.length === 2 && i === 1}
          />
        ))}
      </View>

      <View style={s.actions}>
        <PressableScale
          containerStyle={{ flex: 1 }}
          style={[s.pill, s.pillPrimary]}
          onPress={() => router.push({ pathname: '/transfer', params: { type: 'deposit' } })}>
          <Icon name="add" size={18} color="#0A1F5C" strokeWidth={2.6} />
          <Text style={[s.pillText, { color: '#0A1F5C' }]}>{t('home.deposit')}</Text>
        </PressableScale>
        <PressableScale
          containerStyle={{ flex: 1 }}
          style={[s.pill, s.pillGhost]}
          onPress={() => router.push({ pathname: '/transfer', params: { type: 'withdraw' } })}>
          <Icon name="withdraw" size={18} color="#FFFFFF" strokeWidth={2.4} />
          <Text style={[s.pillText, { color: '#FFFFFF' }]}>{t('home.withdraw')}</Text>
        </PressableScale>
      </View>
    </LinearGradient>
  );
}

function Legend({ color, name, value, end }: { color: string; name: string; value: string; end?: boolean }) {
  const s = useStyles();
  return (
    <View style={{ alignItems: end ? 'flex-end' : 'flex-start' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[s.dot, { backgroundColor: color }]} />
        <Text style={s.legendName}>{name}</Text>
      </View>
      <Text style={s.legendValue}>{value}</Text>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  card: { borderRadius: radius.lg, padding: spacing.lg, overflow: 'hidden' },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -90,
    top: -110,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { ...type.bodyStrong, color: 'rgba(255,255,255,0.8)' },
  amount: { ...type.display, fontSize: 44, color: '#FFFFFF', marginTop: spacing.xs },
  monthPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.14)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
  },
  monthText: { ...type.smallStrong, color: '#FFFFFF' },
  split: { flexDirection: 'row', height: 6, marginTop: spacing.lg, gap: 4 },
  splitBar: { borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
    columnGap: spacing.md,
    marginTop: spacing.sm + 2,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendName: { ...type.small, color: 'rgba(255,255,255,0.78)' },
  legendValue: { ...type.h3, color: '#FFFFFF', marginTop: 2 },
  actions: { flexDirection: 'row', gap: spacing.sm + 4, marginTop: spacing.lg },
  pill: {
    height: 50,
    borderRadius: radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pillPrimary: { backgroundColor: '#FFFFFF' },
  pillGhost: { backgroundColor: 'rgba(255,255,255,0.12)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)' },
  pillText: { ...type.bodyStrong, fontSize: 16 },
}));
