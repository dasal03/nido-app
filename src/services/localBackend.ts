/**
 * Local backend: accounts, sessions, couple linking and savings data, persisted on the device.
 * Used when Supabase isn't configured (no EXPO_PUBLIC_SUPABASE_URL), e.g. for offline demos.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

import { buildDemoData } from '@/store/seed';
import type { ApprovalRequest, Couple, Frequency, Goal, RecurringRule, Transaction, User } from '@/store/types';
import { computeRefunds, nestBalance } from '@/utils/settlement';
import { validatePassword } from '@/utils/validation';
import {
  BackendError,
  advanceDate,
  type RegisterInput,
  checkPhone,
  checkRegistration,
  checkAmount,
  checkUsername,
  convertAmount,
  EMAIL_RE,
  normalizeCode,
  normalizeFamilyCode,
  normalizeEmail,
  normalizeUsername,
  type Backend,
  type ErrorKey,
} from './types';

const STORAGE_KEY = 'nido/db/v2';
const LEGACY_KEYS = ['nido/state/v1'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

interface UserRecord extends User {
  passwordHash: string;
  salt: string;
  /** Sample partner created by "Try with a sample partner"; approves requests automatically. */
  isDemo?: boolean;
}

interface LocalDb {
  users: Record<string, UserRecord>;
  couples: Record<string, Couple>;
  sessionUserId: string | null;
}

let db: LocalDb = { users: {}, couples: {}, sessionUserId: null };
const listeners = new Set<() => void>();

