import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * Local notifications (no server needed): recurring-contribution reminders, a "keep your streak"
 * nudge and a monthly recap. The whole schedule is rebuilt from app state whenever it changes.
 */

const SUPPORTED = Platform.OS !== 'web';

if (SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

export const notificationsSupported = SUPPORTED;

/** Whether notifications are currently allowed (without prompting). */
export async function hasNotificationPermission() {
  if (!SUPPORTED) return false;
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Asks for permission if needed; resolves to whether notifications can be shown. */
export async function ensureNotificationPermission() {
  if (!SUPPORTED) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

export interface ScheduledReminder {
  title: string;
  body: string;
  date: Date;
}

export interface ScheduleInput {
  reminders: ScheduledReminder[];
  monthly: { title: string; body: string } | null;
}

/** Replaces every scheduled notification with the given set. No-op without permission. */
export async function syncNotifications({ reminders, monthly }: ScheduleInput) {
  if (!SUPPORTED) return;
  const { granted } = await Notifications.getPermissionsAsync();
  if (!granted) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const now = Date.now();
  for (const r of reminders) {
    if (r.date.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
    });
  }
  if (monthly) {
    await Notifications.scheduleNotificationAsync({
      content: monthly,
      trigger: { type: Notifications.SchedulableTriggerInputTypes.MONTHLY, day: 1, hour: 9, minute: 0 },
    });
  }
}
