-- Admin opt-in for provider marketplace discovery.
-- Does not change role, is_admin, active_mode, provider_enabled,
-- customer_enabled, RLS policies, or other RPCs besides discover_providers.

alter table public.profiles
  add column if not exists provider_discoverable boolean not null default false;

create or replace function public.set_my_provider_discoverable(
  p_discoverable boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_discoverable is null then
    raise exception 'Geçersiz değer.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
      and coalesce(profile.is_admin, false) = true
      and coalesce(profile.provider_enabled, false) = true
  ) then
    raise exception 'Bu ayar yalnızca uzman hesabı aktif adminler içindir.';
  end if;

  update public.profiles
  set provider_discoverable = p_discoverable
  where id = current_user_id;
end;
$$;

revoke all on function public.set_my_provider_discoverable(boolean)
  from public, anon;

grant execute on function public.set_my_provider_discoverable(boolean)
  to authenticated;

create or replace function public.discover_providers()
returns table (
  user_id uuid,
  full_name text,
  experience_years integer,
  city text,
  can_work_remote boolean,
  can_work_on_site boolean,
  bio text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  return query
  select
    profile.id,
    profile.full_name::text,
    provider_profile.experience_years::integer,
    provider_profile.city::text,
    provider_profile.can_work_remote,
    provider_profile.can_work_on_site,
    provider_profile.bio::text
  from public.profiles as profile
  inner join public.provider_profiles as provider_profile
    on provider_profile.user_id = profile.id
  where coalesce(profile.provider_enabled, false) = true
    and profile.id <> auth.uid()
    and (
      coalesce(profile.is_admin, false) = false
      or coalesce(profile.provider_discoverable, false) = true
    )
  order by profile.full_name asc nulls last;
end;
$$;

revoke all on function public.discover_providers()
  from public, anon;

grant execute on function public.discover_providers()
  to authenticated;
