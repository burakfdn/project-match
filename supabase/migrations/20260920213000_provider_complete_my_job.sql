-- Allow the accepted offer provider (not the customer) to complete
-- an in_progress job via complete_my_job.
-- Does not change accept_offer, reject_offer, reviews, matching, or RLS.
-- Notification/trigger behavior on jobs.status remains as currently defined
-- on the jobs table (this function only updates status).

create or replace function public.complete_my_job(
  p_job_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  job_status text;
  accepted_provider_id uuid;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_job_id is null then
    raise exception 'İlan bulunamadı.';
  end if;

  select job.status
  into job_status
  from public.jobs as job
  where job.id = p_job_id
  for update;

  if job_status is null then
    raise exception 'İlan bulunamadı.';
  end if;

  if job_status <> 'in_progress' then
    raise exception 'Yalnızca devam eden işler tamamlanabilir.';
  end if;

  select offer.provider_id
  into accepted_provider_id
  from public.offers as offer
  where offer.job_id = p_job_id
    and offer.status = 'accepted'
  limit 1;

  if accepted_provider_id is null
    or accepted_provider_id <> current_user_id
  then
    raise exception 'Bu işi tamamlama yetkin yok.';
  end if;

  update public.jobs
  set
    status = 'completed',
    updated_at = now()
  where id = p_job_id;
end;
$$;

revoke all on function public.complete_my_job(bigint) from public;
revoke all on function public.complete_my_job(bigint) from anon;
grant execute on function public.complete_my_job(bigint) to authenticated;
