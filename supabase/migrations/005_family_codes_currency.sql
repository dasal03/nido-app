-- ============================================================================
-- Nido · migration 005: family invite codes and currency conversion
-- Run after 004_delete_account.sql (SQL Editor → New query → paste → Run).
--
-- * Every family group gets its own code (FAM-XXXXX). Anyone with the code (or its QR/link)
--   can join the family.
-- * Changing a nest's currency converts every amount (movements, goals, automatic
--   contributions, pending requests) with the exchange rate, instead of only relabeling them.
-- ============================================================================

alter table public.couples add column if not exists invite_code text unique;

create or replace function public.generate_family_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
begin
  loop
    candidate := 'FAM-';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from couples where invite_code = candidate);
  end loop;
  return candidate;
end;
$$;

update public.couples set invite_code = generate_family_code() where kind = 'family' and invite_code is null;

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
  insert into couples (currency, kind, name, invite_code)
  values (coalesce(cur, 'MXN'), 'family', left(trim(p_name), 40), generate_family_code())
  returning id into new_id;
  insert into couple_members (couple_id, user_id) values (new_id, me);
  update profiles set active_couple_id = new_id where id = me;
  return new_id;
end;
$$;

-- Joins the family whose invite code is `p_code` and makes it the caller's active nest.
create or replace function public.join_family(p_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  fam uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select id into fam from couples where invite_code = upper(trim(p_code)) and kind = 'family' and archived_at is null;
  if fam is null then raise exception 'code_not_found'; end if;
  if exists (select 1 from couple_members where couple_id = fam and user_id = me) then raise exception 'already_member'; end if;
  insert into couple_members (couple_id, user_id) values (fam, me);
  update profiles set active_couple_id = fam where id = me;
  return fam;
end;
$$;

-- Converts every amount of the nest with `p_rate` (1 old unit = p_rate new units).
create or replace function public.change_currency(p_couple uuid, p_currency text, p_rate numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_member(p_couple) then raise exception 'not_linked'; end if;
  if exists (select 1 from couples where id = p_couple and archived_at is not null) then raise exception 'not_linked'; end if;
  if p_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_currency'; end if;
  if p_rate is null or p_rate <= 0 then raise exception 'invalid_rate'; end if;
  if exists (select 1 from couples where id = p_couple and currency = p_currency) then return; end if;

  update transactions set amount = greatest(round(amount * p_rate, 2), 0.01) where couple_id = p_couple;
  update goals set target = greatest(round(target * p_rate, 2), 0.01) where couple_id = p_couple;
  update recurring_rules set amount = greatest(round(amount * p_rate, 2), 0.01) where couple_id = p_couple;
  update approval_requests set amount = greatest(round(amount * p_rate, 2), 0.01) where couple_id = p_couple and amount is not null;
  update couples set currency = p_currency where id = p_couple;
end;
$$;

-- The currency can only change through change_currency (so amounts are always converted).
revoke update on public.couples from authenticated;
grant update (name, split, pet_name) on public.couples to authenticated;

revoke execute on function public.generate_family_code() from public, anon, authenticated;
grant execute on function public.create_family(text), public.join_family(text), public.change_currency(uuid, text, numeric) to authenticated;
revoke execute on function public.create_family(text), public.join_family(text), public.change_currency(uuid, text, numeric) from anon;
