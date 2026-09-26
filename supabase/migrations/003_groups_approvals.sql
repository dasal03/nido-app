-- ============================================================================
-- Nido · migration 003: family groups and shared approvals
-- Run after schema.sql and 002_identity.sql (SQL Editor → New query → paste → Run).
--
-- * A nest is either a couple (2 people) or a named family group (2+ people).
-- * Money only leaves a nest with everyone's approval: withdrawals, dissolving the
--   nest and a member leaving a family are requests that run once all members approve.
-- * Dissolving (or leaving) returns each person's share of the balance, in proportion
--   to what they deposited, as "refund" withdrawals.
-- ============================================================================

alter table public.couples add column if not exists kind text not null default 'couple' check (kind in ('couple', 'family'));
alter table public.transactions add column if not exists refund boolean not null default false;

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  kind text not null check (kind in ('withdraw', 'dissolve', 'leave')),
  "by" uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) check (amount is null or amount > 0),
  goal_id uuid references public.goals (id) on delete set null,
  note text not null default '',
  approvals uuid[] not null default '{}',
  rejected_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists approval_requests_couple_idx on public.approval_requests (couple_id, created_at desc);

alter table public.approval_requests enable row level security;
-- Read-only for members: every change goes through the functions below.
create policy "requests: read as member" on public.approval_requests for select to authenticated using (is_member(couple_id));

-- Only deposits can be inserted directly; withdrawals come from approved requests.
drop policy if exists "transactions: create own" on public.transactions;
create policy "transactions: deposit own" on public.transactions for insert to authenticated
  with check (is_member(couple_id) and "by" = auth.uid() and type = 'deposit' and not refund);

-- The old one-sided unlink is replaced by the dissolve request.
drop function if exists public.unlink_couple(uuid);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.nest_balance(p_couple uuid, p_all boolean default true, p_goal uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when type = 'deposit' then amount else -amount end), 0)
  from transactions where couple_id = p_couple and (p_all or goal_id is not distinct from p_goal);
$$;

-- Moves anyone whose active nest was `p_couple` to their most recent other active nest (or none).
create or replace function public.reassign_active(p_couple uuid)
returns void language sql security definer set search_path = public as $$
  update profiles p set active_couple_id = (
    select cm.couple_id from couple_members cm join couples c on c.id = cm.couple_id
    where cm.user_id = p.id and c.archived_at is null and c.id <> p_couple
    order by cm.joined_at desc limit 1
  )
  where p.active_couple_id = p_couple
    and (exists (select 1 from couples where id = p_couple and archived_at is not null)
         or not exists (select 1 from couple_members where couple_id = p_couple and user_id = p.id));
$$;

