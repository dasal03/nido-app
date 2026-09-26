/**
 * Local backend: accounts, sessions, couple linking and savings data, persisted on the device.
 *
 * Screens only talk to this module, so it can be swapped for a real server (Supabase, Firebase…)
 * to link accounts across different phones, keeping the same function signatures.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import type { TranslationKey } from '@/i18n/es';
import { buildDemoData } from '@/store/seed';
import type { Couple, Frequency, Goal, RecurringRule, Transaction, User } from '@/store/types';

const STORAGE_KEY = 'nido/db/v2';
const LEGACY_KEYS = ['nido/state/v1'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface UserRecord extends User {
  passwordHash: string;
  salt: string;
}

export interface Db {
  users: Record<string, UserRecord>;
  couples: Record<string, Couple>;
  sessionUserId: string | null;
}

type ErrorKey = Extract<TranslationKey, `errors.${string}`>;

/** Error with a translation key, so the UI can show it in the user's language. */
export class BackendError extends Error {
  constructor(public key: ErrorKey) {
    super(key);
  }
}

let db: Db = { users: {}, couples: {}, sessionUserId: null };
const listeners = new Set<() => void>();

function commit(next: Db) {
  db = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(db)).catch(() => {});
}

function requireUser() {
  const user = db.sessionUserId ? db.users[db.sessionUserId] : undefined;
  if (!user) throw new BackendError('errors.sessionExpired');
  return user;
}

function requireCouple() {
  const user = requireUser();
  const couple = user.activeCoupleId ? db.couples[user.activeCoupleId] : undefined;
  if (!couple) throw new BackendError('errors.notLinked');
  return { user, couple };
}

/** A nest the signed-in user belongs to (active or not). */
function requireMembership(coupleId: string) {
  const user = requireUser();
  const couple = db.couples[coupleId];
  if (!couple || couple.archivedAt || !user.coupleIds.includes(coupleId)) throw new BackendError('errors.notLinked');
  return { user, couple };
}

function updateCouple(couple: Couple, patch: Partial<Couple>) {
  commit({ ...db, couples: { ...db.couples, [couple.id]: { ...couple, ...patch } } });
}

const hash = (password: string, salt: string) =>
  Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

function generateCode() {
  const taken = new Set(Object.values(db.users).map((u) => u.code));
  let code: string;
  do {
    const bytes = Crypto.getRandomBytes(5);
    code = 'NIDO-' + Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  } while (taken.has(code));
  return code;
}

async function createUser(input: { name: string; username: string; email: string; phone: string; password: string }): Promise<UserRecord> {
  const salt = Crypto.randomUUID();
  return {
    id: Crypto.randomUUID(),
    code: generateCode(),
    name: input.name,
    username: input.username,
    email: input.email,
    phone: input.phone,
    birthday: '',
    photo: null,
    coupleIds: [],
    activeCoupleId: null,
    createdAt: new Date().toISOString(),
    salt,
    passwordHash: await hash(input.password, salt),
  };
}

/** Creates a nest for `a` (who initiates, and switches to it) and `b`, who keeps their active nest if they have one. */
function linkUsers(a: UserRecord, b: UserRecord, seed?: Pick<Couple, 'goals' | 'transactions'>) {
  const active = a.activeCoupleId ? db.couples[a.activeCoupleId] : undefined;
  const couple: Couple = {
    id: Crypto.randomUUID(),
    name: null,
    memberIds: [a.id, b.id],
    currency: active?.currency ?? 'MXN',
    createdAt: new Date().toISOString(),
    archivedAt: null,
    goals: seed?.goals ?? [],
    transactions: seed?.transactions ?? [],
    recurring: [],
    split: null,
    petName: null,
  };
  commit({
    ...db,
    users: {
      ...db.users,
      [a.id]: { ...a, coupleIds: [...a.coupleIds, couple.id], activeCoupleId: couple.id },
      [b.id]: { ...b, coupleIds: [...b.coupleIds, couple.id], activeCoupleId: b.activeCoupleId ?? couple.id },
    },
    couples: { ...db.couples, [couple.id]: couple },
  });
}

