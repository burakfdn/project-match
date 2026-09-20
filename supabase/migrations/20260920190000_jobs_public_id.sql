-- Public job IDs for user-facing URLs.
-- Keeps jobs.id bigint as PK. Does not change FKs, matching, RLS,
-- offers, reviews, chat, preview, or existing mutation RPC signatures.
-- Does not rewrite historical notification.href rows.

alter table public.jobs
  add column if not exists public_id uuid;

update public.jobs
set public_id = gen_random_uuid()
where public_id is null;

alter table public.jobs
  alter column public_id set default gen_random_uuid();

alter table public.jobs
  alter column public_id set not null;

create unique index if not exists jobs_public_id_uidx
  on public.jobs (public_id);

create or replace function public.resolve_job_route(p_ref text)
returns table (id bigint, public_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uuid uuid;
  v_id bigint;
begin
  if p_ref is null or btrim(p_ref) = '' then
    return;
  end if;

  begin
    v_uuid := btrim(p_ref)::uuid;
  exception
    when invalid_text_representation then
      v_uuid := null;
  end;

  if v_uuid is not null then
    return query
      select j.id, j.public_id
      from public.jobs j
      where j.public_id = v_uuid;
    return;
  end if;

  begin
    v_id := btrim(p_ref)::bigint;
  exception
    when invalid_text_representation then
      return;
  end;

  if v_id is null then
    return;
  end if;

  return query
    select j.id, j.public_id
    from public.jobs j
    where j.id = v_id;
end;
$$;

revoke all on function public.resolve_job_route(text) from public;
revoke all on function public.resolve_job_route(text) from anon;
grant execute on function public.resolve_job_route(text) to authenticated;

create or replace function public.get_job_public_ids(p_job_ids bigint[])
returns table (id bigint, public_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select j.id, j.public_id
  from public.jobs j
  where j.id = any (p_job_ids);
$$;

revoke all on function public.get_job_public_ids(bigint[]) from public;
revoke all on function public.get_job_public_ids(bigint[]) from anon;
grant execute on function public.get_job_public_ids(bigint[]) to authenticated;

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
    format('/jobs/%s', new.public_id),
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
