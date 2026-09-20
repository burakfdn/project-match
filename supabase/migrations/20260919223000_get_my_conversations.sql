-- List conversations for the signed-in user.
-- conversations has no customer/provider columns; membership is
-- job.customer_id or the accepted offer's provider_id.
-- Does not change send_message, can_access_conversation,
-- get_or_create_conversation, or existing RLS policies.
-- unread_count is 0: messages has no read_at/is_read.

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
    0::integer
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
