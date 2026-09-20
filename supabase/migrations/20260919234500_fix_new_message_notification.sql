-- Fix new_message trigger after conversations.job_id was dropped.
-- Does not change conversations schema, can_access_conversation,
-- get_or_create_conversation, or offer/job notification triggers.

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recipient_id uuid;
  sender_name text;
  latest_job_id bigint;
  notification_text text;
begin
  select
    case
      when conversation.participant_low = new.sender_id
        then conversation.participant_high
      else conversation.participant_low
    end
  into recipient_id
  from public.conversations as conversation
  where conversation.id = new.conversation_id;

  if recipient_id is null or recipient_id = new.sender_id then
    return new;
  end if;

  select coalesce(
    nullif(btrim(profile.full_name), ''),
    'Bir kullanıcı'
  )
  into sender_name
  from public.profiles as profile
  where profile.id = new.sender_id;

  notification_text := format(
    '%s sana yeni bir mesaj gönderdi.',
    coalesce(sender_name, 'Bir kullanıcı')
  );

  select conversation_job.job_id
  into latest_job_id
  from public.conversation_jobs as conversation_job
  where conversation_job.conversation_id = new.conversation_id
  order by conversation_job.created_at desc, conversation_job.job_id desc
  limit 1;

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
    recipient_id,
    'new_message',
    notification_text,
    notification_text,
    format('/messages/%s', new.conversation_id),
    latest_job_id,
    new.sender_id,
    null,
    new.conversation_id,
    new.id,
    null
  );

  return new;
end;
$$;

revoke all on function public.notify_new_message() from public;
revoke all on function public.notify_new_message() from anon;
revoke all on function public.notify_new_message() from authenticated;

do $$
declare
  trig record;
  src text;
begin
  for trig in
    select
      trigger_row.tgname as trigger_name,
      procedure_row.oid as procedure_oid
    from pg_trigger as trigger_row
    inner join pg_class as table_row
      on table_row.oid = trigger_row.tgrelid
    inner join pg_namespace as table_namespace
      on table_namespace.oid = table_row.relnamespace
    inner join pg_proc as procedure_row
      on procedure_row.oid = trigger_row.tgfoid
    where table_namespace.nspname = 'public'
      and table_row.relname = 'messages'
      and not trigger_row.tgisinternal
  loop
    src := pg_get_functiondef(trig.procedure_oid);

    if src ilike '%notifications%'
      or src ilike '%new_message%'
    then
      execute format(
        'drop trigger if exists %I on public.messages',
        trig.trigger_name
      );
    end if;
  end loop;
end;
$$;

drop trigger if exists messages_notify_new_message on public.messages;

create trigger messages_notify_new_message
  after insert on public.messages
  for each row
  execute procedure public.notify_new_message();

update public.notifications as notification
set
  title = format(
    '%s sana yeni bir mesaj gönderdi.',
    coalesce(nullif(btrim(profile.full_name), ''), 'Bir kullanıcı')
  ),
  body = format(
    '%s sana yeni bir mesaj gönderdi.',
    coalesce(nullif(btrim(profile.full_name), ''), 'Bir kullanıcı')
  )
from public.profiles as profile
where notification.type = 'new_message'
  and notification.actor_id = profile.id;

update public.notifications
set
  title = 'Bir kullanıcı sana yeni bir mesaj gönderdi.',
  body = 'Bir kullanıcı sana yeni bir mesaj gönderdi.'
where type = 'new_message'
  and (
    title is null
    or body is null
    or title not ilike '%sana yeni bir mesaj gönderdi.%'
    or body not ilike '%sana yeni bir mesaj gönderdi.%'
  );

notify pgrst, 'reload schema';
