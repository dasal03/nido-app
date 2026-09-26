/**
 * Supabase backend: accounts via Supabase Auth, data in Postgres (see `supabase/schema.sql`), and
 * realtime updates so both partners' phones stay in sync. Implements the same `Backend` contract as
 * the local backend; the UI reads a normalized snapshot rebuilt after every change.
 */
import * as Crypto from 'expo-crypto';
import * as Linking from 'expo-linking';
import type { PostgrestError, RealtimeChannel } from '@supabase/supabase-js';

import { buildDemoData } from '@/store/seed';
import type { ApprovalRequest, Couple, Frequency, Goal, RecurringRule, Transaction, User } from '@/store/types';
import { validatePassword } from '@/utils/validation';
import { nestBalance } from '@/utils/settlement';
import { supabase } from './supabase';
import {
  BackendError,
  EMAIL_RE,
  advanceDate,
  checkAmount,
  checkPhone,
  checkRegistration,
  checkUsername,
  normalizeCode,
  normalizeEmail,
  normalizeFamilyCode,
  normalizeUsername,
  type Backend,
  type Db,
  type ErrorKey,
} from './types';

const EMPTY: Db = { users: {}, couples: {}, sessionUserId: null };
let db: Db = EMPTY;
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function client() {
  if (!supabase) throw new BackendError('errors.generic');
  return supabase;
}

function publish(next: Db) {
  db = next;
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

const RPC_ERRORS: Record<string, ErrorKey> = {
  code_not_found: 'errors.codeNotFound',
  own_code: 'errors.ownCode',
  already_linked_with: 'errors.alreadyLinkedWith',
  not_linked: 'errors.notLinked',
  not_authenticated: 'errors.sessionExpired',
  underage: 'validation.minAge',
  document_taken: 'errors.documentTaken',
  family_name: 'errors.familyName',
  not_family: 'errors.notFamily',
  already_member: 'errors.alreadyMember',
  amount_positive: 'errors.amountPositive',
  insufficient_funds: 'errors.insufficientFunds',
  request_pending: 'errors.requestPending',
  active_nests: 'errors.activeNests',
  amount_too_small: 'errors.amountTooSmall',
  amount_too_large: 'errors.amountTooLarge',
};

/** Translates Supabase/Postgres errors into the app's translated error keys. */
function fail(error: { message?: string; code?: string } | null): never {
  const message = error?.message ?? '';
  for (const [needle, key] of Object.entries(RPC_ERRORS)) if (message.includes(needle)) throw new BackendError(key);
  if (error?.code === '23505' && message.includes('username')) throw new BackendError('errors.usernameTaken');
  if (/invalid login credentials/i.test(message)) throw new BackendError('errors.badCredentials');
  if (/token has expired|otp.*(expired|invalid)|invalid.*otp/i.test(message)) throw new BackendError('errors.resetCode');
  if (/rate limit|only request this after|too many/i.test(message)) throw new BackendError('errors.tooManyEmails');
  if (/email not confirmed/i.test(message)) throw new BackendError('errors.emailNotConfirmed');
  if (/already registered|already been registered/i.test(message)) throw new BackendError('errors.emailTaken');
  if (/password/i.test(message) && /least|short|weak/i.test(message)) throw new BackendError('errors.weakPassword');
  if (error?.code === '23505' && message.includes('document')) throw new BackendError('errors.documentTaken');
  throw new BackendError('errors.generic');
}

function check<T>({ data, error }: { data: T; error: PostgrestError | null }): T {
  if (error) fail(error);
  return data;
}

// ---------------------------------------------------------------------------
// Snapshot: database rows → app model
// ---------------------------------------------------------------------------

// Rows come untyped from PostgREST (no generated types), so the mappers take `any`.
/** `priv` is the owner's private row (birthday, gender, document); partners never receive it. */
const toUser = (p: any, coupleIds: string[] = [], priv: any = null): User => ({
  id: p.id,
  code: p.code,
  name: p.name,
  username: p.username,
  email: p.email,
  phone: p.phone,
  country: p.country ?? '',
  birthday: priv?.birthday ?? '',
  gender: priv?.gender ?? '',
  documentType: priv?.document_type ?? '',
  documentNumber: priv?.document_number ?? '',
  photo: p.photo,
  coupleIds,
  activeCoupleId: p.active_couple_id,
  createdAt: p.created_at,
});

const toGoal = (g: any): Goal => ({
  id: g.id,
  name: g.name,
  icon: g.icon,
  target: Number(g.target),
  color: g.color,
  createdAt: g.created_at,
  deadline: g.deadline,
});

const toRule = (r: any): RecurringRule => ({
  id: r.id,
  by: r.by,
  amount: Number(r.amount),
  goalId: r.goal_id,
  frequency: r.frequency as Frequency,
  nextDate: r.next_date,
  active: r.active,
  createdAt: r.created_at,
});

const toRequest = (r: any): ApprovalRequest => ({
  id: r.id,
  kind: r.kind,
  by: r.by,
  amount: r.amount === null ? null : Number(r.amount),
  goalId: r.goal_id,
  note: r.note,
  approvals: r.approvals ?? [],
  rejectedBy: r.rejected_by,
  status: r.status,
  createdAt: r.created_at,
  resolvedAt: r.resolved_at,
});

const toTransaction = (t: any): Transaction => ({
  id: t.id,
  type: t.type,
  amount: Number(t.amount),
  by: t.by,
  goalId: t.goal_id,
  note: t.note,
  date: t.date,
  recurringId: t.recurring_id ?? undefined,
  refund: t.refund || undefined,
  reactions: Object.fromEntries((t.reactions ?? []).map((r: any) => [r.user_id, r.emoji])),
  comments: (t.comments ?? [])
    .map((c: any) => ({ id: c.id, by: c.by, text: c.text, date: c.date }))
    .sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date)),
});

