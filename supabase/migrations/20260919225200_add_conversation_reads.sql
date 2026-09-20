-- Per-user conversation read cursor.
-- Does not alter messages, conversations, send_message,
-- get_or_create_conversation, or can_access_conversation.
-- Client has SELECT on own rows only; writes go through RPC.

create table public.conversation_reads (
  conversation_id bigint not null
    references public.conversations (id)
    on delete cascade,
  user_id uuid not null
    references public.profiles (id)
    on delete cascade,
  last_read_message_id bigint null
    references public.messages (id)
    on delete set null,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

alter table public.conversation_reads enable row level security;

revoke all on table public.conversation_reads from public;
revoke all on table public.conversation_reads from anon;
revoke all on table public.conversation_reads from authenticated;

grant select on table public.conversation_reads to authenticated;

create policy conversation_reads_select_own
  on public.conversation_reads
  for select
  to authenticated
  using (user_id = auth.uid());

create or replace function public.mark_conversation_read(
  p_conversation_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  latest_message_id bigint;
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
  into latest_message_id
  from public.messages as message
  where message.conversation_id = p_conversation_id;

  insert into public.conversation_reads (
    conversation_id,
    user_id,
    last_read_message_id,
    updated_at
  )
  values (
    p_conversation_id,
    current_user_id,
    latest_message_id,
    now()
  )
  on conflict (conversation_id, user_id)
  do update set
    last_read_message_id = excluded.last_read_message_id,
    updated_at = now();
end;
$$;

revoke all on function public.mark_conversation_read(bigint)
  from public;

revoke all on function public.mark_conversation_read(bigint)
  from anon;

grant execute on function public.mark_conversation_read(bigint)
  to authenticated;

create or replace function public.get_my_conversations()
returns table (
  conversation_id bigint,
  job_id bigint,
  job_title text,
  other_user_id uuid,
  other_user_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Oturum bulunamadı.';
  end if;

  return query
  select
    conversation.id,
    job.id,
    job.title,
    case
      when job.customer_id = current_user_id then accepted.provider_id
      else job.customer_id
    end,
    nullif(btrim(other_profile.full_name), ''),
    last_msg.message,
    coalesce(last_msg.created_at, conversation.created_at),
    (
      select count(*)::integer
      from public.messages as unread_message
      where unread_message.conversation_id = conversation.id
        and unread_message.sender_id <> current_user_id
        and (
          conversation_read.last_read_message_id is null
          or unread_message.id > conversation_read.last_read_message_id
        )
    )
  from public.conversations as conversation
  inner join public.jobs as job
    on job.id = conversation.job_id
  left join lateral (
    select offer.provider_id
    from public.offers as offer
    where offer.job_id = job.id
      and offer.status = 'accepted'
    order by offer.id
    limit 1
  ) as accepted on true
  left join lateral (
    select msg.message, msg.created_at
    from public.messages as msg
    where msg.conversation_id = conversation.id
    order by msg.created_at desc, msg.id desc
    limit 1
  ) as last_msg on true
  left join public.conversation_reads as conversation_read
    on conversation_read.conversation_id = conversation.id
    and conversation_read.user_id = current_user_id
  left join public.profiles as other_profile
    on other_profile.id = case
      when job.customer_id = current_user_id then accepted.provider_id
      else job.customer_id
    end
  where job.customer_id = current_user_id
     or accepted.provider_id = current_user_id
  order by coalesce(last_msg.created_at, conversation.created_at) desc;
end;
$$;

revoke all on function public.get_my_conversations()
  from public;

revoke all on function public.get_my_conversations()
  from anon;

grant execute on function public.get_my_conversations()
  to authenticated;
