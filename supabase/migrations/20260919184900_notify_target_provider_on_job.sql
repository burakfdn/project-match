-- Notify the targeted provider when a job is created with
-- target_provider_id. Follows existing trigger-based notifications
-- (no client INSERT). Does not change jobs/offers RLS, matching,
-- or offer/message notification triggers.

do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint as con
  where con.conrelid = 'public.notifications'::regclass
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%offer_received%';

  if constraint_name is not null then
    execute format(
      'alter table public.notifications drop constraint %I',
      constraint_name
    );
  end if;
end
$$;

alter table public.notifications
  add constraint notifications_type_check
  check (
    type in (
      'offer_received',
      'offer_accepted',
      'offer_rejected',
      'new_message',
      'project_invitation'
    )
  );

create unique index if not exists
  notifications_project_invitation_job_user_uidx
  on public.notifications (job_id, user_id)
  where type = 'project_invitation';

create or replace function public.notify_target_provider_on_job_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  customer_name text;
begin
  if new.target_provider_id is null then
    return new;
  end if;

  if new.target_provider_id = new.customer_id then
    return new;
  end if;

  if exists (
    select 1
    from public.notifications as notification
    where notification.type = 'project_invitation'
      and notification.job_id = new.id
      and notification.user_id = new.target_provider_id
  ) then
    return new;
  end if;

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    'Bir proje sahibi'
  )
  into customer_name
  from public.profiles as profile
  where profile.id = new.customer_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    body,
    href,
    job_id,
    actor_id,
    offer_id,
    conversation_id,
    message_id,
    read_at
  ) values (
    new.target_provider_id,
    'project_invitation',
    'Sana özel bir proje oluşturuldu',
    format(
      '%s, “%s” başlıklı bir proje oluşturdu.',
      coalesce(customer_name, 'Bir proje sahibi'),
      new.title
    ),
    format('/jobs/%s', new.id),
    new.id,
    new.customer_id,
    null,
    null,
    null,
    null
  );

  return new;
end;
$$;

revoke all on function public.notify_target_provider_on_job_insert()
  from public;
revoke all on function public.notify_target_provider_on_job_insert()
  from authenticated;
revoke all on function public.notify_target_provider_on_job_insert()
  from anon;

drop trigger if exists jobs_notify_target_provider
  on public.jobs;

create trigger jobs_notify_target_provider
  after insert on public.jobs
  for each row
  when (new.target_provider_id is not null)
  execute procedure public.notify_target_provider_on_job_insert();