-- Writes the refund withdrawals for `p_members` (their share of the balance, proportional to deposits).
create or replace function public.write_refunds(p_couple uuid, p_members uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  balance numeric := greatest(nest_balance(p_couple), 0);
  members uuid[] := array(select user_id from couple_members where couple_id = p_couple order by joined_at);
  total numeric;
  shares jsonb := '{}';
  m uuid;
  dep numeric;
  share numeric;
  assigned numeric := 0;
  top uuid;
begin
  if balance = 0 then return; end if;
  select coalesce(sum(amount), 0) into total from transactions
  where couple_id = p_couple and type = 'deposit' and "by" = any (members);

  foreach m in array members loop
    select coalesce(sum(amount), 0) into dep from transactions where couple_id = p_couple and type = 'deposit' and "by" = m;
    share := floor(balance * (case when total > 0 then dep / total else 1.0 / array_length(members, 1) end) * 100) / 100;
    shares := shares || jsonb_build_object(m::text, share);
    assigned := assigned + share;
    if top is null or share > (shares ->> top::text)::numeric then top := m; end if;
  end loop;
  -- Rounding remainder goes to the largest share so the refunds add up to the balance.
  shares := jsonb_set(shares, array[top::text], to_jsonb((shares ->> top::text)::numeric + (balance - assigned)));

  foreach m in array p_members loop
    share := (shares ->> m::text)::numeric;
    if share > 0 then
      insert into transactions (couple_id, type, amount, "by", goal_id, note, refund) values (p_couple, 'withdraw', share, m, null, '', true);
    end if;
  end loop;
end;
$$;

-- Runs a request once every current member approved it.
create or replace function public.resolve_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r approval_requests;
begin
  select * into r from approval_requests where id = p_request for update;
  if r.status <> 'pending' then return; end if;
  if exists (select 1 from couple_members where couple_id = r.couple_id and not (user_id = any (r.approvals))) then return; end if;

  if r.kind = 'withdraw' then
    if r.amount > nest_balance(r.couple_id, false, r.goal_id) then raise exception 'insufficient_funds'; end if;
    insert into transactions (couple_id, type, amount, "by", goal_id, note) values (r.couple_id, 'withdraw', r.amount, r."by", r.goal_id, r.note);
  elsif r.kind = 'dissolve' then
    perform write_refunds(r.couple_id, array(select user_id from couple_members where couple_id = r.couple_id));
    update recurring_rules set active = false where couple_id = r.couple_id;
    update couples set archived_at = now() where id = r.couple_id;
  elsif r.kind = 'leave' then
    perform write_refunds(r.couple_id, array[r."by"]);
    delete from recurring_rules where couple_id = r.couple_id and "by" = r."by";
    delete from couple_members where couple_id = r.couple_id and user_id = r."by";
  end if;

  update approval_requests set status = 'approved', resolved_at = now() where id = p_request;
  perform reassign_active(r.couple_id);
end;
$$;

revoke execute on function public.nest_balance(uuid, boolean, uuid), public.reassign_active(uuid), public.write_refunds(uuid, uuid[]), public.resolve_request(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPCs used by the app
-- ---------------------------------------------------------------------------

-- "Already linked with" only applies to couples: you can share several family groups with someone.
create or replace function public.link_with_code(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  partner profiles;
  new_id uuid;
  cur text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into partner from profiles where code = upper(trim(p_code)) and not is_demo;
  if not found then raise exception 'code_not_found'; end if;
  if partner.id = me then raise exception 'own_code'; end if;
  if exists (
    select 1 from couple_members a
    join couple_members b on a.couple_id = b.couple_id
    join couples c on c.id = a.couple_id
    where a.user_id = me and b.user_id = partner.id and c.archived_at is null and c.kind = 'couple'
  ) then raise exception 'already_linked_with'; end if;

  select c.currency into cur from profiles p join couples c on c.id = p.active_couple_id where p.id = me;
  insert into couples (currency, kind) values (coalesce(cur, 'MXN'), 'couple') returning id into new_id;
  insert into couple_members (couple_id, user_id) values (new_id, me), (new_id, partner.id);
  update profiles set active_couple_id = new_id where id = me;
  update profiles set active_couple_id = new_id where id = partner.id and active_couple_id is null;
  return new_id;
end;
$$;

create or replace function public.create_family(p_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
  cur text;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'family_name'; end if;
  select c.currency into cur from profiles p join couples c on c.id = p.active_couple_id where p.id = me;
  insert into couples (currency, kind, name) values (coalesce(cur, 'MXN'), 'family', left(trim(p_name), 40)) returning id into new_id;
  insert into couple_members (couple_id, user_id) values (new_id, me);
  update profiles set active_couple_id = new_id where id = me;
  return new_id;
end;
$$;

create or replace function public.add_member_by_code(p_couple uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  member profiles;
begin
  if not is_member(p_couple) then raise exception 'not_linked'; end if;
  if not exists (select 1 from couples where id = p_couple and kind = 'family' and archived_at is null) then raise exception 'not_family'; end if;
  select * into member from profiles where code = upper(trim(p_code)) and not is_demo;
  if not found then raise exception 'code_not_found'; end if;
  if member.id = me then raise exception 'own_code'; end if;
  if exists (select 1 from couple_members where couple_id = p_couple and user_id = member.id) then raise exception 'already_member'; end if;
  insert into couple_members (couple_id, user_id) values (p_couple, member.id);
  update profiles set active_couple_id = p_couple where id = member.id and active_couple_id is null;
end;
$$;

-- Creates a request already approved by its author (and by sample partners), and runs it if nobody else must approve.
create or replace function public.create_request(p_couple uuid, p_kind text, p_amount numeric default null, p_goal uuid default null, p_note text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if not is_member(p_couple) then raise exception 'not_linked'; end if;
  if exists (select 1 from couples where id = p_couple and archived_at is not null) then raise exception 'not_linked'; end if;
  if p_kind = 'withdraw' then
    if coalesce(p_amount, 0) <= 0 then raise exception 'amount_positive'; end if;
    if p_amount > nest_balance(p_couple, false, p_goal) then raise exception 'insufficient_funds'; end if;
  elsif p_kind = 'leave' then
    if not exists (select 1 from couples where id = p_couple and kind = 'family') then raise exception 'not_family'; end if;
  elsif p_kind <> 'dissolve' then
    raise exception 'invalid_request';
  end if;
  if p_kind <> 'withdraw' and exists (
    select 1 from approval_requests where couple_id = p_couple and kind = p_kind and status = 'pending' and (p_kind = 'dissolve' or "by" = me)
  ) then raise exception 'request_pending'; end if;

  insert into approval_requests (couple_id, kind, "by", amount, goal_id, note, approvals)
  values (
    p_couple, p_kind, me, case when p_kind = 'withdraw' then p_amount end, case when p_kind = 'withdraw' then p_goal end, left(coalesce(trim(p_note), ''), 140),
    array[me] || array(select cm.user_id from couple_members cm join profiles p on p.id = cm.user_id where cm.couple_id = p_couple and p.is_demo)
  )
  returning id into new_id;
  perform resolve_request(new_id);
  return new_id;
end;
$$;

create or replace function public.approve_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  cid uuid;
begin
  select couple_id into cid from approval_requests where id = p_request and status = 'pending';
  if cid is null or not is_member(cid) then raise exception 'not_linked'; end if;
  update approval_requests set approvals = array_append(approvals, me) where id = p_request and not (me = any (approvals));
  perform resolve_request(p_request);
end;
$$;

create or replace function public.reject_request(p_request uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
begin
  select couple_id into cid from approval_requests where id = p_request and status = 'pending';
  if cid is null or not is_member(cid) then raise exception 'not_linked'; end if;
  update approval_requests set status = 'rejected', rejected_by = auth.uid(), resolved_at = now() where id = p_request;
end;
$$;

create or replace function public.cancel_request(p_request uuid)
returns void language sql security definer set search_path = public as $$
  update approval_requests set status = 'cancelled', resolved_at = now()
  where id = p_request and "by" = auth.uid() and status = 'pending';
$$;

grant execute on function
  public.link_with_code(text), public.create_family(text), public.add_member_by_code(uuid, text),
  public.create_request(uuid, text, numeric, uuid, text), public.approve_request(uuid), public.reject_request(uuid), public.cancel_request(uuid)
  to authenticated;
revoke execute on function
  public.link_with_code(text), public.create_family(text), public.add_member_by_code(uuid, text),
  public.create_request(uuid, text, numeric, uuid, text), public.approve_request(uuid), public.reject_request(uuid), public.cancel_request(uuid)
  from anon;

alter publication supabase_realtime add table public.approval_requests;
