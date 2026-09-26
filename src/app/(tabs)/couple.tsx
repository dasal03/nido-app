import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Share, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, NestAvatars } from '@/components/Avatar';
import { useConfirm } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { LinkForm } from '@/components/LinkForm';
import { PetCard } from '@/components/PetCard';
import { PendingRequests, RefundBreakdown } from '@/components/Requests';
import { SettingsRow } from '@/components/SettingsRow';
import { Sheet } from '@/components/Sheet';
import { SplitCard } from '@/components/SplitCard';
import { useTabBarSpace } from '@/components/TabBar';
import { Button, Card, ErrorBanner, PressableScale, ProgressBar, TabHeader, TextField, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useMoney, useSavings } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { goBackToHome } from '@/utils/navigation';
import { useAction } from '@/utils/useAction';

export default function NestScreen() {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const confirm = useConfirm();
  const tabBarSpace = useTabBarSpace();
  const { me, members, couple, goals, transactions, byMember, savedFor, memberColor, isFamily, nestName, pending, balance } = useSavings();
  const money = useMoney();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const total = members.reduce((sum, m) => sum + (byMember[m.id] ?? 0), 0);
  const completed = goals.filter((g) => savedFor(g.id) >= g.target).length;
  const count = (id: string) => transactions.filter((tx) => tx.by === id && tx.type === 'deposit').length;
  const dissolvePending = pending.some((r) => r.kind === 'dissolve');
  const leavePending = pending.some((r) => r.kind === 'leave' && r.by === me.id);
  const soleMember = members.length === 1;

  const dissolve = () =>
    confirm(
      t(isFamily ? 'nest.dissolveFamilyTitle' : 'nest.dissolveTitle'),
      t(soleMember ? 'nest.dissolveSoloBody' : 'nest.dissolveBody'),
      t(soleMember ? 'nest.dissolveNow' : 'nest.requestDissolve'),
      async () => {
        await backend.requestDissolve();
        tap('success');
      },
      { icon: 'unlink', content: balance > 0 ? <RefundBreakdown couple={couple} /> : undefined },
    );

  const leave = () =>
    confirm(
      t('nest.leaveTitle', { name: nestName }),
      t('nest.leaveBody'),
      t('nest.requestLeave'),
      async () => {
        await backend.requestLeave();
        tap('success');
      },
      { icon: 'door', content: balance > 0 ? <RefundBreakdown couple={couple} only={[me.id]} /> : undefined },
    );

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView contentContainerStyle={[s.content, { paddingBottom: tabBarSpace }]} showsVerticalScrollIndicator={false}>
        <TabHeader title={t(isFamily ? 'tabs.family' : 'tabs.couple')} onBack={goBackToHome} />

        <LinearGradient colors={colors.coupleGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
          <NestAvatars users={members} size={72} ring={colors.surface} max={4} />
          <PressableScale style={s.nameRow} onPress={() => setEditing(true)} accessibilityLabel={t('nest.editName')}>
            <Text style={s.heroName} numberOfLines={2}>
              {nestName}
            </Text>
            <View style={s.editBadge}>
              <Icon name="edit" size={14} color={colors.accent} strokeWidth={2.4} />
            </View>
          </PressableScale>
          <View style={s.kindPill}>
            <Icon name={isFamily ? 'users' : 'heart'} size={13} color={isFamily ? colors.accent : colors.partner} strokeWidth={2.6} />
            <Text style={s.kindText}>
              {isFamily
                ? t(members.length === 1 ? 'nest.familyMembersOne' : 'nest.familyMembers', { n: members.length })
                : t('nest.coupleKind')}{' '}
              · {t('couple.since', { date: formatShortDate(couple.createdAt, locale) })}
            </Text>
          </View>
          <View style={s.heroStats}>
            <Stat label={t('couple.movements')} value={String(transactions.length)} />
            <View style={s.statDivider} />
            <Stat label={t('couple.goals')} value={String(goals.length)} />
            <View style={s.statDivider} />
            <Stat label={t('couple.achieved')} value={String(completed)} />
          </View>
        </LinearGradient>

        <View style={s.quickRow}>
          <QuickButton icon="edit" label={t('nest.editName')} onPress={() => setEditing(true)} />
          {isFamily ? (
            <QuickButton icon="user-plus" label={t('family.addMember')} onPress={() => setAdding(true)} />
          ) : (
            <QuickButton
              icon="share"
              label={t('couple.shareCode')}
              onPress={() => Share.share({ message: t('couple.shareCodeMessage', { code: me.code }) }).catch(() => {})}
            />
          )}
          {isFamily && !soleMember ? (
            <QuickButton icon="door" label={t('nest.leave')} danger onPress={leave} disabled={leavePending} />
          ) : (
            <QuickButton
              icon="unlink"
              label={t(isFamily ? 'nest.dissolveShortFamily' : 'nest.dissolveShort')}
              danger
              onPress={dissolve}
              disabled={dissolvePending}
            />
          )}
        </View>

        <View style={{ marginTop: spacing.md }}>
          <PendingRequests />
        </View>

        <Text style={s.section}>{t(isFamily ? 'nest.members' : 'couple.whoContributed')}</Text>
        <Card style={{ gap: spacing.md + 2 }}>
          {members.map((m) => {
            const amount = byMember[m.id] ?? 0;
            const share = total > 0 ? amount / total : 0;
            return (
              <View key={m.id} style={{ gap: spacing.sm + 2 }}>
                <View style={s.contribRow}>
                  <Avatar user={m} color={memberColor(m.id)} size={44} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.contribName} numberOfLines={1}>
                      {m.id === me.id ? t('common.you', { name: m.name }) : m.name}
                    </Text>
                    <Text style={s.contribMeta}>
                      {count(m.id) === 1 ? t('couple.contribution') : t('couple.contributions', { n: count(m.id) })}
                    </Text>
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
          {isFamily && (
            <PressableScale style={s.addMember} onPress={() => setAdding(true)} scaleTo={0.98}>
              <View style={s.addIcon}>
                <Icon name="user-plus" size={18} color={colors.accent} />
              </View>
              <Text style={s.addText}>{t('family.addMember')}</Text>
            </PressableScale>
          )}
        </Card>

        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          {!isFamily && <SplitCard />}
          <PetCard />
        </View>

        <Text style={s.section}>{t('nest.manage')}</Text>
        <Card style={{ paddingVertical: spacing.xs }}>
          <SettingsRow icon="edit" label={t('nest.editName')} hint={nestName} onPress={() => setEditing(true)} />
          <SettingsRow
            icon="qr"
            label={t('couple.shareCode')}
            hint={me.code}
            onPress={() => Share.share({ message: t('couple.shareCodeMessage', { code: me.code }) }).catch(() => {})}
            divider
          />
          <SettingsRow
            icon="settings"
            label={t('settings.title')}
            hint={t('couple.settingsHint')}
            onPress={() => router.push('/settings')}
            divider
          />
          {isFamily && !soleMember && (
            <SettingsRow
              icon="door"
              label={t('nest.leave')}
              hint={leavePending ? t('nest.pendingHint') : t('nest.leaveHint')}
              danger
              divider
              onPress={leavePending ? undefined : leave}
            />
          )}
          <SettingsRow
            icon="unlink"
            label={t(isFamily ? 'nest.dissolveFamily' : 'nest.dissolve')}
            hint={dissolvePending ? t('nest.pendingHint') : t(soleMember ? 'nest.dissolveSoloHint' : 'nest.dissolveHint')}
            danger
            divider
            onPress={dissolvePending ? undefined : dissolve}
          />
        </Card>
      </ScrollView>

      <RenameSheet visible={editing} onClose={() => setEditing(false)} />
      <Sheet visible={adding} onClose={() => setAdding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Text style={s.sheetTitle}>{t('family.addMember')}</Text>
          <Text style={s.sheetBody}>{t('family.addHint')}</Text>
          <LinkForm addMember onLinked={() => setAdding(false)} />
        </KeyboardAvoidingView>
      </Sheet>
    </SafeAreaView>
  );
}

function RenameSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { t } = useT();
  const { couple, isFamily, nestName } = useSavings();
  const [name, setName] = useState(couple.name ?? '');
  const [shown, setShown] = useState(false);
  const rename = useAction(backend.renameCouple);
  // Reset the field each time the sheet opens.
  if (visible && !shown) {
    setShown(true);
    setName(couple.name ?? '');
  }
  if (!visible && shown) setShown(false);

  const save = async () => {
    if (await rename.run(couple.id, name)) {
      tap('success');
      onClose();
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: spacing.md }}>
        <View>
          <Text style={s.sheetTitle}>{t('nest.editName')}</Text>
          <Text style={s.sheetBody}>{t(isFamily ? 'nest.renameFamilyHint' : 'nest.renameHint')}</Text>
        </View>
        <TextField
          label={t('nest.nameLabel')}
          icon="edit"
          value={name}
          onChangeText={setName}
          placeholder={nestName}
          maxLength={40}
          autoFocus
          onSubmitEditing={save}
        />
        <ErrorBanner message={rename.error} />
        <Button
          label={t('common.saveChanges')}
          icon="check"
          onPress={save}
          loading={rename.loading}
          disabled={name.trim() === (couple.name ?? '') || (isFamily && name.trim().length < 2)}
        />
      </View>
    </Sheet>
  );
}

function QuickButton({
  icon,
  label,
  onPress,
  danger,
  disabled,
}: {
  icon: 'edit' | 'user-plus' | 'share' | 'door' | 'unlink';
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <PressableScale containerStyle={{ flex: 1 }} style={s.quick} onPress={onPress} disabled={disabled} scaleTo={0.94}>
      <View style={[s.quickIcon, { backgroundColor: danger ? colors.dangerSoft : colors.accentSoft }]}>
        <Icon name={icon} size={20} color={danger ? colors.danger : colors.accent} />
      </View>
      <Text style={[s.quickLabel, danger && { color: colors.danger }]} numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
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

const useStyles = makeStyles(({ colors, dark, elevation }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md },
  hero: { borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center', marginTop: spacing.sm },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.md },
  heroName: { ...type.h2, color: colors.text, textAlign: 'center', flexShrink: 1 },
  editBadge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  kindPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm },
  kindText: { ...type.small, color: colors.textMuted },
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
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quick: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.xs,
    minHeight: 104,
    ...elevation,
  },
  quickIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { ...type.smallStrong, fontSize: 12, color: colors.text, textAlign: 'center' },
  section: { ...type.h2, color: colors.text, marginTop: spacing.lg + 4, marginBottom: spacing.sm + 4 },
  contribRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  contribName: { ...type.h3, color: colors.text },
  contribMeta: { ...type.small, color: colors.textMuted, marginTop: 2 },
  contribAmount: { ...type.bodyStrong, color: colors.text },
  addMember: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  addText: { ...type.bodyStrong, color: colors.accent },
  sheetTitle: { ...type.h2, color: colors.text },
  sheetBody: { ...type.small, color: colors.textMuted, marginTop: 4, marginBottom: spacing.md, lineHeight: 19 },
}));
