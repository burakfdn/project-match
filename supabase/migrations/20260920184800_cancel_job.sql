-- Customer job cancellation.
-- Adds cancellation fields and cancel_my_job RPC.
-- Does not change offers, accept_offer, complete_my_job,
-- reviews, messaging, matching, or jobs SELECT policies.

alter table public.jobs
  add column if not exists cancellation_reason text;

alter table public.jobs
  add column if not exists cancellation_note text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint as con
    where con.conrelid = 'public.jobs'::regclass
      and con.conname = 'jobs_cancellation_reason_check'
  ) then
    alter table public.jobs
      add constraint jobs_cancellation_reason_check
      check (
        cancellation_reason is null
        or cancellation_reason in (
          'no_longer_needed',
          'found_external_provider',
          'no_suitable_budget',
          'created_by_mistake',
          'project_postponed',
          'other'
        )
      );
  end if;
end
$$;

create or replace function public.cancel_my_job(
  p_job_id bigint,
  p_cancellation_reason text,
  p_cancellation_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  job_customer_id uuid;
  job_status text;
  note_text text;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_job_id is null then
    raise exception 'İlan bulunamadı.';
  end if;

  if p_cancellation_reason is null
    or p_cancellation_reason not in (
      'no_longer_needed',
      'found_external_provider',
      'no_suitable_budget',
      'created_by_mistake',
      'project_postponed',
      'other'
    )
  then
    raise exception 'Geçerli bir iptal nedeni seç.';
  end if;

  note_text := nullif(btrim(coalesce(p_cancellation_note, '')), '');

  if p_cancellation_reason = 'other' and note_text is null then
    raise exception 'Diğer nedeni seçtiğinde açıklama yazmalısın.';
  end if;

  if p_cancellation_reason <> 'other' then
    note_text := null;
  end if;

  select job.customer_id, job.status
  into job_customer_id, job_status
  from public.jobs as job
  where job.id = p_job_id
  for update;

  if job_customer_id is null then
    raise exception 'İlan bulunamadı.';
  end if;

  if job_customer_id <> current_user_id then
    raise exception 'Bu ilanı iptal etme yetkin yok.';
  end if;

  if job_status <> 'open' then
    raise exception 'Yalnızca açık ilanlar iptal edilebilir.';
  end if;

  if exists (
    select 1
    from public.offers as offer
    where offer.job_id = p_job_id
      and offer.status = 'pending'
  ) then
    raise exception
      'Bu ilanda bekleyen bir teklif var. Teklif sonuçlandıktan sonra ilanı iptal edebilirsin.';
  end if;

  update public.jobs
  set
    status = 'cancelled',
    cancellation_reason = p_cancellation_reason,
    cancellation_note = note_text,
    updated_at = now()
  where id = p_job_id;
end;
$$;

revoke all on function public.cancel_my_job(bigint, text, text)
  from public;
revoke all on function public.cancel_my_job(bigint, text, text)
  from anon;
grant execute on function public.cancel_my_job(bigint, text, text)
  to authenticated;
