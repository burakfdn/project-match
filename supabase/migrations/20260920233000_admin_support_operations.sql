-- Admin support write RPCs (reply, internal note, status, priority, assign).
-- Does not change user Support RLS, create_support_ticket, or existing
-- list/messages read RPC signatures.

drop function if exists public.admin_get_support_ticket(bigint);

create function public.admin_get_support_ticket(
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
  assigned_admin_id uuid,
  assigned_admin_name text,
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
    ticket.assigned_admin_id,
    nullif(btrim(assigned_admin.full_name), ''),
    ticket.user_id,
    nullif(btrim(profile.full_name), ''),
    nullif(btrim(auth_user.email), ''),
    job.title,
    job.public_id
  from public.admin_support_tickets as ticket
  left join public.profiles as profile
    on profile.id = ticket.user_id
  left join public.profiles as assigned_admin
    on assigned_admin.id = ticket.assigned_admin_id
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

create or replace function public.admin_list_support_admins()
returns table (
  id uuid,
  full_name text
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

  return query
  select
    profile.id,
    nullif(btrim(profile.full_name), '')
  from public.profiles as profile
  where profile.is_admin = true
  order by
    nullif(btrim(profile.full_name), '') asc nulls last,
    profile.id asc;
end;
$$;

revoke all on function public.admin_list_support_admins()
  from public, anon;

grant execute on function public.admin_list_support_admins()
  to authenticated;

create or replace function public.admin_add_support_ticket_message(
  p_ticket_id bigint,
  p_message text,
  p_visibility text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_message text;
  v_visibility text;
  v_ticket public.admin_support_tickets%rowtype;
  v_message_id bigint;
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
    raise exception 'Destek talebi bulunamadı.';
  end if;

  v_message := nullif(btrim(coalesce(p_message, '')), '');
  v_visibility := nullif(btrim(coalesce(p_visibility, '')), '');

  if v_message is null then
    raise exception 'Mesaj boş olamaz.';
  end if;

  if v_visibility not in ('user', 'internal') then
    raise exception 'Geçerli bir görünürlük seç.';
  end if;

  select *
  into v_ticket
  from public.admin_support_tickets as ticket
  where ticket.id = p_ticket_id;

  if not found then
    raise exception 'Destek talebi bulunamadı.';
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
    v_visibility
  )
  returning id into v_message_id;

  update public.admin_support_tickets as ticket
  set updated_at = now()
  where ticket.id = p_ticket_id;

  perform public.log_activity_event(
    'support.message_sent',
    'admin',
    'support_ticket',
    p_ticket_id,
    null,
    v_ticket.related_job_id,
    jsonb_build_object(
      'visibility', v_visibility,
      'content_length', char_length(v_message)
    )
  );

  return v_message_id;
end;
$$;

revoke all on function public.admin_add_support_ticket_message(
  bigint, text, text
) from public, anon;

grant execute on function public.admin_add_support_ticket_message(
  bigint, text, text
) to authenticated;

create or replace function public.admin_update_support_ticket_status(
  p_ticket_id bigint,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_status text;
  v_ticket public.admin_support_tickets%rowtype;
  v_resolved_at timestamptz;
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

  v_status := nullif(btrim(coalesce(p_status, '')), '');

  if v_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'Geçerli bir durum seç.';
  end if;

  select *
  into v_ticket
  from public.admin_support_tickets as ticket
  where ticket.id = p_ticket_id;

  if not found then
    raise exception 'Destek talebi bulunamadı.';
  end if;

  if v_ticket.status = v_status then
    return;
  end if;

  v_resolved_at := v_ticket.resolved_at;

  if v_status = 'resolved' then
    v_resolved_at := now();
  elsif v_status in ('open', 'in_progress') then
    v_resolved_at := null;
  elsif v_status = 'closed' and v_resolved_at is null then
    v_resolved_at := now();
  end if;

  update public.admin_support_tickets as ticket
  set
    status = v_status,
    resolved_at = v_resolved_at,
    updated_at = now()
  where ticket.id = p_ticket_id;

  perform public.log_activity_event(
    'support.status_changed',
    'admin',
    'support_ticket',
    p_ticket_id,
    null,
    v_ticket.related_job_id,
    jsonb_build_object(
      'from_status', v_ticket.status,
      'to_status', v_status
    )
  );
end;
$$;

revoke all on function public.admin_update_support_ticket_status(
  bigint, text
) from public, anon;

grant execute on function public.admin_update_support_ticket_status(
  bigint, text
) to authenticated;

create or replace function public.admin_update_support_ticket_priority(
  p_ticket_id bigint,
  p_priority text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_priority text;
  v_ticket public.admin_support_tickets%rowtype;
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

  v_priority := nullif(btrim(coalesce(p_priority, '')), '');

  if v_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Geçerli bir öncelik seç.';
  end if;

  select *
  into v_ticket
  from public.admin_support_tickets as ticket
  where ticket.id = p_ticket_id;

  if not found then
    raise exception 'Destek talebi bulunamadı.';
  end if;

  if v_ticket.priority = v_priority then
    return;
  end if;

  update public.admin_support_tickets as ticket
  set
    priority = v_priority,
    updated_at = now()
  where ticket.id = p_ticket_id;

  perform public.log_activity_event(
    'support.priority_changed',
    'admin',
    'support_ticket',
    p_ticket_id,
    null,
    v_ticket.related_job_id,
    jsonb_build_object(
      'from_priority', v_ticket.priority,
      'to_priority', v_priority
    )
  );
end;
$$;

revoke all on function public.admin_update_support_ticket_priority(
  bigint, text
) from public, anon;

grant execute on function public.admin_update_support_ticket_priority(
  bigint, text
) to authenticated;

create or replace function public.admin_assign_support_ticket(
  p_ticket_id bigint,
  p_admin_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_ticket public.admin_support_tickets%rowtype;
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

  select *
  into v_ticket
  from public.admin_support_tickets as ticket
  where ticket.id = p_ticket_id;

  if not found then
    raise exception 'Destek talebi bulunamadı.';
  end if;

  if p_admin_id is not null then
    if not exists (
      select 1
      from public.profiles as profile
      where profile.id = p_admin_id
        and profile.is_admin = true
    ) then
      raise exception 'Atanacak kullanıcı admin olmalı.';
    end if;
  end if;

  if v_ticket.assigned_admin_id is not distinct from p_admin_id then
    return;
  end if;

  update public.admin_support_tickets as ticket
  set
    assigned_admin_id = p_admin_id,
    updated_at = now()
  where ticket.id = p_ticket_id;

  perform public.log_activity_event(
    'support.assigned',
    'admin',
    'support_ticket',
    p_ticket_id,
    null,
    v_ticket.related_job_id,
    jsonb_build_object(
      'from_assigned_admin_id', v_ticket.assigned_admin_id,
      'assigned_admin_id', p_admin_id
    )
  );
end;
$$;

revoke all on function public.admin_assign_support_ticket(
  bigint, uuid
) from public, anon;

grant execute on function public.admin_assign_support_ticket(
  bigint, uuid
) to authenticated;
