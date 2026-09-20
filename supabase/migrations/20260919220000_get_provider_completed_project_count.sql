-- Count completed jobs for a provider without exposing job rows.
-- SECURITY DEFINER so jobs SELECT RLS does not under-count.
-- Does not change jobs/offers policies, reviews, or offer RPCs.

create or replace function public.get_provider_completed_project_count(
  p_provider_id uuid
)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    count(distinct offer.job_id),
    0
  )::integer
  from public.offers as offer
  inner join public.jobs as job
    on job.id = offer.job_id
  where offer.provider_id = p_provider_id
    and offer.status = 'accepted'
    and job.status = 'completed';
$$;

revoke all on function public.get_provider_completed_project_count(uuid)
  from public;

revoke all on function public.get_provider_completed_project_count(uuid)
  from anon;

grant execute on function public.get_provider_completed_project_count(uuid)
  to authenticated;
