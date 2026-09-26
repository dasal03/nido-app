import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { MOOD_KEYS, STAGE_KEYS } from '@/game/progress';
import { useProgress } from '@/game/useProgress';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useSavings } from '@/store/SavingsContext';
import { fonts, radius, spacing, type } from '@/theme';
import { Icon } from './Icon';
import { PetStage } from './Pet';
import { PressableScale, ProgressBar } from './ui';

/** Home widget: the pet, its stage/level, mood, streak and XP bar. Opens the pet screen. */
export function PetCard() {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t } = useT();
  const { couple } = useSavings();
  const p = useProgress();
  const name = couple.petName ?? t('pet.defaultName');

  return (
    <PressableScale onPress={() => router.push('/pet')} scaleTo={0.98} style={s.card}>
      <LinearGradient colors={dark ? ['#1B2140', '#131824'] : ['#FFF6DA', '#FFFFFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.petWrap}>
        <PetStage stage={p.stage} mood={p.mood} size={84} crack={p.stageProgress} interactive={false} />
      </LinearGradient>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={s.titleRow}>
          <Text style={s.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={s.streak}>
            <Icon name="flame" size={13} color={p.streak > 0 ? '#FF6B2C' : colors.textSubtle} strokeWidth={2.4} />
            <Text style={[s.streakText, p.streak === 0 && { color: colors.textSubtle }]}>{p.streak}</Text>
          </View>
        </View>
        <Text style={s.meta} numberOfLines={1}>
          {t(STAGE_KEYS[p.stage])} · {t('pet.level', { n: p.stage + 1 })} · {t(MOOD_KEYS[p.mood])}
        </Text>
        <ProgressBar progress={p.stageProgress} color="#FFB703" height={7} />
        <Text style={s.xp}>{p.xpToNext > 0 ? t('pet.toNext', { xp: p.xpToNext }) : t('pet.maxed')}</Text>
      </View>
    </PressableScale>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 2,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
    ...elevation,
  },
  petWrap: { width: 96, height: 96, borderRadius: 24, alignItems: 'center', justifyContent: 'center', paddingTop: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  name: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, flexShrink: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: colors.surfaceAlt, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  streakText: { ...type.smallStrong, color: '#FF6B2C' },
  meta: { ...type.small, fontSize: 12, color: colors.textMuted },
  xp: { ...type.small, fontSize: 11, color: colors.textSubtle },
}));
