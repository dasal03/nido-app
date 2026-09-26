import { formatMoney } from '@/utils/format';
import type { IconName } from '@/components/Icon';
import type { TranslationKey } from '@/i18n/es';
import type { Couple } from '@/store/types';

/**
 * Gamification derived purely from a nest's history: weekly streaks, achievements, XP and the
 * pet's evolution stage and mood. Nothing here is stored, so it can't drift out of sync.
 */

export type AchievementId =
  | 'firstDeposit'
  | 'firstGoal'
  | 'both'
  | 'tenDeposits'
  | 'streak4'
  | 'streak12'
  | 'goalComplete'
  | 'saved1k'
  | 'saved10k'
  | 'saved100k'
  | 'recurring'
  | 'cheer';

interface AchievementDef {
  id: AchievementId;
  icon: IconName;
  xp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'firstDeposit', icon: 'piggy', xp: 50 },
  { id: 'firstGoal', icon: 'target', xp: 50 },
  { id: 'both', icon: 'users', xp: 75 },
  { id: 'tenDeposits', icon: 'coins', xp: 100 },
  { id: 'streak4', icon: 'flame', xp: 100 },
  { id: 'streak12', icon: 'flame', xp: 250 },
  { id: 'goalComplete', icon: 'trophy', xp: 150 },
  { id: 'saved1k', icon: 'trend-up', xp: 75 },
  { id: 'saved10k', icon: 'star', xp: 150 },
  { id: 'saved100k', icon: 'crown', xp: 300 },
  { id: 'recurring', icon: 'repeat', xp: 75 },
  { id: 'cheer', icon: 'heart', xp: 50 },
];

export const achievementTitle = (id: AchievementId) => `ach.${id}` as TranslationKey;
export const achievementDesc = (id: AchievementId) => `ach.${id}Desc` as TranslationKey;

/**
 * Savings milestones per currency, roughly equivalent in value (1,000 / 10,000 / 100,000 MXN), so
 * a nest in COP doesn't unlock them instantly and one in USD isn't out of reach.
 */
const MILESTONES: Record<string, readonly [number, number, number]> = {
  MXN: [1_000, 10_000, 100_000],
  USD: [50, 500, 5_000],
  EUR: [50, 500, 5_000],
  COP: [200_000, 2_000_000, 20_000_000],
  ARS: [50_000, 500_000, 5_000_000],
  CLP: [50_000, 500_000, 5_000_000],
  PEN: [200, 2_000, 20_000],
  GTQ: [400, 4_000, 40_000],
};
export const balanceMilestones = (currency: string) => MILESTONES[currency] ?? MILESTONES.MXN;

/** Params for an achievement's description (the milestone amount, formatted in the nest's currency). */
export function achievementParams(id: AchievementId, currency: string): Record<string, string> {
  const index = { saved1k: 0, saved10k: 1, saved100k: 2 }[id as 'saved1k'];
  return index === undefined ? {} : { amount: formatMoney(balanceMilestones(currency)[index], currency, { compact: true }) };
}

export const XP_PER_DEPOSIT = 10;
export const XP_PER_GOAL = 100;
/** XP needed to reach each stage: egg, hatchling, chick, bird, legend. */
export const STAGE_XP = [0, 100, 300, 700, 1500];

export type Mood = 'happy' | 'calm' | 'sleepy' | 'sad';

export interface Progress {
  xp: number;
  stage: number;
  /** 0–1 progress toward the next stage (1 at the final stage). */
  stageProgress: number;
  xpToNext: number;
  mood: Mood;
  streak: number;
  bestStreak: number;
  depositedThisWeek: boolean;
  unlocked: Partial<Record<AchievementId, string>>;
}

