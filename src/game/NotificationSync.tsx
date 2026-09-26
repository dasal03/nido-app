import { useEffect } from 'react';

import { usePreferences } from '@/providers/Preferences';
import { syncNotifications, type ScheduledReminder } from '@/services/notifications';
import { useSession } from '@/store/SavingsContext';
import { formatMoney } from '@/utils/format';
import { computeProgress } from './progress';

/** Keeps the local notification schedule in sync with the active nest and the user's preferences. */
export function NotificationSync() {
  const { user, couple } = useSession();
  const { prefs, t } = usePreferences();

  useEffect(() => {
    if (!user || !couple) return;
    const reminders: ScheduledReminder[] = [];

    if (prefs.reminders) {
      for (const rule of couple.recurring) {
        if (!rule.active || rule.by !== user.id) continue;
        const date = new Date(rule.nextDate);
        date.setHours(9, 0, 0, 0);
        const goal = couple.goals.find((g) => g.id === rule.goalId);
        reminders.push({
          title: t('recurring.notifTitle'),
          body: t('recurring.notifBody', { amount: formatMoney(rule.amount, couple.currency), dest: goal?.name ?? t('common.commonFund') }),
          date,
        });
      }

      // Sunday-evening nudge when the streak is alive but nobody has contributed this week.
      const progress = computeProgress(couple);
      if (progress.streak > 0 && !progress.depositedThisWeek) {
        const sunday = new Date();
        sunday.setDate(sunday.getDate() + ((7 - sunday.getDay()) % 7));
        sunday.setHours(18, 0, 0, 0);
        reminders.push({ title: t('notif.streakTitle'), body: t('notif.streakBody', { n: progress.streak }), date: sunday });
      }
    }

    syncNotifications({
      reminders,
      monthly: prefs.monthlyRecap ? { title: t('notif.monthlyTitle'), body: t('notif.monthlyBody') } : null,
    }).catch(() => {});
  }, [user, couple, prefs.reminders, prefs.monthlyRecap, t]);

  return null;
}
