-- ============================================================================
-- Nido · Supabase schema
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Every table uses Row Level Security: a person only sees nests they belong to.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key,                       -- = auth.users.id (demo partners get a random id)
  code text not null unique,                 -- shareable "NIDO-XXXXX"
  name text not null,
  username text not null unique check (username ~ '^[a-z0-9._]{3,20}$'),
  email text not null default '',
  phone text not null default '',
  birthday text not null default '',
  photo text,                                -- small JPEG data URI
  active_couple_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.couples (
  id uuid primary key default gen_random_uuid(),
  name text,
  currency text not null default 'MXN',
  split jsonb,                               -- { "<user id>": percent }
  pet_name text,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

alter table public.profiles
  add constraint profiles_active_couple_fk foreign key (active_couple_id) references public.couples (id) on delete set null;

create table public.couple_members (
  couple_id uuid not null references public.couples (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (couple_id, user_id)
);
create index on public.couple_members (user_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  name text not null,
  icon text not null,
  target numeric(14, 2) not null check (target > 0),
  color text not null,
  deadline timestamptz,
  created_at timestamptz not null default now()
);
create index on public.goals (couple_id);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  "by" uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  goal_id uuid references public.goals (id) on delete set null,
  frequency text not null check (frequency in ('weekly', 'biweekly', 'monthly')),
  next_date timestamptz not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.recurring_rules (couple_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references public.couples (id) on delete cascade,
  type text not null check (type in ('deposit', 'withdraw')),
  amount numeric(14, 2) not null check (amount > 0),
  "by" uuid not null references public.profiles (id) on delete cascade,
  goal_id uuid references public.goals (id) on delete set null,
  note text not null default '',
  date timestamptz not null default now(),
  recurring_id uuid references public.recurring_rules (id) on delete set null
);
create index on public.transactions (couple_id, date desc);

create table public.reactions (
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  primary key (transaction_id, user_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  "by" uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 280),
  date timestamptz not null default now()
);
create index on public.comments (transaction_id);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can use them without recursion)
-- ---------------------------------------------------------------------------

create or replace function public.is_member(p_couple uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from couple_members where couple_id = p_couple and user_id = auth.uid());
$$;

create or replace function public.shares_couple(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from couple_members a join couple_members b on a.couple_id = b.couple_id
    where a.user_id = auth.uid() and b.user_id = p_user
  );
$$;

create or replace function public.transaction_couple(p_tx uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select couple_id from transactions where id = p_tx;
$$;

create or replace function public.generate_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'NIDO-';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from profiles where code = candidate);
  end loop;
  return candidate;
end;
$$;

-- Creates the profile when someone signs up (name, username and phone come from the sign-up metadata).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, code, name, username, email, phone)
  values (
    new.id,
    generate_code(),
    coalesce(new.raw_user_meta_data ->> 'name', ''),
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RPCs used by the app
-- ---------------------------------------------------------------------------

-- Sign-up check (callable before signing in).
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(trim(p_username)));
$$;

-- Lets people sign in with their username: resolves it to the account email.
create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = public as $$
  select email from profiles where username = lower(trim(both '@' from trim(p_username))) and not is_demo;
$$;

-- Links the caller with the owner of `p_code`, creating a new nest (active for the caller).
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
    where a.user_id = me and b.user_id = partner.id and c.archived_at is null
  ) then raise exception 'already_linked_with'; end if;

  select c.currency into cur from profiles p join couples c on c.id = p.active_couple_id where p.id = me;
  insert into couples (currency) values (coalesce(cur, 'MXN')) returning id into new_id;
  insert into couple_members (couple_id, user_id) values (new_id, me), (new_id, partner.id);
  update profiles set active_couple_id = new_id where id = me;
  update profiles set active_couple_id = new_id where id = partner.id and active_couple_id is null;
  return new_id;
end;
$$;