/** Monday 00:00 of the week containing `date`, as a sortable key. */
function weekStart(date: Date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

const WEEK = 7 * 86_400_000;

export function computeProgress(couple: Couple, now = new Date()): Progress {
  const chronological = [...couple.transactions].sort((a, b) => a.date.localeCompare(b.date));
  const unlocked: Partial<Record<AchievementId, string>> = {};
  const unlock = (id: AchievementId, date: string) => {
    unlocked[id] ??= date;
  };

  // Walk the history once, unlocking achievements at the moment they were earned.
  const milestones = balanceMilestones(couple.currency);
  let balance = 0;
  let deposits = 0;
  const depositors = new Set<string>();
  const savedPerGoal = new Map<string, number>();
  const weeks = new Set<number>();
  let run = 0;
  let bestStreak = 0;
  let lastWeek: number | null = null;
  let completedGoals = 0;
  const completed = new Set<string>();

  for (const tx of chronological) {
    const signed = tx.type === 'deposit' ? tx.amount : -tx.amount;
    balance += signed;
    if (tx.goalId) savedPerGoal.set(tx.goalId, (savedPerGoal.get(tx.goalId) ?? 0) + signed);

    if (tx.type === 'deposit') {
      deposits += 1;
      depositors.add(tx.by);
      unlock('firstDeposit', tx.date);
      if (depositors.size >= 2) unlock('both', tx.date);
      if (deposits >= 10) unlock('tenDeposits', tx.date);

      const week = weekStart(new Date(tx.date));
      if (!weeks.has(week)) {
        weeks.add(week);
        run = lastWeek !== null && week - lastWeek === WEEK ? run + 1 : 1;
        lastWeek = week;
        bestStreak = Math.max(bestStreak, run);
        if (run >= 4) unlock('streak4', tx.date);
        if (run >= 12) unlock('streak12', tx.date);
      }
    }

    if (balance >= milestones[0]) unlock('saved1k', tx.date);
    if (balance >= milestones[1]) unlock('saved10k', tx.date);
    if (balance >= milestones[2]) unlock('saved100k', tx.date);

    const goal = tx.goalId ? couple.goals.find((g) => g.id === tx.goalId) : undefined;
    if (goal && !completed.has(goal.id) && (savedPerGoal.get(goal.id) ?? 0) >= goal.target) {
      completed.add(goal.id);
      completedGoals += 1;
      unlock('goalComplete', tx.date);
    }

    if (Object.keys(tx.reactions).length > 0 || tx.comments.length > 0) unlock('cheer', tx.comments[0]?.date ?? tx.date);
  }

  const firstGoal = [...couple.goals].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (firstGoal) unlock('firstGoal', firstGoal.createdAt);
  const firstRule = [...couple.recurring].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
  if (firstRule) unlock('recurring', firstRule.createdAt);

  // Current streak: counts back from this week, or from last week if nothing yet this week.
  const thisWeek = weekStart(now);
  const depositedThisWeek = weeks.has(thisWeek);
  let streak = 0;
  for (let w = depositedThisWeek ? thisWeek : thisWeek - WEEK; weeks.has(w); w -= WEEK) streak += 1;

  const achievementXp = ACHIEVEMENTS.reduce((sum, a) => sum + (unlocked[a.id] ? a.xp : 0), 0);
  const xp = deposits * XP_PER_DEPOSIT + completedGoals * XP_PER_GOAL + achievementXp;

  let stage = 0;
  while (stage < STAGE_XP.length - 1 && xp >= STAGE_XP[stage + 1]) stage += 1;
  const next = STAGE_XP[stage + 1];
  const stageProgress = next === undefined ? 1 : (xp - STAGE_XP[stage]) / (next - STAGE_XP[stage]);

  const lastDeposit = [...chronological].reverse().find((tx) => tx.type === 'deposit');
  const idleDays = lastDeposit ? (now.getTime() - new Date(lastDeposit.date).getTime()) / 86_400_000 : Infinity;
  const mood: Mood = idleDays <= 7 ? 'happy' : idleDays <= 14 ? 'calm' : idleDays <= 30 ? 'sleepy' : 'sad';

  return {
    xp,
    stage,
    stageProgress,
    xpToNext: next === undefined ? 0 : next - xp,
    mood,
    streak,
    bestStreak,
    depositedThisWeek,
    unlocked,
  };
}

export const STAGE_KEYS: TranslationKey[] = ['pet.stage0', 'pet.stage1', 'pet.stage2', 'pet.stage3', 'pet.stage4'];
export const MOOD_KEYS: Record<Mood, TranslationKey> = {
  happy: 'pet.moodHappy',
  calm: 'pet.moodCalm',
  sleepy: 'pet.moodSleepy',
  sad: 'pet.moodSad',
};
export const SAY_KEYS: Record<Mood, TranslationKey> = {
  happy: 'pet.sayHappy',
  calm: 'pet.sayCalm',
  sleepy: 'pet.saySleepy',
  sad: 'pet.saySad',
};
