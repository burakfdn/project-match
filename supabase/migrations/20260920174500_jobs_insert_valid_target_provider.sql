-- Fix jobs INSERT when target_provider_id is set.
-- Nested SELECT RLS on profiles / provider_profiles made the
-- previous EXISTS check false for other users.
-- Does not change jobs SELECT policies, profiles/provider_profiles
-- SELECT policies, or jobs columns.

create or replace function public.is_valid_target_provider(
  p_provider_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles as profile
    inner join public.provider_profiles as provider_profile
      on provider_profile.user_id = profile.id
    where profile.id = p_provider_id
      and coalesce(profile.provider_enabled, false) = true
      and profile.role = 'provider'
  );
$$;

revoke all on function public.is_valid_target_provider(uuid)
  from public;
revoke all on function public.is_valid_target_provider(uuid)
  from anon;
grant execute on function public.is_valid_target_provider(uuid)
  to authenticated;

do $$
declare
  policy_name text;
begin
  select pol.policyname
  into policy_name
  from pg_policies as pol
  where pol.schemaname = 'public'
    and pol.tablename = 'jobs'
    and pol.cmd = 'INSERT'
    and pol.with_check ilike '%customer_id%'
  order by pol.policyname
  limit 1;

  if policy_name is null then
    raise exception
      'public.jobs INSERT policy with customer_id check not found';
  end if;

  execute format(
    'drop policy if exists %I on public.jobs',
    policy_name
  );

  execute format(
    $sql$
      create policy %I
      on public.jobs
      for insert
      to authenticated
      with check (
        auth.uid() = customer_id
        and status = 'open'
        and exists (
          select 1
          from public.profiles as profile
          where profile.id = auth.uid()
            and coalesce(profile.customer_enabled, false) = true
        )
        and (
          target_provider_id is null
          or public.is_valid_target_provider(target_provider_id)
        )
      )
    $sql$,
    policy_name
  );
end
$$;
