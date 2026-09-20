-- Admin read RPCs for support tickets.
-- Does not change support tables, user RLS, create_support_ticket,
-- or activity log.

create or replace function public.admin_list_support_tickets(
  p_limit integer default 50,
  p_offset integer default 0,
  p_status text default null,
  p_priority text default null,
  p_category text default null
)
returns table (
  id bigint,
  created_at timestamptz,
  subject text,
  category text,
  priority text,
  status text,
  related_job_id bigint,
  user_id uuid,
  user_name text,
  job_title text,
  job_public_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_limit integer;
  v_offset integer;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
      and profile.is_admin = true
  ) then
    raise exception 'Bu işlem için admin yetkisi gerekir.';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset := greatest(coalesce(p_offset, 0), 0);

  return query
  select
    ticket.id,
    ticket.created_at,
    ticket.subject,
    ticket.category,
    ticket.priority,
    ticket.status,
    ticket.related_job_id,
    ticket.user_id,
    nullif(btrim(profile.full_name), ''),
    job.title,
    job.public_id
  from public.admin_support_tickets as ticket
  left join public.profiles as profile
    on profile.id = ticket.user_id
  left join public.jobs as job
    on job.id = ticket.related_job_id
  where (
      p_status is null
      or btrim(p_status) = ''
      or ticket.status = btrim(p_status)
    )
    and (
      p_priority is null
      or btrim(p_priority) = ''
      or ticket.priority = btrim(p_priority)
    )
    and (
      p_category is null
      or btrim(p_category) = ''
      or ticket.category = btrim(p_category)
    )
  order by ticket.created_at desc, ticket.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.admin_list_support_tickets(
  integer, integer, text, text, text
) from public, anon;

grant execute on function public.admin_list_support_tickets(
  integer, integer, text, text, text
) to authenticated;

create or replace function public.admin_get_support_ticket(
  p_ticket_id bigint
)
returns table (
  id bigint,
  created_at timestamptz,
  updated_at timestamptz,
  subject text,
  description text,
  category text,
  priority text,
  status text,
  related_job_id bigint,
  user_id uuid,
  user_name text,
  user_email text,
  job_title text,
  job_public_id uuid
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
    raise exception 'Giriş yapmalısın.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
      and profile.is_admin = true
  ) then
    raise exception 'Bu işlem için admin yetkisi gerekir.';
  end if;

  if p_ticket_id is null then
    return;
  end if;

  return query
  select
    ticket.id,
    ticket.created_at,
    ticket.updated_at,
    ticket.subject,
    ticket.description,
    ticket.category,
    ticket.priority,
    ticket.status,
    ticket.related_job_id,
    ticket.user_id,
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(auth_user.email), ''),
    job.title,
    job.public_id
  from public.admin_support_tickets as ticket
  left join public.profiles as profile
    on profile.id = ticket.user_id
  left join auth.users as auth_user
    on auth_user.id = ticket.user_id
  left join public.jobs as job
    on job.id = ticket.related_job_id
  where ticket.id = p_ticket_id;
end;
$$;

revoke all on function public.admin_get_support_ticket(bigint)
  from public, anon;

grant execute on function public.admin_get_support_ticket(bigint)
  to authenticated;

create or replace function public.admin_list_support_ticket_messages(
  p_ticket_id bigint
)
returns table (
  id bigint,
  created_at timestamptz,
  sender_id uuid,
  sender_name text,
  message text,
  visibility text
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
    raise exception 'Giriş yapmalısın.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
      and profile.is_admin = true
  ) then
    raise exception 'Bu işlem için admin yetkisi gerekir.';
  end if;

  if p_ticket_id is null then
    return;
  end if;

  if not exists (
    select 1
    from public.admin_support_tickets as ticket
    where ticket.id = p_ticket_id
  ) then
    return;
  end if;

  return query
  select
    ticket_message.id,
    ticket_message.created_at,
    ticket_message.sender_id,
    nullif(btrim(profile.full_name), ''),
    ticket_message.message,
    ticket_message.visibility
  from public.admin_support_ticket_messages as ticket_message
  left join public.profiles as profile
    on profile.id = ticket_message.sender_id
  where ticket_message.ticket_id = p_ticket_id
  order by ticket_message.created_at asc, ticket_message.id asc;
end;
$$;

revoke all on function public.admin_list_support_ticket_messages(bigint)
  from public, anon;

grant execute on function public.admin_list_support_ticket_messages(bigint)
  to authenticated;
