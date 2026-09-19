-- Target-provider visibility and offers.
-- Adds permissive extra policies (OR'd with existing ones).
-- Does not drop or rewrite existing jobs/offers policies.
-- Does not change jobs INSERT/UPDATE, accept_offer, reject_offer,
-- or notifications. Does not alter target_provider_id itself.

create policy jobs_select_open_target_provider
  on public.jobs
  for select
  to authenticated
  using (
    status = 'open'
    and target_provider_id = auth.uid()
  );

create policy offers_insert_open_target_provider
  on public.offers
  for insert
  to authenticated
  with check (
    provider_id = auth.uid()
    and exists (
      select 1
      from public.jobs as job
      where job.id = job_id
        and job.status = 'open'
        and job.target_provider_id = auth.uid()
    )
  );

do $$
declare
  src text;
  updated text;
begin
  select pg_get_functiondef(p.oid)
  into src
  from pg_proc as p
  join pg_namespace as n
    on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'get_job_for_offer'
    and pg_catalog.pg_get_function_identity_arguments(p.oid)
      in ('p_job_id bigint', 'bigint')
  limit 1;

  if src is null then
    raise exception
      'public.get_job_for_offer(bigint) not found';
  end if;

  if src ilike '%target_provider_id%' then
    raise notice
      'get_job_for_offer already references target_provider_id';
    return;
  end if;

  updated := regexp_replace(
    src,
    'j\.id\s*=\s*p_job_id\s+and\s*\(',
    $re$j.id = p_job_id
    and (
      (j.status = 'open' and j.target_provider_id = auth.uid())
      or $re$,
    'i'
  );

  if updated = src then
    updated := regexp_replace(
      src,
      'jobs\.id\s*=\s*p_job_id\s+and\s*\(',
      $re$jobs.id = p_job_id
      and (
        (jobs.status = 'open' and jobs.target_provider_id = auth.uid())
        or $re$,
      'i'
    );
  end if;

  if updated = src then
    raise exception
      'Could not patch get_job_for_offer WHERE clause automatically.';
  end if;

  execute updated;
end
$$;
