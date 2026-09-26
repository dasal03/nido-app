-- ============================================================================
-- Nido · migration 004: delete your own account (required by the App Store and Google Play)
-- Run after 003_groups_approvals.sql (SQL Editor → New query → paste → Run).
--
-- * You must first leave or dissolve every active nest you share with real people, so
--   nobody loses money or history without approving it.
-- * Nests you have alone (or only with a sample partner) are archived.
-- * Your profile is anonymized ("Cuenta eliminada") so other members' history stays readable,
--   your private data (birthday, document…) is deleted, and the sign-in account is removed.
-- ============================================================================

create or replace function public.delete_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if exists (
    select 1 from couple_members mine
    join couples c on c.id = mine.couple_id and c.archived_at is null
    join couple_members other on other.couple_id = c.id and other.user_id <> me
    join profiles p on p.id = other.user_id and not p.is_demo
    where mine.user_id = me
  ) then raise exception 'active_nests'; end if;

  update couples set archived_at = now()
  where archived_at is null and id in (select couple_id from couple_members where user_id = me);
  update recurring_rules set active = false where "by" = me;
  update approval_requests set status = 'cancelled', resolved_at = now() where "by" = me and status = 'pending';

  delete from profile_private where id = me;
  update profiles set
    name = 'Cuenta eliminada',
    username = 'deleted_' || substr(replace(me::text, '-', ''), 1, 12),
    email = '',
    phone = '',
    photo = null,
    active_couple_id = null
  where id = me;

  delete from auth.users where id = me;
end;
$$;

grant execute on function public.delete_account() to authenticated;
revoke execute on function public.delete_account() from anon;
