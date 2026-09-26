import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, CoupleAvatars } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { PetCard } from '@/components/PetCard';
import { SettingsRow } from '@/components/SettingsRow';
import { SplitCard } from '@/components/SplitCard';
import { useTabBarSpace } from '@/components/TabBar';
import { Card, ProgressBar, TabHeader, useConfirm } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { goBackToHome } from '@/utils/navigation';

export default function CoupleScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const confirm = useConfirm();
  const tabBarSpace = useTabBarSpace();
  const { me, partner, couple, goals, transactions, byMember, savedFor, memberColor } = useSavings();
  const money = useMoney();
  const total = byMember[me.id] + byMember[partner.id];
  const completed = goals.filter((g) => savedFor(g.id) >= g.target).length;
  const count = (id: string) => transactions.filter((tx) => tx.by === id && tx.type === 'deposit').length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <TabHeader title={t('couple.title')} onBack={goBackToHome} />

        <LinearGradient colors={colors.coupleGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <CoupleAvatars me={me} partner={partner} size={76} ring={colors.surface} />
          <View style={s.namesRow}>
            <Text style={s.heroNames}>{me.name}</Text>
            <Icon name="heart" size={18} color={colors.partner} strokeWidth={2.6} />
            <Text style={s.heroNames}>{partner.name}</Text>
          </View>
          <Text style={s.heroSince}>{t('couple.since', { date: formatShortDate(couple.createdAt, locale) })}</Text>
          <View style={s.heroStats}>
            <Stat label={t('couple.movements')} value={String(transactions.length)} />
            <View style={s.statDivider} />
            <Stat label={t('couple.goals')} value={String(goals.length)} />
            <View style={s.statDivider} />
            <Stat label={t('couple.achieved')} value={String(completed)} />
          </View>
        </LinearGradient>

        <Text style={s.section}>{t('couple.whoContributed')}</Text>
        <Card style={{ gap: spacing.md + 2 }}>
          {[me, partner].map((m) => {
            const amount = byMember[m.id];
            const share = total > 0 ? amount / total : 0;
            return (
              <View key={m.id} style={{ gap: spacing.sm + 2 }}>
                <View style={s.contribRow}>
                  <Avatar user={m} color={memberColor(m.id)} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.contribName}>{m.id === me.id ? t('common.you', { name: m.name }) : m.name}</Text>
                    <Text style={s.contribMeta}>{count(m.id) === 1 ? t('couple.contribution') : t('couple.contributions', { n: count(m.id) })}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={s.contribAmount}>{money(amount)}</Text>
                    <Text style={s.contribMeta}>{t('couple.percent', { n: Math.round(share * 100) })}</Text>
                  </View>
                </View>
                <ProgressBar progress={share} color={memberColor(m.id)} height={6} />
              </View>
            );
          })}
        </Card>

        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <SplitCard />
          <PetCard />
        </View>

        <Text style={s.section}>{t('couple.more')}</Text>
        <Card style={{ paddingVertical: spacing.xs }}>
          <SettingsRow icon="settings" label={t('settings.title')} hint={t('couple.settingsHint')} onPress={() => router.push('/settings')} />
          <SettingsRow
            icon="qr"
            label={t('couple.shareCode')}
            hint={me.code}
            onPress={() => Share.share({ message: t('couple.shareCodeMessage', { code: me.code }) }).catch(() => {})}
            divider
          />
          <SettingsRow
            icon="logout"
            label={t('settings.logout')}
            danger
            divider
            onPress={() => confirm(t('settings.logoutTitle'), t('settings.logoutBody'), t('settings.logout'), backend.logout)}
          />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const s = useStyles();
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={s.statValue}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, dark }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
  namesRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  heroNames: { ...type.h2, color: colors.text },
  heroSince: { ...type.small, color: colors.textMuted, marginTop: 4 },
  heroStats: {
    flexDirection: 'row',
    backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    marginTop: spacing.lg,
    alignSelf: 'stretch',
  },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { ...type.h2, color: colors.text },
  statLabel: { ...type.small, fontSize: 12, color: colors.textMuted, marginTop: 2 },
  section: { ...type.h2, color: colors.text, marginTop: spacing.lg + 4, marginBottom: spacing.sm + 4 },
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  contribName: { ...type.h3, color: colors.text },
  contribMeta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  contribAmount: { ...type.bodyStrong, color: colors.text },
}));
