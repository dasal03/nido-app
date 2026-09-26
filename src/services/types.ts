import type { TranslationKey } from '@/i18n/es';
import type { Couple, Frequency, Goal, RecurringRule, Transaction, User } from '@/store/types';

/** Everything the UI reads: people, nests and who is signed in. */
export interface Db {
  users: Record<string, User>;
  couples: Record<string, Couple>;
  sessionUserId: string | null;
}

export type ErrorKey = Extract<TranslationKey, `errors.${string}`>;

/** Error with a translation key, so the UI can show it in the user's language. */
export class BackendError extends Error {
  constructor(public key: ErrorKey) {
    super(key);
  }
}

/** The contract every backend (local device storage or Supabase) implements. Screens only use this. */
export interface Backend {
  init(): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): Db;

  register(input: { name: string; username: string; email: string; phone: string; password: string }): Promise<void>;
  login(input: { identifier: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  updateProfile(patch: Partial<Pick<User, 'name' | 'username' | 'phone' | 'birthday' | 'photo'>>): Promise<void>;

  linkWithCode(code: string): Promise<void>;
  linkDemoPartner(): Promise<void>;
  setActiveCouple(coupleId: string): Promise<void>;
  renameCouple(coupleId: string, name: string): Promise<void>;
  unlinkCouple(coupleId: string): Promise<void>;
  setCurrency(currency: string): Promise<void>;
  setSplit(split: Record<string, number> | null): Promise<void>;
  renamePet(name: string): Promise<void>;

  addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  addTransaction(tx: Pick<Transaction, 'type' | 'amount' | 'goalId' | 'note'> & { recurringId?: string }): Promise<void>;
  react(txId: string, emoji: string): Promise<void>;
  comment(txId: string, text: string): Promise<void>;

  addRecurring(input: { amount: number; goalId: string | null; frequency: Frequency; startDate: string }): Promise<RecurringRule>;
  setRecurringActive(id: string, active: boolean): Promise<void>;
  deleteRecurring(id: string): Promise<void>;
  confirmRecurring(id: string): Promise<void>;
  skipRecurring(id: string): Promise<void>;
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

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const USERNAME_RE = /^[a-z0-9._]{3,20}$/;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const normalizeUsername = (username: string) => username.trim().toLowerCase().replace(/^@/, '');

/** Accepts "NIDO-XXXXX", "nido-xxxxx" or just "XXXXX". */
export function normalizeCode(raw: string) {
  const code = raw.trim().toUpperCase().replace(/\s+/g, '');
  return code && !code.startsWith('NIDO-') ? `NIDO-${code.replace(/^NIDO/, '')}` : code;
}

export function checkUsername(raw: string) {
  const username = normalizeUsername(raw);
  if (!USERNAME_RE.test(username)) throw new BackendError('errors.usernameInvalid');
  return username;
}

export function checkPhone(raw: string) {
  const phone = raw.trim();
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) throw new BackendError('errors.phoneInvalid');
  return phone;
}

/** Validation shared by both backends; returns the normalized fields. */
export function checkRegistration(input: { name: string; username: string; email: string; phone: string; password: string }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) throw new BackendError('errors.nameRequired');
  const username = checkUsername(input.username);
  if (!EMAIL_RE.test(email)) throw new BackendError('errors.invalidEmail');
  const phone = checkPhone(input.phone);
  if (input.password.length < 6) throw new BackendError('errors.weakPassword');
  return { name, username, email, phone, password: input.password };
}
