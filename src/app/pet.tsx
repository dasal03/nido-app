import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { PetStage } from '@/components/Pet';
import { Sheet } from '@/components/Sheet';
import { Button, Card, IconButton, ProgressBar, ScreenHeader, TextField, tap } from '@/components/ui';
import {
  ACHIEVEMENTS,
  MOOD_KEYS,
  SAY_KEYS,
  STAGE_KEYS,
  STAGE_XP,
  XP_PER_DEPOSIT,
  XP_PER_GOAL,
  achievementDesc,
  achievementTitle,
} from '@/game/progress';
import { useProgress } from '@/game/useProgress';
import { makeStyles, useT, useTheme } from '@/providers/Preferences';
import { backend } from '@/services/backend';
import { useSavings } from '@/store/SavingsContext';
import { fonts, radius, spacing, type } from '@/theme';
import { formatShortDate } from '@/utils/format';
import { goBack } from '@/utils/navigation';

export default function PetScreen() {
  const s = useStyles();
  const { colors, dark } = useTheme();
  const { t, locale } = useT();
  const { couple } = useSavings();
  const p = useProgress();
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(couple.petName ?? '');
  const name = couple.petName ?? t('pet.defaultName');
  const unlockedCount = Object.keys(p.unlocked).length;
  const phrases = p.stage === 0 ? [t('pet.sayEgg')] : [t(SAY_KEYS[p.mood]), t('pet.sayTap1'), t('pet.sayTap2'), t('pet.sayTap3')];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader title={t('pet.title')} onLeading={goBack} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={dark ? ['#1B2140', '#101626'] : ['#FFF3CF', '#EAF2FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.stage}>
          <View style={s.stageTop}>
            <View style={s.levelPill}>
              <Text style={s.levelText}>{t('pet.level', { n: p.stage + 1 })}</Text>
            </View>
            <View style={s.levelPill}>
              <Icon name="flame" size={14} color="#FF6B2C" strokeWidth={2.4} />
              <Text style={[s.levelText, { color: '#FF6B2C' }]}>{t('pet.streakWeeks', { n: p.streak })}</Text>
            </View>
          </View>
          <View style={s.petArea}>
            <PetStage stage={p.stage} mood={p.mood} size={200} crack={p.stageProgress} phrases={phrases} />
          </View>
          <Text style={s.tapHint}>👆 {t('pet.tapHint')}</Text>
          <View style={s.nameRow}>
            <Text style={s.name}>{name}</Text>
            <IconButton
              icon="edit"
              label={t('pet.rename')}
              onPress={() => {
                setDraft(couple.petName ?? '');
                setRenaming(true);
              }}
            />
          </View>
          <Text style={s.stageName}>
            {t(STAGE_KEYS[p.stage])} · {t(MOOD_KEYS[p.mood])}
          </Text>
        </LinearGradient>

        <Card style={{ gap: spacing.sm + 2 }}>
          <View style={s.xpRow}>
            <Text style={s.xpValue}>{t('pet.xp', { xp: p.xp })}</Text>
            <Text style={s.xpNext}>{p.xpToNext > 0 ? t('pet.toNext', { xp: p.xpToNext }) : t('pet.maxed')}</Text>
          </View>
          <ProgressBar progress={p.stageProgress} color="#FFB703" height={10} />
          <View style={s.stages}>
            {STAGE_KEYS.map((key, i) => (
              <View key={key} style={s.stageDot}>
                <View style={[s.dot, i <= p.stage && s.dotOn]} />
                <Text style={[s.stageLabel, i === p.stage && { color: colors.text }]} numberOfLines={1}>
                  {t(key)}
                </Text>
                <Text style={s.stageXp}>{STAGE_XP[i]}</Text>
              </View>
            ))}
          </View>
        </Card>

        <View style={s.statsRow}>
          <Card style={s.stat}>
            <Icon name="flame" size={22} color="#FF6B2C" />
            <Text style={s.statValue}>{t('pet.streakWeeks', { n: p.streak })}</Text>
            <Text style={s.statLabel}>{t('pet.streakHint')}</Text>
            <Text style={s.statFoot}>{t('pet.best', { n: p.bestStreak })}</Text>
          </Card>
          <Card style={s.stat}>
            <Icon name="trophy" size={22} color="#FFB703" />
            <Text style={s.statValue}>{t('pet.unlocked', { n: unlockedCount, total: ACHIEVEMENTS.length })}</Text>
            <Text style={s.statLabel}>{t('pet.achievements')}</Text>
          </Card>
        </View>

        <Text style={s.section}>{t('pet.howTitle')}</Text>
        <Card style={{ gap: spacing.sm + 4 }}>
          <XpRule icon="piggy" label={t('pet.howDeposit')} xp={`+${XP_PER_DEPOSIT}`} />
          <XpRule icon="trophy" label={t('pet.howAchievement')} xp="+50–300" />
          <XpRule icon="target" label={t('pet.howGoal')} xp={`+${XP_PER_GOAL}`} />
        </Card>

        <Text style={s.section}>{t('pet.achievements')}</Text>
        <View style={s.grid}>
          {ACHIEVEMENTS.map((a) => {
            const date = p.unlocked[a.id];
            return (
              <View key={a.id} style={[s.badge, !date && s.badgeLocked]}>
                {date ? (
                  <LinearGradient colors={['#FFD166', '#FF9F1C']} style={s.badgeIcon}>
                    <Icon name={a.icon} size={22} color="#FFFFFF" strokeWidth={2.2} />
                  </LinearGradient>
                ) : (
                  <View style={[s.badgeIcon, { backgroundColor: colors.surfaceAlt }]}>
                    <Icon name="lock" size={18} color={colors.textSubtle} />
                  </View>
                )}
                <Text style={s.badgeTitle} numberOfLines={1}>
                  {t(achievementTitle(a.id))}
                </Text>
                <Text style={s.badgeDesc} numberOfLines={2}>
                  {date ? formatShortDate(date, locale) : t(achievementDesc(a.id))}
                </Text>
                <Text style={[s.badgeXp, !date && { color: colors.textSubtle }]}>+{a.xp} XP</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Sheet visible={renaming} onClose={() => setRenaming(false)}>
        <View style={{ gap: spacing.md }}>
          <TextField label={t('pet.rename')} icon="edit" value={draft} onChangeText={setDraft} placeholder={t('pet.defaultName')} maxLength={16} autoFocus />
          <Button
            label={t('pet.save')}
            icon="check"
            onPress={async () => {
              await backend.renamePet(draft);
              tap('success');
              setRenaming(false);
            }}
          />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function XpRule({ icon, label, xp }: { icon: 'piggy' | 'trophy' | 'target'; label: string; xp: string }) {
  const s = useStyles();
  const { colors } = useTheme();
  return (
    <View style={s.rule}>
      <View style={s.ruleIcon}>
        <Icon name={icon} size={18} color={colors.accent} />
      </View>
      <Text style={s.ruleLabel}>{label}</Text>
      <Text style={s.ruleXp}>{xp} XP</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors, dark }) => ({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2, gap: spacing.md },
  stage: { borderRadius: radius.lg, padding: spacing.md, alignItems: 'center' },
  stageTop: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch' },
  levelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  levelText: { ...type.smallStrong, color: colors.text },
  petArea: { marginTop: spacing.xl, height: 210, justifyContent: 'flex-end' },
  tapHint: { ...type.small, fontSize: 12, color: colors.textSubtle, marginTop: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  name: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.5 },
  stageName: { ...type.bodyStrong, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  xpValue: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text },
  xpNext: { ...type.small, color: colors.textMuted },
  stages: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  stageDot: { alignItems: 'center', flex: 1, gap: 3 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border },
  dotOn: { backgroundColor: '#FFB703', borderColor: '#FFB703' },
  stageLabel: { ...type.small, fontSize: 11, color: colors.textSubtle },
  stageXp: { ...type.tiny, fontSize: 10, color: colors.textSubtle },
  statsRow: { flexDirection: 'row', gap: spacing.sm + 4 },
  stat: { flex: 1, gap: 4 },
  statValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, marginTop: 4 },
  statLabel: { ...type.small, fontSize: 12, color: colors.textMuted, lineHeight: 16 },
  statFoot: { ...type.smallStrong, fontSize: 11, color: colors.textSubtle, marginTop: 2 },
  section: { ...type.h2, color: colors.text, marginTop: spacing.sm },
  rule: { flexDirection: 'row', alignItems: 'center', gap: spacing.md - 4 },
  ruleIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  ruleLabel: { ...type.body, color: colors.text, flex: 1 },
  ruleXp: { ...type.bodyStrong, color: '#E09B00' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm + 2 },
  badge: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badgeLocked: { opacity: 0.7 },
  badgeIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  badgeTitle: { ...type.smallStrong, fontSize: 12, color: colors.text, textAlign: 'center' },
  badgeDesc: { ...type.small, fontSize: 10, color: colors.textMuted, textAlign: 'center', lineHeight: 13, minHeight: 26 },
  badgeXp: { ...type.tiny, fontSize: 10, color: '#E09B00' },
}));
