import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { backend } from '@/services/backend';
import { useTheme } from '@/providers/Preferences';
import { formatMoney } from '@/utils/format';
import type { Couple, User } from './types';

export interface Nest {
  couple: Couple;
  partner: User;
  /** Custom name, or "Me & Partner". */
  name: string;
}

interface Session {
  user: User | null;
  /** The active nest's couple and partner. */
  couple: Couple | null;
  partner: User | null;
  /** Every nest the user belongs to, active first. */
  nests: Nest[];
  /** Nests the user unlinked from, newest first (read-only history). */
  archived: Nest[];
}

const SessionContext = createContext<Session | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    backend.init().finally(() => setReady(true));
  }, []);

  const db = useSyncExternalStore(backend.subscribe, backend.getSnapshot, backend.getSnapshot);
  const session = useMemo<Session>(() => {
    const user = db.sessionUserId ? (db.users[db.sessionUserId] ?? null) : null;
    const nests: Nest[] = [];
    for (const id of user?.coupleIds ?? []) {
      const couple = db.couples[id];
      const partner = db.users[couple?.memberIds.find((m) => m !== user?.id) ?? ''];
      if (!user || !couple || couple.archivedAt || !partner) continue;
      nests.push({ couple, partner, name: couple.name ?? `${user.name} & ${partner.name}` });
    }
    nests.sort((a, b) => Number(b.couple.id === user?.activeCoupleId) - Number(a.couple.id === user?.activeCoupleId));
    const active = nests.find((n) => n.couple.id === user?.activeCoupleId) ?? null;
    const archived: Nest[] = [];
    for (const couple of Object.values(db.couples)) {
      if (!user || !couple.archivedAt || !couple.memberIds.includes(user.id)) continue;
      const partner = db.users[couple.memberIds.find((m) => m !== user.id) ?? ''];
      if (partner) archived.push({ couple, partner, name: couple.name ?? `${user.name} & ${partner.name}` });
    }
    archived.sort((a, b) => (b.couple.archivedAt ?? '').localeCompare(a.couple.archivedAt ?? ''));
    return { user, couple: active?.couple ?? null, partner: active?.partner ?? null, nests, archived };
  }, [db]);

  if (!ready) return null;
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within AppProvider');
  return ctx;
}

/** Savings data for the signed-in, linked couple. Only use on screens behind the "linked" guard. */
export function useSavings() {
  const { user, couple, partner } = useSession();
  const { colors } = useTheme();
  if (!user || !couple || !partner) throw new Error('useSavings requires a linked couple');

  return useMemo(() => {
    const byGoal = new Map<string | null, number>();
    const byMember: Record<string, number> = { [user.id]: 0, [partner.id]: 0 };
    let balance = 0;
    let thisMonth = 0;
    const now = new Date();

    for (const t of couple.transactions) {
      const v = t.type === 'deposit' ? t.amount : -t.amount;
      balance += v;
      byGoal.set(t.goalId, (byGoal.get(t.goalId) ?? 0) + v);
      if (t.type === 'deposit') byMember[t.by] = (byMember[t.by] ?? 0) + t.amount;
      const d = new Date(t.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) thisMonth += v;
    }

    const member = (id: string) => (id === user.id ? user : partner);
    return {
      me: user,
      partner,
      couple,
      currency: couple.currency,
      goals: couple.goals,
      transactions: couple.transactions,
      balance,
      thisMonth,
      /** Total deposited by each member (lifetime), keyed by user id. */
      byMember,
      commonFund: byGoal.get(null) ?? 0,
      savedFor: (goalId: string | null) => byGoal.get(goalId) ?? 0,
      member,
      memberColor: (id: string) => (id === user.id ? colors.me : colors.partner),
    };
  }, [user, couple, partner, colors]);
}

/** Returns a formatter bound to the couple's savings currency. */
export function useMoney() {
  const { couple } = useSession();
  const currency = couple?.currency ?? 'MXN';
  return useCallback((amount: number, opts?: { compact?: boolean }) => formatMoney(amount, currency, opts), [currency]);
}
