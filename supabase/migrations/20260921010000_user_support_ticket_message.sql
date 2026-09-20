-- User replies on own support tickets + notify owner on admin user-visible replies.
-- Does not change admin_add_support_ticket_message, list/filter RPCs, or analytics.

create or replace function public.add_support_ticket_message(
  p_ticket_id bigint,
  p_message text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_message text;
  v_ticket public.admin_support_tickets%rowtype;
  v_message_id bigint;
  v_actor_role text;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_ticket_id is null then
    raise exception 'Destek talebi bulunamadı.';
  end if;

  v_message := nullif(btrim(coalesce(p_message, '')), '');

  if v_message is null then
    raise exception 'Mesaj boş olamaz.';
  end if;

  select *
  into v_ticket
  from public.admin_support_tickets as ticket
  where ticket.id = p_ticket_id
    and ticket.user_id = current_user_id;

  if not found then
    raise exception 'Destek talebi bulunamadı.';
  end if;

  if v_ticket.status = 'closed' then
    raise exception 'Kapalı talebe mesaj gönderilemez.';
  end if;

  insert into public.admin_support_ticket_messages (
    ticket_id,
    sender_id,
    message,
    visibility
  ) values (
    p_ticket_id,
    current_user_id,
    v_message,
    'user'
  )
  returning id into v_message_id;

  select case
    when profile.provider_enabled and not profile.customer_enabled then 'provider'
    else 'customer'
  end
  into v_actor_role
  from public.profiles as profile
  where profile.id = current_user_id;

  perform public.log_activity_event(
    'support.message_sent',
    v_actor_role,
    'support_ticket',
    p_ticket_id,
    null,
    v_ticket.related_job_id,
    jsonb_build_object(
      'visibility', 'user',
      'content_length', char_length(v_message)
    )
  );

  return v_message_id;
end;
$$;

revoke all on function public.add_support_ticket_message(bigint, text)
  from public, anon;

grant execute on function public.add_support_ticket_message(bigint, text)
  to authenticated;

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
      'project_invitation',
      'job_completed',
      'support_ticket_created',
      'support_reply'
    )
  );

create or replace function public.notify_user_on_admin_support_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket public.admin_support_tickets%rowtype;
begin
  if new.visibility is distinct from 'user' then
    return new;
  end if;

  select *
  into v_ticket
  from public.admin_support_tickets as ticket
  where ticket.id = new.ticket_id;

  if not found then
    return new;
  end if;

  if v_ticket.user_id = new.sender_id then
    return new;
  end if;

  begin
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
      read_at,
      metadata
    )
    values (
      v_ticket.user_id,
      'support_reply',
      'Destek talebine yanıt',
      format('Destek talebinize yanıt geldi: %s', v_ticket.subject),
      format('/support/%s', v_ticket.id),
      v_ticket.related_job_id,
      new.sender_id,
      null,
      null,
      null,
      null,
      jsonb_build_object(
        'ticket_id', v_ticket.id,
        'message_id', new.id
      )
    );
  exception
    when others then
      raise warning 'support reply notification failed: %', sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notify_user_on_admin_support_reply()
  from public, anon, authenticated;

drop trigger if exists admin_support_ticket_messages_notify_user
  on public.admin_support_ticket_messages;

create trigger admin_support_ticket_messages_notify_user
  after insert on public.admin_support_ticket_messages
  for each row
  execute procedure public.notify_user_on_admin_support_reply();
