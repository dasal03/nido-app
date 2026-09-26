import { useEffect, useRef } from 'react';

import { useT } from '@/providers/Preferences';
import { notifyNow } from '@/services/notifications';
import { firstName, useSession } from '@/store/SavingsContext';
import { formatMoney } from '@/utils/format';

/**
 * Notifies when another member creates a request that needs the user's approval, in any nest.
 * Works while the app is open or recently backgrounded (it reacts to realtime changes).
 */
export function RequestNotifier() {
  const { user, nests } = useSession();
  const { t } = useT();
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!user) return;
    const waiting = nests.flatMap((nest) =>
      nest.couple.requests.filter((r) => r.status === 'pending' && !r.approvals.includes(user.id)).map((request) => ({ nest, request })),
    );
    // Requests that already existed when the app opened don't trigger a notification.
    if (!seen.current) {
      seen.current = new Set(waiting.map((w) => w.request.id));
      return;
    }
    for (const { nest, request } of waiting) {
      if (seen.current.has(request.id)) continue;
      seen.current.add(request.id);
      const name = firstName(nest.members.find((m) => m.id === request.by)?.name ?? '');
      const body =
        request.kind === 'withdraw'
          ? t('requests.withdrawTitle', { name, amount: formatMoney(request.amount ?? 0, nest.couple.currency) })
          : request.kind === 'leave'
            ? t('requests.leaveTitle', { name })
            : t(nest.couple.kind === 'family' ? 'requests.dissolveFamilyTitle' : 'requests.dissolveTitle', { name });
      notifyNow(t('requests.notifTitle', { nest: nest.name }), body).catch(() => {});
    }
  }, [user, nests, t]);

  return null;
}
