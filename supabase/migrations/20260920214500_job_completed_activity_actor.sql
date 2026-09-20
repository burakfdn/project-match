-- job.completed activity actor is the accepted offer provider,
-- not auth.uid() / hardcoded customer.
-- Does not change complete_my_job, other job events, or offer/review/message logs.

drop function if exists public.log_activity_event(
  text, text, text, bigint, uuid, bigint, jsonb
);

create function public.log_activity_event(
  p_event_type text,
  p_actor_role text default null,
  p_entity_type text default null,
  p_entity_id bigint default null,
  p_entity_uuid uuid default null,
  p_job_id bigint default null,
  p_metadata jsonb default '{}'::jsonb,
  p_actor_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_role text;
begin
  if p_event_type is null or btrim(p_event_type) = '' then
    return;
  end if;

  v_actor_id := coalesce(p_actor_id, auth.uid());

  v_actor_role := case
    when p_actor_role in ('customer', 'provider', 'admin', 'system')
      then p_actor_role
    else null
  end;

  if v_actor_role = 'admin' then
    if not exists (
      select 1
      from public.profiles as profile
      where profile.id = v_actor_id
        and profile.is_admin = true
    ) then
      return;
    end if;
  end if;

  if v_actor_role = 'system' then
    v_actor_id := null;
  end if;

  insert into public.admin_activity_events (
    actor_id,
    actor_role,
    event_type,
    entity_type,
    entity_id,
    entity_uuid,
    job_id,
    metadata
  ) values (
    v_actor_id,
    v_actor_role,
    btrim(p_event_type),
    p_entity_type,
    p_entity_id,
    p_entity_uuid,
    p_job_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
exception
  when others then
    raise warning 'log_activity_event failed: %', sqlerrm;
end;
$$;

revoke all on function public.log_activity_event(
  text, text, text, bigint, uuid, bigint, jsonb, uuid
) from public, anon, authenticated;

create or replace function public.admin_activity_log_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_accepted_provider_id uuid;
begin
  if tg_op = 'INSERT' then
    perform public.log_activity_event(
      'job.created',
      'customer',
      'job',
      new.id,
      null,
      new.id,
      jsonb_build_object('status', new.status)
    );
    return new;
  end if;

  if old.status is distinct from new.status then
    if new.status = 'cancelled' then
      perform public.log_activity_event(
        'job.cancelled',
        'customer',
        'job',
        new.id,
        null,
        new.id,
        jsonb_build_object(
          'from_status', old.status,
          'to_status', new.status,
          'cancellation_reason', new.cancellation_reason
        )
      );
    elsif new.status = 'completed' then
      select offer.provider_id
      into v_accepted_provider_id
      from public.offers as offer
      where offer.job_id = new.id
        and offer.status = 'accepted'
      limit 1;

      perform public.log_activity_event(
        'job.completed',
        'provider',
        'job',
        new.id,
        null,
        new.id,
        jsonb_build_object(
          'from_status', old.status,
          'to_status', new.status
        ),
        v_accepted_provider_id
      );
    end if;

    return new;
  end if;

  if old.title is distinct from new.title
    or old.description is distinct from new.description
    or old.budget is distinct from new.budget
    or old.city is distinct from new.city
    or old.location_type is distinct from new.location_type
    or old.deadline is distinct from new.deadline
    or old.service_id is distinct from new.service_id
  then
    perform public.log_activity_event(
      'job.updated',
      'customer',
      'job',
      new.id,
      null,
      new.id,
      jsonb_build_object('status', new.status)
    );
  end if;

  return new;
exception
  when others then
    raise warning 'admin_activity_log_jobs failed: %', sqlerrm;
    return new;
end;
$$;
