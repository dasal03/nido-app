import { router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSession, type Nest } from '@/store/SavingsContext';
import { radius, spacing, type } from '@/theme';
import { formatMoney, formatShortDate } from '@/utils/format';
import { useAction } from '@/utils/useAction';
import { NestAvatars } from './Avatar';
import { Icon } from './Icon';
import { Sheet } from './Sheet';
import { Button, ErrorBanner, PressableScale, TextField, tap } from './ui';

const balanceOf = (nest: Nest) =>
  formatMoney(
    nest.couple.transactions.reduce((sum, tx) => sum + (tx.type === 'deposit' ? tx.amount : -tx.amount), 0),
    nest.couple.currency,
  );

/** One nest: both avatars, its name and balance, and an "active" mark. */
export function NestRow({ nest, active, onPress, divider }: { nest: Nest; active: boolean; onPress: () => void; divider?: boolean }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  const { user } = useSession();
  if (!user) return null;
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[s.row, divider && s.divider]}>
      <NestAvatars users={nest.members} size={36} ring={colors.surface} max={3} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {nest.name}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {balanceOf(nest)} ·{' '}
          {nest.couple.kind === 'family'
            ? t(nest.members.length === 1 ? 'nest.familyMembersOne' : 'nest.familyMembers', { n: nest.members.length })
            : `@${nest.partner?.username ?? ''}`}
        </Text>
      </View>
      {active ? (
        <View style={s.activeBadge}>
          <Icon name="check" size={12} color={colors.success} strokeWidth={3} />
          <Text style={s.activeText}>{t('nests.active')}</Text>
        </View>
      ) : (
        <Icon name="chevron" size={18} color={colors.textSubtle} />
      )}
    </PressableScale>
  );
}

export function AddNestRow({ onPress }: { onPress: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  return (
    <PressableScale onPress={onPress} scaleTo={0.985} style={[s.row, s.divider]}>
      <View style={s.addIcon}>
        <Icon name="add" size={20} color={colors.accent} strokeWidth={2.4} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowName, { color: colors.accent }]}>{t('nests.add')}</Text>
        <Text style={s.rowMeta}>{t('nests.addHint')}</Text>
      </View>
    </PressableScale>
  );
}

/** Bottom sheet to switch the active nest (opened from the home header). */
export function NestSwitcherSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useStyles();
  const { t } = useT();
  const { user, nests } = useSession();

  const choose = async (nest: Nest) => {
    if (nest.couple.id !== user?.activeCoupleId) {
      tap('success');
      await backend.setActiveCouple(nest.couple.id);
    }
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={s.title}>{t('nests.switcherTitle')}</Text>
      <Text style={s.subtitle}>{t('nests.switcherSubtitle')}</Text>
      <View style={s.list}>
        {nests.map((nest, i) => (
          <NestRow
            key={nest.couple.id}
            nest={nest}
            active={nest.couple.id === user?.activeCoupleId}
            onPress={() => choose(nest)}
            divider={i > 0}
          />
        ))}
        <AddNestRow
          onPress={() => {
            onClose();
            router.push('/add-partner');
          }}
        />
      </View>
    </Sheet>
  );
}

/** Bottom sheet with actions for one nest: switch to it, rename it or unlink. */
export function NestActionsSheet({ nest, onClose }: { nest: Nest | null; onClose: () => void }) {
  const s = useStyles();
  const { colors } = useTheme();
  const { t, locale } = useT();
  const { user } = useSession();
  const [name, setName] = useState(nest?.couple.name ?? '');
  const rename = useAction(backend.renameCouple);
  const [shown, setShown] = useState(nest);
  // Keep rendering the last nest while the sheet animates closed; reset the field when a new one opens.
  if (nest && nest !== shown) {
    setShown(nest);
    setName(nest.couple.name ?? '');
  }

  if (!shown || !user)
    return (
      <Sheet visible={false} onClose={onClose}>
        {null}
      </Sheet>
    );
  const active = shown.couple.id === user.activeCoupleId;

  return (
    <Sheet visible={!!nest} onClose={onClose}>
      <View style={s.nestHeader}>
        <NestAvatars users={shown.members} size={52} ring={colors.surface} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {shown.name}
          </Text>
          <Text style={s.subtitle}>{t('nests.since', { date: formatShortDate(shown.couple.createdAt, locale) })}</Text>
        </View>
      </View>

      {!active && (
        <Button
          label={t('nests.switch')}
          icon="switch"
          onPress={async () => {
            tap('success');
            await backend.setActiveCouple(shown.couple.id);
            onClose();
          }}
          style={{ marginBottom: spacing.md }}
        />
      )}

      <View style={{ gap: spacing.sm + 2 }}>
        <TextField label={t('nests.rename')} icon="edit" value={name} onChangeText={setName} placeholder={shown.name} maxLength={40} />
        <ErrorBanner message={rename.error} />
        <Button
          label={t('nests.save')}
          variant="secondary"
          disabled={name.trim() === (shown.couple.name ?? '')}
          loading={rename.loading}
          onPress={async () => {
            if (await rename.run(shown.couple.id, name)) {
              tap('success');
              onClose();
            }
          }}
        />
      </View>

      <PressableScale
        style={s.manage}
        scaleTo={0.98}
        onPress={async () => {
          if (!active) await backend.setActiveCouple(shown.couple.id);
          onClose();
          router.navigate('/couple');
        }}>
        <Icon name="settings" size={18} color={colors.accent} />
        <Text style={s.manageText}>{t('nests.manageNest')}</Text>
      </PressableScale>
    </Sheet>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  title: { ...type.h2, color: colors.text },
  subtitle: { ...type.small, color: colors.textMuted, marginTop: 2 },
  list: { marginTop: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4, paddingVertical: spacing.sm + 5 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  rowName: { ...type.bodyStrong, color: colors.text },
  rowMeta: { ...type.small, color: colors.textMuted, marginTop: 1 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successSoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  activeText: { ...type.tiny, color: colors.success },
  addIcon: { width: 60, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  nestHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  manage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    marginTop: spacing.lg,
  },
  manageText: { ...type.bodyStrong, color: colors.accent },
}));