/**
 * Reloads everything the signed-in user can see and publishes a fresh snapshot. On errors it keeps
 * the last good snapshot, unless `strict` (right after signing in): then it signs out locally and
 * throws, so the sign-in screen shows an error instead of silently staying put.
 */
async function refresh(strict = false) {
  const sb = client();
  const { data: auth } = await sb.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return publish(EMPTY);

  const [{ data: me, error: meError }, { data: priv }, { data: couples, error: couplesError }] = await Promise.all([
    sb.from('profiles').select('*').eq('id', uid).maybeSingle(),
    sb.from('profile_private').select('*').eq('id', uid).maybeSingle(),
    sb
      .from('couples')
      .select(
        '*, couple_members(user_id, joined_at, profiles(*)), goals(*), recurring_rules(*), approval_requests(*), transactions(*, reactions(*), comments(*))',
      )
      .order('date', { referencedTable: 'transactions', ascending: false }),
  ]);
  if (meError || couplesError) {
    if (__DEV__) console.warn('Nido: could not load data', meError ?? couplesError);
    if (!strict) return; // keep the last good snapshot on transient errors
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    throw new BackendError('errors.loadFailed');
  }
  if (!me) return publish({ ...EMPTY, sessionUserId: null });

  const users: Record<string, User> = {};
  const map: Record<string, Couple> = {};
  const activeIds: string[] = [];

  for (const c of couples ?? []) {
    const members: any[] = [...c.couple_members].sort((a: any, b: any) => a.joined_at.localeCompare(b.joined_at));
    for (const m of members) if (m.profiles && m.user_id !== uid) users[m.user_id] = toUser(m.profiles);
    if (!c.archived_at) activeIds.push(c.id);
    map[c.id] = {
      id: c.id,
      kind: c.kind ?? 'couple',
      name: c.name,
      memberIds: members.map((m: any) => m.user_id),
      currency: c.currency,
      createdAt: c.created_at,
      archivedAt: c.archived_at,
      goals: c.goals.map(toGoal).sort((a: Goal, b: Goal) => a.createdAt.localeCompare(b.createdAt)),
      transactions: c.transactions.map(toTransaction),
      recurring: c.recurring_rules.map(toRule),
      split: c.split,
      petName: c.pet_name,
      inviteCode: c.invite_code ?? null,
      requests: (c.approval_requests ?? [])
        .map(toRequest)
        .sort((a: ApprovalRequest, b: ApprovalRequest) => b.createdAt.localeCompare(a.createdAt)),
    };
  }

  // If the stored active nest is gone (e.g. unlinked elsewhere), fall back to another one.
  let active = me.active_couple_id as string | null;
  if (!active || !activeIds.includes(active)) {
    active = activeIds[0] ?? null;
    if (active !== me.active_couple_id)
      sb.from('profiles')
        .update({ active_couple_id: active })
        .eq('id', uid)
        .then(() => {});
  }
  users[uid] = { ...toUser(me, activeIds, priv), activeCoupleId: active };
  publish({ users, couples: map, sessionUserId: uid });
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => refresh().catch(() => {}), 250);
}

