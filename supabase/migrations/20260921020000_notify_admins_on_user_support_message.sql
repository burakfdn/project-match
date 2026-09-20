-- Notify admins when the ticket owner posts a user-visible support message.
-- Does not change add_support_ticket_message, admin RPCs, or analytics.

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
      select
        profile.id,
        'support_reply',
        'Destek talebine yeni mesaj',
        format('Bir destek talebine yeni mesaj geldi: %s', v_ticket.subject),
        format('/admin/support/%s', v_ticket.id),
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
      from public.profiles as profile
      where profile.is_admin = true
        and profile.id is distinct from new.sender_id;
    exception
      when others then
        raise warning 'admin support reply notification failed: %', sqlerrm;
    end;

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
