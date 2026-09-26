import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { backend } from '@/services/backend';
import { useT, useTheme } from '@/providers/Preferences';
import { memberPalette } from '@/theme';
import { formatMoney } from '@/utils/format';
import type { Couple, User } from './types';

export interface Nest {
  couple: Couple;
  /** Everyone in the nest, the signed-in user first. */
  members: User[];
  /** The other members (for a couple, just the partner). */
  others: User[];
  /** The couple's partner, or the first other member of a family. */
  partner: User | null;
  /** Custom name, "Diego y Angélica" for a couple, or the family's name. */
  name: string;
}

interface Session {
  user: User | null;
  /** The active nest. */
  couple: Couple | null;
  partner: User | null;
  nest: Nest | null;
  /** Every nest the user belongs to, active first. */
  nests: Nest[];
  /** Nests that were dissolved or left, newest first (read-only history). */
  archived: Nest[];
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "Diego", "Diego y Angie", "Diego, Angie y Ana". */
export const joinNames = (names: string[], and: string) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} ${and} ${names[names.length - 1]}`;

const SessionContext = createContext<Session | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    backend.init().finally(() => setReady(true));
  }, []);

  const { t } = useT();
  const db = useSyncExternalStore(backend.subscribe, backend.getSnapshot, backend.getSnapshot);
  const session = useMemo<Session>(() => {
    const user = db.sessionUserId ? (db.users[db.sessionUserId] ?? null) : null;
    const toNest = (couple: Couple): Nest | null => {
      if (!user || !couple.memberIds.includes(user.id)) return null;
      const others = couple.memberIds.filter((id) => id !== user.id).flatMap((id) => (db.users[id] ? [db.users[id]] : []));
      if (couple.kind === 'couple' && !others.length) return null;
      const fallback =
        couple.kind === 'family' ? t('family.defaultName') : [user, ...others].map((m) => firstName(m.name)).join(` ${t('common.and')} `);
      return { couple, members: [user, ...others], others, partner: others[0] ?? null, name: couple.name ?? fallback };
    };
    const nests: Nest[] = [];
    for (const id of user?.coupleIds ?? []) {
      const couple = db.couples[id];
      const nest = couple && !couple.archivedAt ? toNest(couple) : null;
      if (nest) nests.push(nest);
    }
    nests.sort((a, b) => Number(b.couple.id === user?.activeCoupleId) - Number(a.couple.id === user?.activeCoupleId));
    const active = nests.find((n) => n.couple.id === user?.activeCoupleId) ?? null;
    const archived: Nest[] = [];
    for (const couple of Object.values(db.couples)) {
      const nest = couple.archivedAt ? toNest(couple) : null;
      if (nest) archived.push(nest);
    }
    archived.sort((a, b) => (b.couple.archivedAt ?? '').localeCompare(a.couple.archivedAt ?? ''));
    return { user, couple: active?.couple ?? null, partner: active?.partner ?? null, nest: active, nests, archived };
  }, [db, t]);

  if (!ready) return null;
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within AppProvider');
  return ctx;
}

/** Savings data for the signed-in user's active nest. Only use on screens behind the "linked" guard. */
export function useSavings() {
  const { user, nest } = useSession();
  const { colors } = useTheme();
  const { t } = useT();
  if (!user || !nest) throw new Error('useSavings requires an active nest');

  return useMemo(() => {
    const { couple, members, others, partner } = nest;
    const byGoal = new Map<string | null, number>();
    const byMember: Record<string, number> = Object.fromEntries(members.map((m) => [m.id, 0]));
    let balance = 0;
    let thisMonth = 0;
    const now = new Date();

    for (const tx of couple.transactions) {
      const v = tx.type === 'deposit' ? tx.amount : -tx.amount;
      balance += v;
      byGoal.set(tx.goalId, (byGoal.get(tx.goalId) ?? 0) + v);
      if (tx.type === 'deposit') byMember[tx.by] = (byMember[tx.by] ?? 0) + tx.amount;
      const d = new Date(tx.date);
      if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) thisMonth += v;
    }

    const palette = memberPalette(colors);
    const index = new Map(members.map((m, i) => [m.id, i]));
    /** People who left a family keep their movements; they show as "former member". */
    const formerMember = (id: string): User => ({ ...user, id, name: t('family.formerMember'), username: '', photo: null, code: '' });
    const pending = couple.requests.filter((r) => r.status === 'pending');
    return {
      me: user,
      partner,
      members,
      others,
      isFamily: couple.kind === 'family',
      nestName: nest.name,
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
      member: (id: string) => members.find((m) => m.id === id) ?? formerMember(id),
      memberColor: (id: string) => (index.has(id) ? palette[index.get(id)! % palette.length] : colors.textSubtle),
      /** Pending approval requests, and those waiting for the signed-in user. */
      pending,
      needsMyApproval: pending.filter((r) => !r.approvals.includes(user.id)),
    };
  }, [user, nest, colors, t]);
}

/** Returns a formatter bound to the couple's savings currency. */
export function useMoney() {
  const { couple } = useSession();
  const currency = couple?.currency ?? 'MXN';
  return useCallback((amount: number, opts?: { compact?: boolean }) => formatMoney(amount, currency, opts), [currency]);
}