/** Listens to every change the user is allowed to see (RLS applies) and refreshes the snapshot. */
function subscribeRealtime(signedIn: boolean) {
  const sb = client();
  if (channel) sb.removeChannel(channel);
  channel = null;
  if (!signedIn) return;
  channel = sb.channel('nido-changes');
  for (const table of [
    'profiles',
    'couples',
    'couple_members',
    'goals',
    'recurring_rules',
    'transactions',
    'reactions',
    'comments',
    'approval_requests',
  ]) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, scheduleRefresh);
  }
  channel.subscribe();
}

// ---------------------------------------------------------------------------
// Helpers for mutations
// ---------------------------------------------------------------------------

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

/** Runs a write, then refreshes so the UI reflects it immediately (realtime covers the other phone). */
async function write<T>(op: PromiseLike<{ data: T; error: PostgrestError | null }>) {
  const data = check(await op);
  await refresh();
  return data;
}

// ---------------------------------------------------------------------------
// Backend
// ---------------------------------------------------------------------------

export const supabaseBackend: Backend = {
  async init() {
    const sb = client();
    await refresh().catch(() => {});
    const { data } = await sb.auth.getSession();
    subscribeRealtime(!!data.session);
    sb.auth.onAuthStateChange((event, session) => {
      // Supabase advises against awaiting other calls inside this callback.
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        setTimeout(() => {
          subscribeRealtime(!!session);
          refresh().catch(() => {});
        }, 0);
      }
    });
  },

  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getSnapshot: () => db,

  async register(input) {
    const sb = client();
    const { name, username, email, phone, password, country, birthday, gender, documentType, documentNumber } = checkRegistration(input);
    // A confirmed account with this email must sign in instead; an unconfirmed one is re-sent its email.
    const registered = await sb.rpc('email_registered', { p_email: email });
    if (!registered.error && registered.data) throw new BackendError('errors.emailTaken');
    if (!(await this.isUsernameAvailable(username, email))) throw new BackendError('errors.usernameTaken');
    if (!(await this.isDocumentAvailable(country, documentType, documentNumber, email))) throw new BackendError('errors.documentTaken');
    // The confirmation email links back into the app (add `nido://**` to Supabase's Redirect URLs).
    const emailRedirectTo = Linking.createURL('login');
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        // Read by the `handle_new_user` trigger to create the public profile and the private row.
        data: { name, username, phone, country, birthday, gender, document_type: documentType, document_number: documentNumber },
      },
    });
    if (error) fail(error);
    // With "Confirm email" enabled there's no session until the user clicks the link.
    if (!data.session) return { needsConfirmation: true };
    await refresh(true);
    return { needsConfirmation: false };
  },

  async isUsernameAvailable(username, email) {
    const sb = client();
    const p_username = normalizeUsername(username);
    // The email-aware version comes with migration 006; fall back to the original one before it's applied.
    if (email) {
      const res = await sb.rpc('username_available', { p_username, p_email: normalizeEmail(email) });
      if (!res.error) return !!res.data;
    }
    return !!check(await sb.rpc('username_available', { p_username }));
  },

  async isDocumentAvailable(country, type, number, email) {
    const sb = client();
    const params = { p_country: country, p_type: type, p_number: number.trim().toUpperCase() };
    if (email) {
      const res = await sb.rpc('document_available', { ...params, p_email: normalizeEmail(email) });
      if (!res.error) return !!res.data;
    }
    return !!check(await sb.rpc('document_available', params));
  },

  async resendConfirmation(identifier) {
    const sb = client();
    let email = normalizeEmail(identifier);
    if (!EMAIL_RE.test(email)) {
      const found = check(await sb.rpc('email_for_username', { p_username: normalizeUsername(email) }));
      if (!found) return;
      email = found as string;
    }
    const { error } = await sb.auth.resend({ type: 'signup', email, options: { emailRedirectTo: Linking.createURL('login') } });
    if (error) fail(error);
  },

  async login({ identifier, password }) {
    const sb = client();
    const id = identifier.trim().toLowerCase();
    let email = id;
    if (!EMAIL_RE.test(id)) {
      const found = check(await sb.rpc('email_for_username', { p_username: normalizeUsername(id) }));
      if (!found) throw new BackendError('errors.badCredentials');
      email = found as string;
    }
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) fail(error);
    await refresh(true);
  },

  async logout() {
    await client().auth.signOut();
    publish(EMPTY);
  },

  async updateProfile(patch) {
    const user = requireUser();
    const row: Record<string, string | null> = {};
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new BackendError('errors.nameRequired');
      row.name = patch.name.trim();
    }
    if (patch.username !== undefined) row.username = checkUsername(patch.username);
    if (patch.phone !== undefined) row.phone = checkPhone(patch.phone);
    if (patch.photo !== undefined) row.photo = patch.photo;
    if (patch.country !== undefined) row.country = patch.country;
    const priv: Record<string, string> = {};
    if (patch.birthday !== undefined) priv.birthday = patch.birthday;
    if (patch.gender !== undefined) priv.gender = patch.gender;
    if (Object.keys(priv).length) check(await client().from('profile_private').update(priv).eq('id', user.id));
    await write(client().from('profiles').update(row).eq('id', user.id));
  },

  async linkWithCode(rawCode) {
    requireUser();
    await write(client().rpc('link_with_code', { p_code: normalizeCode(rawCode) }));
  },

  async linkDemoPartner() {
    const me = requireUser();
    const partnerId = Crypto.randomUUID();
    const { goals, transactions } = buildDemoData(me.id, partnerId);
    await write(
      client().rpc('create_demo_nest', {
        p_partner: partnerId,
        p_goals: goals,
        p_transactions: transactions.map(({ reactions: _r, comments: _c, ...tx }) => tx),
        p_reactions: transactions.flatMap((tx) =>
          Object.entries(tx.reactions).map(([userId, emoji]) => ({ transactionId: tx.id, userId, emoji })),
        ),
        p_comments: transactions.flatMap((tx) => tx.comments.map((c) => ({ ...c, transactionId: tx.id }))),
      }),
    );
  },

  async setActiveCouple(coupleId) {
    const user = requireUser();
    if (!user.coupleIds.includes(coupleId)) throw new BackendError('errors.notLinked');
    await write(client().from('profiles').update({ active_couple_id: coupleId }).eq('id', user.id));
  },

  async renameCouple(coupleId, name) {
    await write(
      client()
        .from('couples')
        .update({ name: name.trim() || null })
        .eq('id', coupleId),
    );
  },

  async createFamily(name) {
    requireUser();
    if (name.trim().length < 2) throw new BackendError('errors.familyName');
    await write(client().rpc('create_family', { p_name: name.trim() }));
  },

  async addMemberByCode(code) {
    const { couple } = requireCouple();
    await write(client().rpc('add_member_by_code', { p_couple: couple.id, p_code: normalizeCode(code) }));
  },

  async joinFamily(code) {
    requireUser();
    await write(client().rpc('join_family', { p_code: normalizeFamilyCode(code) }));
  },

  async requestWithdraw({ amount, goalId, note }) {
    const { couple } = requireCouple();
    checkAmount(amount, couple.currency, nestBalance(couple, goalId));
    await write(
      client().rpc('create_request', { p_couple: couple.id, p_kind: 'withdraw', p_amount: amount, p_goal: goalId, p_note: note }),
    );
  },

  async requestDissolve() {
    const { couple } = requireCouple();
    await write(client().rpc('create_request', { p_couple: couple.id, p_kind: 'dissolve' }));
  },

  async requestLeave() {
    const { couple } = requireCouple();
    await write(client().rpc('create_request', { p_couple: couple.id, p_kind: 'leave' }));
  },

  async approveRequest(id) {
    await write(client().rpc('approve_request', { p_request: id }));
  },

  async rejectRequest(id) {
    await write(client().rpc('reject_request', { p_request: id }));
  },

  async cancelRequest(id) {
    await write(client().rpc('cancel_request', { p_request: id }));
  },

  async deleteAccount(password) {
    const sb = client();
    const me = requireUser();
    // Re-check the password before such a destructive action.
    const { error } = await sb.auth.signInWithPassword({ email: me.email, password });
    if (error) throw new BackendError('errors.badPassword');
    check(await sb.rpc('delete_account'));
    await sb.auth.signOut({ scope: 'local' }).catch(() => {});
    publish(EMPTY);
  },

  async requestPasswordReset(email) {
    // Sends a 6-digit code: the "Reset password" email template must include {{ .Token }}.
    const { error } = await client().auth.resetPasswordForEmail(normalizeEmail(email));
    if (error && !/not found/i.test(error.message)) fail(error);
    return {};
  },

  async resetPassword({ email, code, password }) {
    const sb = client();
    const weak = validatePassword(password);
    if (weak) throw new BackendError(weak as ErrorKey);
    const { error } = await sb.auth.verifyOtp({ email: normalizeEmail(email), token: code.trim(), type: 'recovery' });
    if (error) throw new BackendError('errors.resetCode');
    const { error: updateError } = await sb.auth.updateUser({ password });
    if (updateError) fail(updateError);
    await refresh(true);
  },

  async setCurrency(currency, rate) {
    const { couple } = requireCouple();
    await write(client().rpc('change_currency', { p_couple: couple.id, p_currency: currency, p_rate: rate }));
  },

  async setSplit(split) {
    const { couple } = requireCouple();
    await write(client().from('couples').update({ split }).eq('id', couple.id));
  },

  async renamePet(name) {
    const { couple } = requireCouple();
    await write(
      client()
        .from('couples')
        .update({ pet_name: name.trim().slice(0, 16) || null })
        .eq('id', couple.id),
    );
  },

  async addGoal(goal) {
    const { couple } = requireCouple();
    await write(
      client().from('goals').insert({
        couple_id: couple.id,
        name: goal.name,
        icon: goal.icon,
        target: goal.target,
        color: goal.color,
        deadline: goal.deadline,
      }),
    );
  },

  async deleteGoal(id) {
    // Movements keep their history: the foreign key moves them to the common fund (goal_id → null).
    await write(client().from('goals').delete().eq('id', id));
  },

  async addTransaction(tx) {
    const { user, couple } = requireCouple();
    if (tx.recurringId) {
      if (!(tx.amount > 0)) throw new BackendError('errors.amountPositive');
    } else checkAmount(tx.amount, couple.currency);
    await write(
      client()
        .from('transactions')
        .insert({
          couple_id: couple.id,
          type: 'deposit',
          amount: tx.amount,
          by: user.id,
          goal_id: tx.goalId,
          note: tx.note,
          recurring_id: tx.recurringId ?? null,
        }),
    );
  },

  async react(txId, emoji) {
    const { user, couple } = requireCouple();
    const current = couple.transactions.find((t) => t.id === txId)?.reactions[user.id];
    const table = client().from('reactions');
    await write(
      current === emoji
        ? table.delete().eq('transaction_id', txId).eq('user_id', user.id)
        : table.upsert({ transaction_id: txId, user_id: user.id, emoji }),
    );
  },

  async comment(txId, text) {
    const user = requireUser();
    const body = text.trim().slice(0, 280);
    if (!body) return;
    await write(client().from('comments').insert({ transaction_id: txId, by: user.id, text: body }));
  },

  async addRecurring(input) {
    const { user, couple } = requireCouple();
    checkAmount(input.amount, couple.currency);
    const row = await write(
      client()
        .from('recurring_rules')
        .insert({
          couple_id: couple.id,
          by: user.id,
          amount: input.amount,
          goal_id: input.goalId,
          frequency: input.frequency,
          next_date: input.startDate,
        })
        .select()
        .single(),
    );
    return toRule(row);
  },

  async setRecurringActive(id, active) {
    await write(client().from('recurring_rules').update({ active }).eq('id', id));
  },

  async deleteRecurring(id) {
    await write(client().from('recurring_rules').delete().eq('id', id));
  },

  async confirmRecurring(id) {
    const { user, couple } = requireCouple();
    const rule = couple.recurring.find((r) => r.id === id && r.by === user.id);
    if (!rule) return;
    const goalId = couple.goals.some((g) => g.id === rule.goalId) ? rule.goalId : null;
    check(
      await client().from('transactions').insert({
        couple_id: couple.id,
        type: 'deposit',
        amount: rule.amount,
        by: user.id,
        goal_id: goalId,
        note: '',
        recurring_id: rule.id,
      }),
    );
    await write(
      client()
        .from('recurring_rules')
        .update({ next_date: advanceDate(rule.nextDate, rule.frequency) })
        .eq('id', id),
    );
  },

  async skipRecurring(id) {
    const { couple } = requireCouple();
    const rule = couple.recurring.find((r) => r.id === id);
    if (!rule) return;
    await write(
      client()
        .from('recurring_rules')
        .update({ next_date: advanceDate(rule.nextDate, rule.frequency) })
        .eq('id', id),
    );
  },
};
