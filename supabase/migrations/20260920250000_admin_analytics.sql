-- Admin analytics snapshot RPC.
-- Does not change tables, RLS, activity log, or existing RPCs.

create or replace function public.admin_get_analytics()
returns jsonb
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

  return jsonb_build_object(
    'users', (
      select jsonb_build_object(
        'total', coalesce(count(*), 0),
        'active_customer', coalesce(
          count(*) filter (where profile.customer_enabled = true),
          0
        ),
        'active_provider', coalesce(
          count(*) filter (where profile.provider_enabled = true),
          0
        )
      )
      from public.profiles as profile
    ),
    'jobs', (
      select jsonb_build_object(
        'total', coalesce(count(*), 0),
        'open', coalesce(
          count(*) filter (where job.status = 'open'),
          0
        ),
        'in_progress', coalesce(
          count(*) filter (where job.status = 'in_progress'),
          0
        ),
        'completed', coalesce(
          count(*) filter (where job.status = 'completed'),
          0
        ),
        'cancelled', coalesce(
          count(*) filter (where job.status = 'cancelled'),
          0
        ),
        'last_7_days', coalesce(
          count(*) filter (
            where job.created_at >= now() - interval '7 days'
          ),
          0
        )
      )
      from public.jobs as job
    ),
    'offers', (
      select jsonb_build_object(
        'total', coalesce(count(*), 0),
        'accepted', coalesce(
          count(*) filter (where offer.status = 'accepted'),
          0
        ),
        'pending', coalesce(
          count(*) filter (where offer.status = 'pending'),
          0
        ),
        'last_7_days', coalesce(
          count(*) filter (
            where offer.created_at >= now() - interval '7 days'
          ),
          0
        )
      )
      from public.offers as offer
    ),
    'support', (
      select jsonb_build_object(
        'total', coalesce(count(*), 0),
        'open', coalesce(
          count(*) filter (
            where ticket.status in ('open', 'in_progress')
          ),
          0
        ),
        'resolved_or_closed', coalesce(
          count(*) filter (
            where ticket.status in ('resolved', 'closed')
          ),
          0
        ),
        'last_7_days', coalesce(
          count(*) filter (
            where ticket.created_at >= now() - interval '7 days'
          ),
          0
        )
      )
      from public.admin_support_tickets as ticket
    )
  );
end;
$$;

revoke all on function public.admin_get_analytics()
  from public, anon;

grant execute on function public.admin_get_analytics()
  to authenticated;