/** True when both users already share a nest that hasn't been unlinked. */
function alreadyLinked(a: User, b: User) {
  return a.coupleIds.some((id) => b.coupleIds.includes(id) && !db.couples[id]?.archivedAt);
}

/** Next occurrence of a recurring date, never earlier than tomorrow (skips missed periods). */
export function advanceDate(iso: string, frequency: Frequency) {
  const d = new Date(iso);
  const now = new Date();
  do {
    if (frequency === 'weekly') d.setDate(d.getDate() + 7);
    else if (frequency === 'biweekly') d.setDate(d.getDate() + 14);
    else d.setMonth(d.getMonth() + 1);
  } while (d <= now);
  return d.toISOString();
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeUsername = (username: string) => username.trim().toLowerCase().replace(/^@/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-z0-9._]{3,20}$/;

function validUsername(raw: string, exceptId?: string) {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) throw new BackendError('errors.usernameInvalid');
  if (Object.values(db.users).some((u) => u.username === username && u.id !== exceptId)) throw new BackendError('errors.usernameTaken');
  return username;
}

function validPhone(raw: string) {
  const phone = raw.trim();
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) throw new BackendError('errors.phoneInvalid');
  return phone;
}

/** Derives a unique username from an email, for accounts created before usernames existed. */
function usernameFromEmail(email: string, taken: Set<string>) {
  const base = (email.split('@')[0] ?? 'user').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 16).padEnd(3, '0');
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}${i}`;
  taken.add(candidate);
  return candidate;
}

export const backend = {
  async init() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) db = JSON.parse(raw);
      // Migration: accounts created before usernames existed get one derived from their email.
      const taken = new Set(Object.values(db.users).map((u) => u.username).filter(Boolean));
      for (const u of Object.values(db.users)) if (!u.username) u.username = usernameFromEmail(u.email, taken);
      // Migration: single `coupleId` → list of nests plus an active one.
      for (const u of Object.values(db.users) as (UserRecord & { coupleId?: string | null })[]) {
        if (!u.coupleIds) {
          u.coupleIds = u.coupleId ? [u.coupleId] : [];
          u.activeCoupleId = u.coupleId ?? null;
          delete u.coupleId;
        }
      }
      for (const c of Object.values(db.couples)) {
        c.name ??= null;
        c.archivedAt ??= null;
        c.recurring ??= [];
        c.split ??= null;
        c.petName ??= null;
        for (const tx of c.transactions) {
          tx.reactions ??= {};
          tx.comments ??= [];
        }
      }
      await AsyncStorage.multiRemove(LEGACY_KEYS);
    } catch {
      // Corrupt or unavailable storage: start fresh.
    }
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot: () => db,

  async register(input: { name: string; username: string; email: string; phone: string; password: string }) {
    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    if (!name) throw new BackendError('errors.nameRequired');
    const username = validUsername(input.username);
    if (!EMAIL_RE.test(email)) throw new BackendError('errors.invalidEmail');
    if (Object.values(db.users).some((u) => u.email === email)) throw new BackendError('errors.emailTaken');
    const phone = validPhone(input.phone);
    if (input.password.length < 6) throw new BackendError('errors.weakPassword');
    const user = await createUser({ name, username, email, phone, password: input.password });
    commit({ ...db, users: { ...db.users, [user.id]: user }, sessionUserId: user.id });
  },

  /** Signs in with either the email or the username (with or without a leading "@"). */
  async login(input: { identifier: string; password: string }) {
    const id = input.identifier.trim().toLowerCase();
    const user = Object.values(db.users).find((u) => (EMAIL_RE.test(id) ? u.email === id : u.username === normalizeUsername(id)));
    if (!user || (await hash(input.password, user.salt)) !== user.passwordHash) {
      throw new BackendError('errors.badCredentials');
    }
    commit({ ...db, sessionUserId: user.id });
  },

  async logout() {
    commit({ ...db, sessionUserId: null });
  },

  async updateProfile(patch: Partial<Pick<User, 'name' | 'username' | 'phone' | 'birthday' | 'photo'>>) {
    const user = requireUser();
    const next = { ...patch };
    if (next.name !== undefined && !next.name.trim()) throw new BackendError('errors.nameRequired');
    if (next.username !== undefined) next.username = validUsername(next.username, user.id);
    if (next.phone !== undefined) next.phone = validPhone(next.phone);
    commit({ ...db, users: { ...db.users, [user.id]: { ...user, ...next } } });
  },

  async linkWithCode(rawCode: string) {
    const me = requireUser();
    let code = rawCode.trim().toUpperCase().replace(/\s+/g, '');
    if (code && !code.startsWith('NIDO-')) code = `NIDO-${code.replace(/^NIDO/, '')}`;
    if (code === me.code) throw new BackendError('errors.ownCode');
    const partner = Object.values(db.users).find((u) => u.code === code);
    if (!partner) throw new BackendError('errors.codeNotFound');
    if (alreadyLinked(me, partner)) throw new BackendError('errors.alreadyLinkedWith');
    linkUsers(me, partner);
  },

  /** Creates an example partner account with sample goals so the app can be explored alone. */
  async linkDemoPartner() {
    const me = requireUser();
    const stamp = Date.now().toString(36);
    const partner = await createUser({
      name: 'Ana',
      username: `ana.${stamp}`,
      email: `ana.demo+${stamp}@nido.app`,
      phone: '+52 55 0000 0000',
      password: Crypto.randomUUID(),
    });
    db = { ...db, users: { ...db.users, [partner.id]: partner } };
    linkUsers(me, partner, buildDemoData(me.id, partner.id));
  },

  /** Switches the nest shown in the app. */
  async setActiveCouple(coupleId: string) {
    const { user } = requireMembership(coupleId);
    commit({ ...db, users: { ...db.users, [user.id]: { ...user, activeCoupleId: coupleId } } });
  },

  async renameCouple(coupleId: string, name: string) {
    const { couple } = requireMembership(coupleId);
    updateCouple(couple, { name: name.trim() || null });
  },

  /**
   * Ends a nest for both members. Its history is archived (hidden, not deleted) and each member
   * falls back to another nest, or to the linking screen if it was their only one.
   */
  async unlinkCouple(coupleId: string) {
    const { couple } = requireMembership(coupleId);
    const users = { ...db.users };
    for (const memberId of couple.memberIds) {
      const member = users[memberId];
      if (!member) continue;
      const coupleIds = member.coupleIds.filter((id) => id !== coupleId);
      const activeCoupleId = member.activeCoupleId === coupleId ? (coupleIds[0] ?? null) : member.activeCoupleId;
      users[memberId] = { ...member, coupleIds, activeCoupleId };
    }
    commit({ ...db, users, couples: { ...db.couples, [coupleId]: { ...couple, archivedAt: new Date().toISOString() } } });
  },

  async setCurrency(currency: string) {
    const { couple } = requireCouple();
    updateCouple(couple, { currency });
  },

  async addGoal(goal: Omit<Goal, 'id' | 'createdAt'>) {
    const { couple } = requireCouple();
    updateCouple(couple, { goals: [...couple.goals, { ...goal, id: Crypto.randomUUID(), createdAt: new Date().toISOString() }] });
  },

  async deleteGoal(id: string) {
    const { couple } = requireCouple();
    // Money saved in a deleted goal flows back into the common fund.
    updateCouple(couple, {
      goals: couple.goals.filter((g) => g.id !== id),
      transactions: couple.transactions.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
    });
  },

  /** Records a movement on behalf of the signed-in user. */
  async addTransaction(tx: Pick<Transaction, 'type' | 'amount' | 'goalId' | 'note'> & { recurringId?: string }) {
    const { user, couple } = requireCouple();
    if (!(tx.amount > 0)) throw new BackendError('errors.amountPositive');
    const entry: Transaction = { ...tx, id: Crypto.randomUUID(), by: user.id, date: new Date().toISOString(), reactions: {}, comments: [] };
    updateCouple(couple, { transactions: [entry, ...couple.transactions] });
  },

  /** Toggles the signed-in user's emoji reaction on a movement. */
  async react(txId: string, emoji: string) {
    const { user, couple } = requireCouple();
    updateCouple(couple, {
      transactions: couple.transactions.map((tx) => {
        if (tx.id !== txId) return tx;
        const reactions = { ...tx.reactions };
        if (reactions[user.id] === emoji) delete reactions[user.id];
        else reactions[user.id] = emoji;
        return { ...tx, reactions };
      }),
    });
  },

  async comment(txId: string, text: string) {
    const { user, couple } = requireCouple();
    const body = text.trim();
    if (!body) return;
    const entry = { id: Crypto.randomUUID(), by: user.id, text: body.slice(0, 280), date: new Date().toISOString() };
    updateCouple(couple, {
      transactions: couple.transactions.map((tx) => (tx.id === txId ? { ...tx, comments: [...tx.comments, entry] } : tx)),
    });
  },

  /** Schedules a contribution by the signed-in user, starting on `startDate`. */
  async addRecurring(input: { amount: number; goalId: string | null; frequency: Frequency; startDate: string }) {
    const { user, couple } = requireCouple();
    if (!(input.amount > 0)) throw new BackendError('errors.amountPositive');
    const rule: RecurringRule = {
      id: Crypto.randomUUID(),
      by: user.id,
      amount: input.amount,
      goalId: input.goalId,
      frequency: input.frequency,
      nextDate: input.startDate,
      active: true,
      createdAt: new Date().toISOString(),
    };
    updateCouple(couple, { recurring: [...couple.recurring, rule] });
    return rule;
  },

  async setRecurringActive(id: string, active: boolean) {
    const { couple } = requireCouple();
    updateCouple(couple, { recurring: couple.recurring.map((r) => (r.id === id ? { ...r, active } : r)) });
  },

  async deleteRecurring(id: string) {
    const { couple } = requireCouple();
    updateCouple(couple, { recurring: couple.recurring.filter((r) => r.id !== id) });
  },

  /** Records a due recurring contribution and moves it to its next date. */
  async confirmRecurring(id: string) {
    const { user, couple } = requireCouple();
    const rule = couple.recurring.find((r) => r.id === id && r.by === user.id);
    if (!rule) return;
    const entry: Transaction = {
      id: Crypto.randomUUID(),
      type: 'deposit',
      amount: rule.amount,
      by: user.id,
      goalId: couple.goals.some((g) => g.id === rule.goalId) ? rule.goalId : null,
      note: '',
      date: new Date().toISOString(),
      reactions: {},
      comments: [],
      recurringId: rule.id,
    };
    updateCouple(couple, {
      transactions: [entry, ...couple.transactions],
      recurring: couple.recurring.map((r) => (r.id === id ? { ...r, nextDate: advanceDate(r.nextDate, r.frequency) } : r)),
    });
  },

  /** Skips a due recurring contribution until its next date. */
  async skipRecurring(id: string) {
    const { couple } = requireCouple();
    updateCouple(couple, { recurring: couple.recurring.map((r) => (r.id === id ? { ...r, nextDate: advanceDate(r.nextDate, r.frequency) } : r)) });
  },

  /** Sets the agreed contribution share (percent per member); null resets to 50/50. */
  async setSplit(split: Record<string, number> | null) {
    const { couple } = requireCouple();
    updateCouple(couple, { split });
  },

  async renamePet(name: string) {
    const { couple } = requireCouple();
    updateCouple(couple, { petName: name.trim().slice(0, 16) || null });
  },
};
