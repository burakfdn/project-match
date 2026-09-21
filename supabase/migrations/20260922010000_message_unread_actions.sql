-- Unread message count for navbar + per-conversation mark unread.
-- Reuses conversation_reads. Does not alter messages, send_message,
-- get_or_create_conversation, can_access_conversation, or RLS policies.

create or replace function public.get_my_unread_message_count()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  unread_total integer;
begin
  if current_user_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  select coalesce(count(*)::integer, 0)
  into unread_total
  from public.messages as unread_message
  inner join public.conversations as conversation
    on conversation.id = unread_message.conversation_id
  left join public.conversation_reads as conversation_read
    on conversation_read.conversation_id = conversation.id
    and conversation_read.user_id = current_user_id
  where public.can_access_conversation(conversation.id)
    and unread_message.sender_id <> current_user_id
    and (
      conversation_read.last_read_message_id is null
      or unread_message.id > conversation_read.last_read_message_id
    );

  return unread_total;
end;
$$;

revoke all on function public.get_my_unread_message_count()
  from public, anon;

grant execute on function public.get_my_unread_message_count()
  to authenticated;

create or replace function public.mark_conversation_unread(
  p_conversation_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  latest_incoming_id bigint;
  previous_message_id bigint;
begin
  if current_user_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  if coalesce(
    public.can_access_conversation(p_conversation_id),
    false
  ) is not true then
    raise exception 'Bu konuşmaya erişim yetkiniz yok.';
  end if;

  select max(message.id)
  into latest_incoming_id
  from public.messages as message
  where message.conversation_id = p_conversation_id
    and message.sender_id <> current_user_id;

  if latest_incoming_id is null then
    return;
  end if;

  select max(message.id)
  into previous_message_id
  from public.messages as message
  where message.conversation_id = p_conversation_id
    and message.id < latest_incoming_id;

  insert into public.conversation_reads (
    conversation_id,
    user_id,
    last_read_message_id,
    updated_at
  )
  values (
    p_conversation_id,
    current_user_id,
    previous_message_id,
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_message_id = excluded.last_read_message_id,
    updated_at = now();
end;
$$;

revoke all on function public.mark_conversation_unread(bigint)
  from public, anon;

grant execute on function public.mark_conversation_unread(bigint)
  to authenticated;