function commit(next: LocalDb) {
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

const hash = (password: string, salt: string) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${salt}:${password}`);

const randomChars = (n: number) => Array.from(Crypto.getRandomBytes(n), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');

function generateFamilyCode() {
  let code: string;
  do code = `FAM-${randomChars(5)}`;
  while (Object.values(db.couples).some((c) => c.inviteCode === code));
  return code;
}

function generateCode() {
  const taken = new Set(Object.values(db.users).map((u) => u.code));
  let code: string;
  do {
    const bytes = Crypto.getRandomBytes(5);
    code = 'NIDO-' + Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
  } while (taken.has(code));
  return code;
}

async function createUser(input: RegisterInput): Promise<UserRecord> {
  const salt = Crypto.randomUUID();
  return {
    id: Crypto.randomUUID(),
    code: generateCode(),
    name: input.name,
    username: input.username,
    email: input.email,
    phone: input.phone,
    birthday: input.birthday,
    country: input.country,
    gender: input.gender,
    documentType: input.documentType,
    documentNumber: input.documentNumber,
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
    kind: 'couple',
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
    requests: [],
    inviteCode: null,
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
  return a.coupleIds.some((id) => b.coupleIds.includes(id) && db.couples[id]?.kind === 'couple' && !db.couples[id]?.archivedAt);
}

function validUsername(raw: string, exceptId?: string) {
  const username = checkUsername(raw);
  if (Object.values(db.users).some((u) => u.username === username && u.id !== exceptId)) throw new BackendError('errors.usernameTaken');
  return username;
}

/** Derives a unique username from an email, for accounts created before usernames existed. */
function usernameFromEmail(email: string, taken: Set<string>) {
  const base = (email.split('@')[0] ?? 'user')
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, '')
    .slice(0, 16)
    .padEnd(3, '0');
  let candidate = base;
  for (let i = 2; taken.has(candidate); i++) candidate = `${base}${i}`;
  taken.add(candidate);
  return candidate;
}

const resetCodes = new Map<string, { code: string; expires: number }>();

function updateRequest(couple: Couple, id: string, patch: Partial<ApprovalRequest>) {
  updateCouple(couple, { requests: couple.requests.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
}

/** Creates a request approved by its author (and sample partners); runs it right away if nobody else must approve. */
function createRequest(couple: Couple, input: Pick<ApprovalRequest, 'kind' | 'amount' | 'goalId' | 'note'>) {
  const me = requireUser();
  const demoMembers = couple.memberIds.filter((id) => (db.users[id] as UserRecord | undefined)?.isDemo);
  const request: ApprovalRequest = {
    id: Crypto.randomUUID(),
    ...input,
    by: me.id,
    approvals: [me.id, ...demoMembers],
    rejectedBy: null,
    status: 'pending',
    createdAt: new Date().toISOString(),
    resolvedAt: null,
  };
  const withRequest = { ...couple, requests: [request, ...couple.requests] };
  updateCouple(couple, { requests: withRequest.requests });
  resolveIfComplete(withRequest, request);
}

/** Saves the request; once every current member approved, carries it out. */
function resolveIfComplete(couple: Couple, request: ApprovalRequest) {
  const complete = couple.memberIds.every((id) => request.approvals.includes(id));
  if (!complete) return updateRequest(couple, request.id, { approvals: request.approvals });
  const now = new Date().toISOString();
  const done: ApprovalRequest = { ...request, status: 'approved', resolvedAt: now };
  const requests = couple.requests.map((r) => (r.id === request.id ? done : r));
  const tx = (by: string, amount: number, goalId: string | null, note: string, refund = false): Transaction => ({
    id: Crypto.randomUUID(),
    type: 'withdraw',
    amount,
    by,
    goalId,
    note,
    date: now,
    reactions: {},
    comments: [],
    refund,
  });

  if (request.kind === 'withdraw') {
    if ((request.amount ?? 0) > nestBalance(couple, request.goalId)) throw new BackendError('errors.insufficientFunds');
    return updateCouple(couple, {
      requests,
      transactions: [tx(request.by, request.amount!, request.goalId, request.note), ...couple.transactions],
    });
  }

  const refunds = computeRefunds(couple);
  const leaving = request.kind === 'leave' ? [request.by] : couple.memberIds;
  const refundTxs = leaving.filter((id) => refunds[id] > 0).map((id) => tx(id, refunds[id], null, '', true));
  const users = { ...db.users };
  for (const id of leaving) {
    const member = users[id];
    if (!member) continue;
    const coupleIds = member.coupleIds.filter((c) => c !== couple.id);
    users[id] = {
      ...member,
      coupleIds,
      activeCoupleId: member.activeCoupleId === couple.id ? (coupleIds[0] ?? null) : member.activeCoupleId,
    };
  }
  const next: Couple = {
    ...couple,
    requests,
    transactions: [...refundTxs, ...couple.transactions],
    ...(request.kind === 'dissolve'
      ? { archivedAt: now, recurring: couple.recurring.map((r) => ({ ...r, active: false })) }
      : { memberIds: couple.memberIds.filter((id) => id !== request.by), recurring: couple.recurring.filter((r) => r.by !== request.by) }),
  };
  commit({ ...db, users, couples: { ...db.couples, [couple.id]: next } });
}

export const localBackend: Backend = {
  async init() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) db = JSON.parse(raw);
      // Migration: accounts created before usernames existed get one derived from their email.
      const taken = new Set(
        Object.values(db.users)
          .map((u) => u.username)
          .filter(Boolean),
      );
      for (const u of Object.values(db.users)) if (!u.username) u.username = usernameFromEmail(u.email, taken);
      // Migration: single `coupleId` → list of nests plus an active one.
      for (const u of Object.values(db.users) as (UserRecord & { coupleId?: string | null })[]) {
        u.country ??= 'CO';
        u.gender ??= '';
        u.documentType ??= '';
        u.documentNumber ??= '';
        if (!u.coupleIds) {
          u.coupleIds = u.coupleId ? [u.coupleId] : [];
          u.activeCoupleId = u.coupleId ?? null;
          delete u.coupleId;
        }
        // Sample partners created before the isDemo flag existed.
        u.isDemo ??= /^ana\.demo\+.*@nido\.app$/.test(u.email);
      }
      for (const c of Object.values(db.couples)) {
        c.name ??= null;
        c.archivedAt ??= null;
        c.recurring ??= [];
        c.split ??= null;
        c.petName ??= null;
        c.kind ??= 'couple';
        c.requests ??= [];
        c.inviteCode ??= c.kind === 'family' ? generateFamilyCode() : null;
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

  async register(input) {
    const clean = checkRegistration(input);
    validUsername(clean.username);
    if (Object.values(db.users).some((u) => u.email === clean.email)) throw new BackendError('errors.emailTaken');
    if (!(await this.isDocumentAvailable(clean.country, clean.documentType, clean.documentNumber)))
      throw new BackendError('errors.documentTaken');
    const user = await createUser(clean);
    commit({ ...db, users: { ...db.users, [user.id]: user }, sessionUserId: user.id });
    return { needsConfirmation: false };
  },

  async isUsernameAvailable(username) {
    return !Object.values(db.users).some((u) => u.username === normalizeUsername(username));
  },

  async resendConfirmation() {
    // Local accounts don't need email confirmation.
  },

  async isDocumentAvailable(country, type, number) {
    const n = number.trim().toUpperCase();
    return !Object.values(db.users).some((u) => u.country === country && u.documentType === type && u.documentNumber === n);
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

  async deleteAccount(password) {
    const me = requireUser() as UserRecord;
    if ((await hash(password, me.salt)) !== me.passwordHash) throw new BackendError('errors.badPassword');
    const active = me.coupleIds.map((id) => db.couples[id]).filter((c): c is Couple => !!c && !c.archivedAt);
    const sharesWithPeople = active.some((c) =>
      c.memberIds.some((id) => id !== me.id && !(db.users[id] as UserRecord | undefined)?.isDemo),
    );
    if (sharesWithPeople) throw new BackendError('errors.activeNests');
    const now = new Date().toISOString();
    const couples = { ...db.couples };
    for (const c of active) couples[c.id] = { ...c, archivedAt: now, recurring: c.recurring.map((r) => ({ ...r, active: false })) };
    // Keep an anonymous record so other members' history still has a name; drop everything personal.
    const anonymous: UserRecord = {
      ...me,
      name: 'Cuenta eliminada',
      username: `deleted_${me.id.replace(/-/g, '').slice(0, 12)}`,
      email: '',
      phone: '',
      photo: null,
      birthday: '',
      gender: '',
      documentType: '',
      documentNumber: '',
      passwordHash: '',
      activeCoupleId: null,
    };
    commit({ ...db, couples, users: { ...db.users, [me.id]: anonymous }, sessionUserId: null });
  },

  async updateProfile(patch) {
    const user = requireUser();
    const next = { ...patch };
    if (next.name !== undefined && !next.name.trim()) throw new BackendError('errors.nameRequired');
    if (next.username !== undefined) next.username = validUsername(next.username, user.id);
    if (next.phone !== undefined) next.phone = checkPhone(next.phone);
    commit({ ...db, users: { ...db.users, [user.id]: { ...user, ...next } } });
  },

  async linkWithCode(rawCode: string) {
    const me = requireUser();
    const code = normalizeCode(rawCode);
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
      phone: '+52 5500000000',
      password: Crypto.randomUUID(),
      country: 'MX',
      birthday: '',
      gender: '',
      documentType: '',
      documentNumber: '',
    });
    db = { ...db, users: { ...db.users, [partner.id]: { ...partner, isDemo: true } } };
    linkUsers(me, db.users[partner.id], buildDemoData(me.id, partner.id));
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

  async createFamily(rawName: string) {
    const me = requireUser();
    const name = rawName.trim();
    if (name.length < 2) throw new BackendError('errors.familyName');
    const active = me.activeCoupleId ? db.couples[me.activeCoupleId] : undefined;
    const family: Couple = {
      id: Crypto.randomUUID(),
      kind: 'family',
      name,
      memberIds: [me.id],
      currency: active?.currency ?? 'MXN',
      createdAt: new Date().toISOString(),
      archivedAt: null,
      goals: [],
      transactions: [],
      recurring: [],
      split: null,
      petName: null,
      requests: [],
      inviteCode: generateFamilyCode(),
    };
    commit({
      ...db,
      users: { ...db.users, [me.id]: { ...me, coupleIds: [...me.coupleIds, family.id], activeCoupleId: family.id } },
      couples: { ...db.couples, [family.id]: family },
    });
  },

  async addMemberByCode(rawCode: string) {
    const { user: me, couple } = requireCouple();
    if (couple.kind !== 'family') throw new BackendError('errors.notFamily');
    const code = normalizeCode(rawCode);
    if (code === me.code) throw new BackendError('errors.ownCode');
    const member = Object.values(db.users).find((u) => u.code === code);
    if (!member) throw new BackendError('errors.codeNotFound');
    if (couple.memberIds.includes(member.id)) throw new BackendError('errors.alreadyMember');
    commit({
      ...db,
      users: {
        ...db.users,
        [member.id]: { ...member, coupleIds: [...member.coupleIds, couple.id], activeCoupleId: member.activeCoupleId ?? couple.id },
      },
      couples: { ...db.couples, [couple.id]: { ...couple, memberIds: [...couple.memberIds, member.id] } },
    });
  },

  async joinFamily(rawCode) {
    const me = requireUser();
    const code = normalizeFamilyCode(rawCode);
    const family = Object.values(db.couples).find((c) => c.inviteCode === code && c.kind === 'family' && !c.archivedAt);
    if (!family) throw new BackendError('errors.codeNotFound');
    if (family.memberIds.includes(me.id)) throw new BackendError('errors.alreadyMember');
    commit({
      ...db,
      users: { ...db.users, [me.id]: { ...me, coupleIds: [...me.coupleIds, family.id], activeCoupleId: family.id } },
      couples: { ...db.couples, [family.id]: { ...family, memberIds: [...family.memberIds, me.id] } },
    });
  },

  async requestWithdraw({ amount, goalId, note }) {
    const { couple } = requireCouple();
    const available = nestBalance(couple, goalId);
    checkAmount(amount, couple.currency, available);
    if (amount > available) throw new BackendError('errors.insufficientFunds');
    createRequest(couple, { kind: 'withdraw', amount, goalId, note: note.trim() });
  },

  async requestDissolve() {
    const { couple } = requireCouple();
    if (couple.requests.some((r) => r.status === 'pending' && r.kind === 'dissolve')) throw new BackendError('errors.requestPending');
    createRequest(couple, { kind: 'dissolve', amount: null, goalId: null, note: '' });
  },

  async requestLeave() {
    const { user, couple } = requireCouple();
    if (couple.kind !== 'family') throw new BackendError('errors.notFamily');
    if (couple.requests.some((r) => r.status === 'pending' && r.kind === 'leave' && r.by === user.id))
      throw new BackendError('errors.requestPending');
    createRequest(couple, { kind: 'leave', amount: null, goalId: null, note: '' });
  },

  async approveRequest(id) {
    const { user, couple } = requireCouple();
    const request = couple.requests.find((r) => r.id === id && r.status === 'pending');
    if (!request) return;
    resolveIfComplete(couple, { ...request, approvals: [...new Set([...request.approvals, user.id])] });
  },

  async rejectRequest(id) {
    const { user, couple } = requireCouple();
    updateRequest(couple, id, { status: 'rejected', rejectedBy: user.id, resolvedAt: new Date().toISOString() });
  },

  async cancelRequest(id) {
    const { user, couple } = requireCouple();
    const request = couple.requests.find((r) => r.id === id);
    if (!request || request.by !== user.id) return;
    updateRequest(couple, id, { status: 'cancelled', resolvedAt: new Date().toISOString() });
  },

  async requestPasswordReset(email) {
    const user = Object.values(db.users).find((u) => u.email === normalizeEmail(email));
    // Same answer whether or not the account exists, so emails can't be discovered.
    if (!user) return {};
    const code = String(100000 + (Crypto.getRandomBytes(3).reduce((a, b) => a * 256 + b, 0) % 900000));
    resetCodes.set(user.email, { code, expires: Date.now() + 15 * 60_000 });
    return { devCode: code };
  },

  async resetPassword({ email, code, password }) {
    const key = normalizeEmail(email);
    const entry = resetCodes.get(key);
    if (!entry || entry.code !== code.trim() || entry.expires < Date.now()) throw new BackendError('errors.resetCode');
    const weak = validatePassword(password);
    if (weak) throw new BackendError(weak as ErrorKey);
    const user = Object.values(db.users).find((u) => u.email === key)!;
    const salt = Crypto.randomUUID();
    resetCodes.delete(key);
    commit({
      ...db,
      users: { ...db.users, [user.id]: { ...user, salt, passwordHash: await hash(password, salt) } },
      sessionUserId: user.id,
    });
  },

  async setCurrency(currency, rate) {
    const { couple } = requireCouple();
    if (couple.currency === currency) return;
    if (!(rate > 0)) throw new BackendError('errors.generic');
    const convert = (n: number) => convertAmount(n, rate);
    updateCouple(couple, {
      currency,
      transactions: couple.transactions.map((tx) => ({ ...tx, amount: convert(tx.amount) })),
      goals: couple.goals.map((g) => ({ ...g, target: convert(g.target) })),
      recurring: couple.recurring.map((r) => ({ ...r, amount: convert(r.amount) })),
      requests: couple.requests.map((r) => (r.amount === null ? r : { ...r, amount: convert(r.amount) })),
    });
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
  async addTransaction(tx) {
    const { user, couple } = requireCouple();
    if (tx.recurringId) {
      if (!(tx.amount > 0)) throw new BackendError('errors.amountPositive');
    } else checkAmount(tx.amount, couple.currency);
    const entry: Transaction = {
      ...tx,
      type: 'deposit',
      id: Crypto.randomUUID(),
      by: user.id,
      date: new Date().toISOString(),
      reactions: {},
      comments: [],
    };
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
    checkAmount(input.amount, couple.currency);
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
    updateCouple(couple, {
      recurring: couple.recurring.map((r) => (r.id === id ? { ...r, nextDate: advanceDate(r.nextDate, r.frequency) } : r)),
    });
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
