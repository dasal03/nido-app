-- ============================================================================
-- Nido · 002 · Identity fields at sign-up
-- Run once after schema.sql: SQL Editor → New query → paste → Run.
--
-- Adds country of residence (public) and a private table for birthday, gender and identity
-- document, readable ONLY by its owner (partners can't see it). Enforces a minimum age of 17
-- and one account per identity document.
-- ============================================================================

alter table public.profiles add column if not exists country text not null default 'CO';

create table if not exists public.profile_private (
  id uuid primary key references public.profiles (id) on delete cascade,
  birthday date,
  gender text not null default '' check (gender in ('', 'female', 'male', 'nonbinary', 'undisclosed')),
  document_country text not null default '',
  document_type text not null default '',
  document_number text not null default ''
);

-- One account per identity document (per issuing country and type).
create unique index if not exists profile_private_document_unique
  on public.profile_private (document_country, document_type, document_number)
  where document_number <> '';

-- Existing accounts get an empty private row, keeping any birthday they had in DD/MM/YYYY or ISO form.
insert into public.profile_private (id, birthday)
select p.id,
  case
    when p.birthday ~ '^\d{4}-\d{2}-\d{2}$' then p.birthday::date
    when p.birthday ~ '^\d{2}/\d{2}/\d{4}$' then to_date(p.birthday, 'DD/MM/YYYY')
  end
from public.profiles p
on conflict (id) do nothing;

alter table public.profile_private enable row level security;

drop policy if exists "private: owner reads" on public.profile_private;
create policy "private: owner reads" on public.profile_private for select to authenticated using (id = auth.uid());
drop policy if exists "private: owner updates" on public.profile_private;
create policy "private: owner updates" on public.profile_private for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- The document can't be changed from the app; birthday and gender can.
revoke update on public.profile_private from authenticated;
grant update (birthday, gender) on public.profile_private to authenticated;

grant update (country) on public.profiles to authenticated;

-- Sign-up: public profile + private row, with minimum-age and document checks.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := new.raw_user_meta_data;
  bday date := nullif(meta ->> 'birthday', '')::date;
begin
  if bday is null or bday > (current_date - interval '17 years') then
    raise exception 'underage';
  end if;
  if exists (
    select 1 from profile_private
    where document_country = coalesce(meta ->> 'country', '')
      and document_type = coalesce(meta ->> 'document_type', '')
      and document_number = upper(coalesce(meta ->> 'document_number', ''))
      and document_number <> ''
  ) then
    raise exception 'document_taken';
  end if;

  insert into profiles (id, code, name, username, email, phone, country)
  values (
    new.id,
    generate_code(),
    coalesce(meta ->> 'name', ''),
    lower(meta ->> 'username'),
    coalesce(new.email, ''),
    coalesce(meta ->> 'phone', ''),
    coalesce(nullif(meta ->> 'country', ''), 'CO')
  );
  insert into profile_private (id, birthday, gender, document_country, document_type, document_number)
  values (
    new.id,
    bday,
    coalesce(meta ->> 'gender', ''),
    coalesce(meta ->> 'country', ''),
    coalesce(meta ->> 'document_type', ''),
    upper(coalesce(meta ->> 'document_number', ''))
  )
  -- `ensure_private_row` already created an empty row when the profile was inserted.
  on conflict (id) do update set
    birthday = excluded.birthday,
    gender = excluded.gender,
    document_country = excluded.document_country,
    document_type = excluded.document_type,
    document_number = excluded.document_number;
  return new;
end;
$$;

-- Demo partners also get a private row so every profile has one.
create or replace function public.ensure_private_row()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profile_private (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists profiles_private_row on public.profiles;
create trigger profiles_private_row after insert on public.profiles for each row execute function public.ensure_private_row();

-- Sign-up check: is this identity document already registered?
create or replace function public.document_available(p_country text, p_type text, p_number text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from profile_private
    where document_country = p_country and document_type = p_type and document_number = upper(trim(p_number))
  );
$$;
grant execute on function public.document_available(text, text, text) to anon, authenticated;

-- The old free-text birthday column on profiles is no longer used (it was visible to partners).
update public.profiles set birthday = '';
