import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Text, View } from 'react-native';

import { Confetti } from '@/components/Confetti';
import { Icon } from '@/components/Icon';
import { PetStage } from '@/components/Pet';
import { Button, tap } from '@/components/ui';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { useSession } from '@/store/SavingsContext';
import { fonts, radius, spacing, type } from '@/theme';
import {
  ACHIEVEMENTS,
  STAGE_KEYS,
  achievementDesc,
  achievementParams,
  achievementTitle,
  computeProgress,
  type AchievementId,
} from './progress';

const SEEN_KEY = 'nido/seen/v1';

type Celebration = { kind: 'achievement'; id: AchievementId } | { kind: 'evolution'; stage: number };

interface Seen {
  achievements: AchievementId[];
  stage: number;
}

/**
 * Watches the active nest's progress and celebrates newly unlocked achievements and pet
 * evolutions. The first time a nest is seen its current state is recorded silently, so
 * existing history doesn't trigger a burst of celebrations.
 */
export function CelebrationWatcher() {
  const { user, couple } = useSession();
  const [queue, setQueue] = useState<Celebration[]>([]);
  const progress = useMemo(() => (couple ? computeProgress(couple) : null), [couple]);
  const key = user && couple ? `${user.id}:${couple.id}` : null;

  useEffect(() => {
    if (!key || !progress) return;
    let cancelled = false;
    (async () => {
      const raw = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      const all: Record<string, Seen> = raw ? JSON.parse(raw) : {};
      const unlockedNow = Object.keys(progress.unlocked) as AchievementId[];
      const seen = all[key];
      all[key] = { achievements: unlockedNow, stage: progress.stage };
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(all)).catch(() => {});
      if (!seen || cancelled) return;
      const fresh: Celebration[] = unlockedNow.filter((id) => !seen.achievements.includes(id)).map((id) => ({ kind: 'achievement', id }));
      if (progress.stage > seen.stage) fresh.push({ kind: 'evolution', stage: progress.stage });
      if (fresh.length) setQueue((q) => [...q, ...fresh]);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, progress]);

  const current = queue[0];
  if (!current || !couple) return null;
  return (
    <CelebrationModal
      key={JSON.stringify(current)}
      item={current}
      petName={couple.petName}
      mood={progress?.mood ?? 'happy'}
      onClose={() => setQueue((q) => q.slice(1))}
    />
  );
}

function CelebrationModal({
  item,
  petName,
  mood,
  onClose,
}: {
  item: Celebration;
  petName: string | null;
  mood: 'happy' | 'calm' | 'sleepy' | 'sad';
  onClose: () => void;
}) {
  const currency = useSession().couple?.currency ?? 'MXN';
  const s = useStyles();
  const { colors } = useTheme();
  const { t } = useT();
  useEffect(() => tap('success'), []);

  const achievement = item.kind === 'achievement' ? ACHIEVEMENTS.find((a) => a.id === item.id) : null;
  const name = petName ?? t('pet.defaultName');

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={s.backdrop}>
        <Confetti />
        <View style={s.card}>
          {achievement ? (
            <>
              <LinearGradient colors={['#FFD166', '#FF9F1C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.badge}>
                <Icon name={achievement.icon} size={40} color="#FFFFFF" strokeWidth={2.2} />
              </LinearGradient>
              <Text style={s.kicker}>{t('pet.achievementUnlocked')}</Text>
              <Text style={s.title}>{t(achievementTitle(achievement.id))}</Text>
              <Text style={s.body}>{t(achievementDesc(achievement.id), achievementParams(achievement.id, currency))}</Text>
              <View style={s.xp}>
                <Icon name="star" size={14} color={colors.accent} />
                <Text style={s.xpText}>+{achievement.xp} XP</Text>
              </View>
            </>
          ) : (
            item.kind === 'evolution' && (
              <>
                <PetStage stage={item.stage} mood={mood === 'sad' ? 'happy' : mood} size={170} interactive={false} />
                <Text style={s.kicker}>{t(STAGE_KEYS[item.stage])}</Text>
                <Text style={s.title}>{t('pet.evolved', { name })}</Text>
                <Text style={s.body}>{t('pet.evolvedBody', { stage: t(STAGE_KEYS[item.stage]).toLowerCase() })}</Text>
              </>
            )
          )}
          <Button label={t('pet.nice')} onPress={onClose} style={{ alignSelf: 'stretch', marginTop: spacing.lg }} />
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,15,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  kicker: { ...type.tiny, color: colors.accent, textTransform: 'uppercase', marginTop: spacing.sm },
  title: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, textAlign: 'center', marginTop: 4 },
  body: { ...type.body, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 21 },
  xp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accentSoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    marginTop: spacing.md,
  },
  xpText: { ...type.smallStrong, color: colors.accent },
}));
