import type { TranslationKey } from '@/i18n/es';
import { validateBirthday, validateDocument, validateEmail, validateName, validatePassword, type FieldError } from '@/utils/validation';
import type { Couple, Frequency, Goal, RecurringRule, Transaction, User } from '@/store/types';

/** Everything the UI reads: people, nests and who is signed in. */
export interface Db {
  users: Record<string, User>;
  couples: Record<string, Couple>;
  sessionUserId: string | null;
}

export type ErrorKey = Extract<TranslationKey, `errors.${string}` | `validation.${string}`>;

/** Error with a translation key, so the UI can show it in the user's language. */
export class BackendError extends Error {
  constructor(public key: ErrorKey) {
    super(key);
  }
}

export interface RegisterInput {
  name: string;
  username: string;
  email: string;
  /** International format: "+57 3012668858". */
  phone: string;
  password: string;
  country: string;
  /** ISO date YYYY-MM-DD. */
  birthday: string;
  gender: string;
  documentType: string;
  documentNumber: string;
}

/** The contract every backend (local device storage or Supabase) implements. Screens only use this. */
export interface Backend {
  init(): Promise<void>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): Db;

  /** Creates the account. `needsConfirmation` is true when the user must confirm their email before signing in. */
  register(input: RegisterInput): Promise<{ needsConfirmation: boolean }>;
  isUsernameAvailable(username: string): Promise<boolean>;
  isDocumentAvailable(country: string, type: string, number: string): Promise<boolean>;
  login(input: { identifier: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  updateProfile(patch: Partial<Pick<User, 'name' | 'username' | 'phone' | 'birthday' | 'photo' | 'country' | 'gender'>>): Promise<void>;

  /** Starts a couple nest with the owner of `code`. */
  linkWithCode(code: string): Promise<void>;
  linkDemoPartner(): Promise<void>;
  /** Creates a named family group with the signed-in user as its first member. */
  createFamily(name: string): Promise<void>;
  /** Adds the owner of `code` to the active family group. */
  addMemberByCode(code: string): Promise<void>;
  setActiveCouple(coupleId: string): Promise<void>;
  renameCouple(coupleId: string, name: string): Promise<void>;

  /** Withdrawals need every other member's approval; this creates the request. */
  requestWithdraw(input: { amount: number; goalId: string | null; note: string }): Promise<void>;
  /** Asks to dissolve the active nest; when approved, each member gets their share back. */
  requestDissolve(): Promise<void>;
  /** Families: asks to leave the group with your share. */
  requestLeave(): Promise<void>;
  approveRequest(id: string): Promise<void>;
  rejectRequest(id: string): Promise<void>;
  cancelRequest(id: string): Promise<void>;

  /** Emails a 6-digit reset code. The local backend returns it (`devCode`) since it can't send email. */
  requestPasswordReset(email: string): Promise<{ devCode?: string }>;
  /** Verifies the code, sets the new password and signs the user in. */
  resetPassword(input: { email: string; code: string; password: string }): Promise<void>;
  setCurrency(currency: string): Promise<void>;
  setSplit(split: Record<string, number> | null): Promise<void>;
  renamePet(name: string): Promise<void>;

  addGoal(goal: Omit<Goal, 'id' | 'createdAt'>): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  /** Records a contribution (deposits only; withdrawals go through `requestWithdraw`). */
  addTransaction(tx: Pick<Transaction, 'amount' | 'goalId' | 'note'> & { recurringId?: string }): Promise<void>;
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

/** Validation shared by both backends (the form validates the same rules live); returns normalized fields. */
export function checkRegistration(input: RegisterInput): RegisterInput {
  const fail = (key: FieldError) => {
    if (key) throw new BackendError(key as ErrorKey);
  };
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  fail(validateName(name));
  const username = checkUsername(input.username);
  fail(validateEmail(email));
  const phone = checkPhone(input.phone);
  fail(validatePassword(input.password));
  fail(validateBirthday(input.birthday));
  const documentNumber = input.documentNumber.trim().toUpperCase();
  fail(validateDocument(input.country, input.documentType, documentNumber));
  if (!input.gender) throw new BackendError('validation.required');
  return { ...input, name, username, email, phone, documentNumber };
}