-- Creates a sample partner (not a real account) with example goals and activity.
create or replace function public.create_demo_nest(
  p_partner uuid, p_goals jsonb, p_transactions jsonb, p_reactions jsonb, p_comments jsonb
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  new_id uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  insert into profiles (id, code, name, username, is_demo)
  values (p_partner, generate_code(), 'Ana', 'ana.' || substr(replace(p_partner::text, '-', ''), 1, 10), true);
  insert into couples default values returning id into new_id;
  insert into couple_members (couple_id, user_id) values (new_id, me), (new_id, p_partner);
  update profiles set active_couple_id = new_id where id = me;

  insert into goals (id, couple_id, name, icon, target, color, deadline, created_at)
  select g.id, new_id, g.name, g.icon, g.target, g.color, g.deadline, g."createdAt"
  from jsonb_to_recordset(p_goals) as g(id uuid, name text, icon text, target numeric, color text, deadline timestamptz, "createdAt" timestamptz);

  insert into transactions (id, couple_id, type, amount, "by", goal_id, note, date)
  select t.id, new_id, t.type, t.amount, t."by", t."goalId", coalesce(t.note, ''), t.date
  from jsonb_to_recordset(p_transactions) as t(id uuid, type text, amount numeric, "by" uuid, "goalId" uuid, note text, date timestamptz)
  where t."by" in (me, p_partner);

  insert into reactions (transaction_id, user_id, emoji)
  select r."transactionId", r."userId", r.emoji
  from jsonb_to_recordset(p_reactions) as r("transactionId" uuid, "userId" uuid, emoji text)
  where r."userId" in (me, p_partner);

  insert into comments (id, transaction_id, "by", text, date)
  select c.id, c."transactionId", c."by", c.text, c.date
  from jsonb_to_recordset(p_comments) as c(id uuid, "transactionId" uuid, "by" uuid, text text, date timestamptz)
  where c."by" in (me, p_partner);

  return new_id;
end;
$$;

-- Ends a nest for both members: archives it and moves each member to another nest (or none).
create or replace function public.unlink_couple(p_couple uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_couple) then raise exception 'not_linked'; end if;
  update couples set archived_at = now() where id = p_couple;
  update profiles p set active_couple_id = (
    select cm.couple_id from couple_members cm join couples c on c.id = cm.couple_id
    where cm.user_id = p.id and c.archived_at is null
    order by cm.joined_at desc limit 1
  )
  where p.active_couple_id = p_couple;
end;
$$;

grant execute on function public.username_available(text), public.email_for_username(text) to anon, authenticated;
grant execute on function public.link_with_code(text), public.create_demo_nest(uuid, jsonb, jsonb, jsonb, jsonb), public.unlink_couple(uuid) to authenticated;
revoke execute on function public.link_with_code(text), public.create_demo_nest(uuid, jsonb, jsonb, jsonb, jsonb), public.unlink_couple(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.couples enable row level security;
alter table public.couple_members enable row level security;
alter table public.goals enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.transactions enable row level security;
alter table public.reactions enable row level security;
alter table public.comments enable row level security;

-- Profiles: yourself and anyone you share (or shared) a nest with. You can only edit your own.
create policy "profiles: read self and partners" on public.profiles for select to authenticated
  using (id = auth.uid() or shares_couple(id));
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name, username, phone, birthday, photo, active_couple_id) on public.profiles to authenticated;

-- Couples: members only. Archiving goes through unlink_couple().
create policy "couples: read as member" on public.couples for select to authenticated using (is_member(id));
create policy "couples: update as member" on public.couples for update to authenticated
  using (is_member(id) and archived_at is null) with check (is_member(id));
revoke update on public.couples from authenticated;
grant update (name, currency, split, pet_name) on public.couples to authenticated;

create policy "members: read own nests" on public.couple_members for select to authenticated using (is_member(couple_id));

create policy "goals: members" on public.goals for all to authenticated
  using (is_member(couple_id)) with check (is_member(couple_id));

create policy "recurring: read" on public.recurring_rules for select to authenticated using (is_member(couple_id));
create policy "recurring: create own" on public.recurring_rules for insert to authenticated
  with check (is_member(couple_id) and "by" = auth.uid());
create policy "recurring: update own" on public.recurring_rules for update to authenticated
  using ("by" = auth.uid()) with check ("by" = auth.uid() and is_member(couple_id));
create policy "recurring: delete own" on public.recurring_rules for delete to authenticated using ("by" = auth.uid());

create policy "transactions: read" on public.transactions for select to authenticated using (is_member(couple_id));
create policy "transactions: create own" on public.transactions for insert to authenticated
  with check (is_member(couple_id) and "by" = auth.uid());

create policy "reactions: read" on public.reactions for select to authenticated using (is_member(transaction_couple(transaction_id)));
create policy "reactions: write own" on public.reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid() and is_member(transaction_couple(transaction_id)));

create policy "comments: read" on public.comments for select to authenticated using (is_member(transaction_couple(transaction_id)));
create policy "comments: create own" on public.comments for insert to authenticated
  with check ("by" = auth.uid() and is_member(transaction_couple(transaction_id)));

-- ---------------------------------------------------------------------------
-- Realtime: both phones refresh as soon as the other one changes something
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table
  public.profiles, public.couples, public.couple_members, public.goals,
  public.recurring_rules, public.transactions, public.reactions, public.comments;
