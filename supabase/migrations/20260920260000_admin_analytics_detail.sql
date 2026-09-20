-- Admin analytics overview + category/service/time performance.
-- Does not change tables, RLS, activity log, or admin_get_analytics().

create or replace function public.admin_get_analytics_overview()
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
        'active', coalesce(
          count(*) filter (
            where profile.customer_enabled = true
              or profile.provider_enabled = true
          ),
          0
        ),
        'customer_only', coalesce(
          count(*) filter (
            where profile.customer_enabled = true
              and profile.provider_enabled = false
          ),
          0
        ),
        'provider_only', coalesce(
          count(*) filter (
            where profile.customer_enabled = false
              and profile.provider_enabled = true
          ),
          0
        ),
        'both_roles', coalesce(
          count(*) filter (
            where profile.customer_enabled = true
              and profile.provider_enabled = true
          ),
          0
        ),
        'admin', coalesce(
          count(*) filter (where profile.is_admin = true),
          0
        ),
        'new_today', coalesce(
          count(*) filter (where profile.created_at >= current_date),
          0
        ),
        'new_7_days', coalesce(
          count(*) filter (
            where profile.created_at >= now() - interval '7 days'
          ),
          0
        ),
        'new_30_days', coalesce(
          count(*) filter (
            where profile.created_at >= now() - interval '30 days'
          ),
          0
        )
      )
      from public.profiles as profile
    )
  );
end;
$$;

revoke all on function public.admin_get_analytics_overview()
  from public, anon;

grant execute on function public.admin_get_analytics_overview()
  to authenticated;

create or replace function public.admin_get_analytics_performance()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_first_week date;
  v_current_week date;
  v_first_month date;
  v_current_month date;
  v_first_year date;
  v_last_year date;
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

  v_current_week := date_trunc('week', current_date)::date;
  v_first_week := v_current_week - 77;
  v_current_month := date_trunc('month', current_date)::date;
  v_first_month := (v_current_month - interval '11 months')::date;

  select
    date_trunc(
      'year',
      least(
        coalesce((select min(job.created_at) from public.jobs as job), now()),
        coalesce((select min(offer.created_at) from public.offers as offer), now())
      )
    )::date,
    date_trunc(
      'year',
      greatest(
        coalesce((select max(job.created_at) from public.jobs as job), now()),
        coalesce((select max(offer.created_at) from public.offers as offer), now()),
        now()
      )
    )::date
  into v_first_year, v_last_year;

  return jsonb_build_object(
    'categories', coalesce(
      (
        select jsonb_agg(
          row_to_json(category_row)::jsonb
          order by category_row.job_count desc, category_row.category_name asc
        )
        from (
          select
            category.id as category_id,
            coalesce(nullif(btrim(category.name), ''), '') as category_name,
            coalesce(count(distinct job.id), 0) as job_count,
            coalesce(count(offer.id), 0) as offer_count,
            coalesce(
              count(offer.id) filter (where offer.status = 'accepted'),
              0
            ) as accepted_count,
            coalesce(
              count(offer.id) filter (where offer.status = 'rejected'),
              0
            ) as rejected_count,
            coalesce(
              count(offer.id) filter (where offer.status = 'pending'),
              0
            ) as pending_count,
            case
              when count(offer.id) = 0 then 0
              else round(
                (
                  count(offer.id) filter (where offer.status = 'accepted')::numeric
                  / count(offer.id)::numeric
                ) * 100,
                2
              )
            end as acceptance_rate
          from public.categories as category
          left join public.services as service
            on service.category_id = category.id
          left join public.jobs as job
            on job.service_id = service.id
          left join public.offers as offer
            on offer.job_id = job.id
          group by category.id, category.name
          order by
            count(distinct job.id) desc,
            category.name asc
        ) as category_row
      ),
      '[]'::jsonb
    ),
    'services', coalesce(
      (
        select jsonb_agg(
          row_to_json(service_row)::jsonb
          order by service_row.job_count desc, service_row.service_name asc
        )
        from (
          select
            service.id as service_id,
            coalesce(nullif(btrim(service.name), ''), '') as service_name,
            service.category_id as category_id,
            coalesce(nullif(btrim(category.name), ''), '') as category_name,
            coalesce(count(distinct job.id), 0) as job_count,
            coalesce(count(offer.id), 0) as offer_count,
            coalesce(
              count(offer.id) filter (where offer.status = 'accepted'),
              0
            ) as accepted_count,
            coalesce(
              count(offer.id) filter (where offer.status = 'rejected'),
              0
            ) as rejected_count,
            coalesce(
              count(offer.id) filter (where offer.status = 'pending'),
              0
            ) as pending_count,
            case
              when count(offer.id) = 0 then 0
              else round(
                (
                  count(offer.id) filter (where offer.status = 'accepted')::numeric
                  / count(offer.id)::numeric
                ) * 100,
                2
              )
            end as acceptance_rate
          from public.services as service
          left join public.categories as category
            on category.id = service.category_id
          left join public.jobs as job
            on job.service_id = service.id
          left join public.offers as offer
            on offer.job_id = job.id
          group by
            service.id,
            service.name,
            service.category_id,
            category.name
          order by
            count(distinct job.id) desc,
            service.name asc
        ) as service_row
      ),
      '[]'::jsonb
    ),
    'daily', coalesce(
      (
        select jsonb_agg(
          row_to_json(daily_row)::jsonb
          order by daily_row.period
        )
        from (
          select
            to_char(day_series.day_date, 'YYYY-MM-DD') as period,
            coalesce(job_stats.job_count, 0) as job_count,
            coalesce(offer_stats.offer_count, 0) as offer_count,
            coalesce(offer_stats.accepted_count, 0) as accepted_count,
            coalesce(offer_stats.rejected_count, 0) as rejected_count
          from generate_series(
            current_date - 29,
            current_date,
            interval '1 day'
          ) as day_series(day_date)
          left join (
            select
              job.created_at::date as day_date,
              count(*) as job_count
            from public.jobs as job
            where job.created_at >= current_date - 29
            group by job.created_at::date
          ) as job_stats
            on job_stats.day_date = day_series.day_date::date
          left join (
            select
              offer.created_at::date as day_date,
              count(*) as offer_count,
              count(*) filter (where offer.status = 'accepted') as accepted_count,
              count(*) filter (where offer.status = 'rejected') as rejected_count
            from public.offers as offer
            where offer.created_at >= current_date - 29
            group by offer.created_at::date
          ) as offer_stats
            on offer_stats.day_date = day_series.day_date::date
          order by day_series.day_date
        ) as daily_row
      ),
      '[]'::jsonb
    ),
    'weekly', coalesce(
      (
        select jsonb_agg(
          row_to_json(weekly_row)::jsonb
          order by weekly_row.period
        )
        from (
          select
            to_char(week_series.week_start, 'YYYY-MM-DD') as period,
            coalesce(job_stats.job_count, 0) as job_count,
            coalesce(offer_stats.offer_count, 0) as offer_count,
            coalesce(offer_stats.accepted_count, 0) as accepted_count,
            coalesce(offer_stats.rejected_count, 0) as rejected_count
          from generate_series(
            v_first_week,
            v_current_week,
            interval '7 days'
          ) as week_series(week_start)
          left join (
            select
              date_trunc('week', job.created_at)::date as week_start,
              count(*) as job_count
            from public.jobs as job
            where job.created_at >= v_first_week
            group by date_trunc('week', job.created_at)::date
          ) as job_stats
            on job_stats.week_start = week_series.week_start::date
          left join (
            select
              date_trunc('week', offer.created_at)::date as week_start,
              count(*) as offer_count,
              count(*) filter (where offer.status = 'accepted') as accepted_count,
              count(*) filter (where offer.status = 'rejected') as rejected_count
            from public.offers as offer
            where offer.created_at >= v_first_week
            group by date_trunc('week', offer.created_at)::date
          ) as offer_stats
            on offer_stats.week_start = week_series.week_start::date
          order by week_series.week_start
        ) as weekly_row
      ),
      '[]'::jsonb
    ),
    'monthly', coalesce(
      (
        select jsonb_agg(
          row_to_json(monthly_row)::jsonb
          order by monthly_row.period
        )
        from (
          select
            to_char(month_series.month_start, 'YYYY-MM') as period,
            coalesce(job_stats.job_count, 0) as job_count,
            coalesce(offer_stats.offer_count, 0) as offer_count,
            coalesce(offer_stats.accepted_count, 0) as accepted_count,
            coalesce(offer_stats.rejected_count, 0) as rejected_count
          from generate_series(
            v_first_month,
            v_current_month,
            interval '1 month'
          ) as month_series(month_start)
          left join (
            select
              date_trunc('month', job.created_at)::date as month_start,
              count(*) as job_count
            from public.jobs as job
            where job.created_at >= v_first_month
            group by date_trunc('month', job.created_at)::date
          ) as job_stats
            on job_stats.month_start = month_series.month_start::date
          left join (
            select
              date_trunc('month', offer.created_at)::date as month_start,
              count(*) as offer_count,
              count(*) filter (where offer.status = 'accepted') as accepted_count,
              count(*) filter (where offer.status = 'rejected') as rejected_count
            from public.offers as offer
            where offer.created_at >= v_first_month
            group by date_trunc('month', offer.created_at)::date
          ) as offer_stats
            on offer_stats.month_start = month_series.month_start::date
          order by month_series.month_start
        ) as monthly_row
      ),
      '[]'::jsonb
    ),
    'yearly', coalesce(
      (
        select jsonb_agg(
          row_to_json(yearly_row)::jsonb
          order by yearly_row.period
        )
        from (
          select
            to_char(year_series.year_start, 'YYYY') as period,
            coalesce(job_stats.job_count, 0) as job_count,
            coalesce(offer_stats.offer_count, 0) as offer_count,
            coalesce(offer_stats.accepted_count, 0) as accepted_count,
            coalesce(offer_stats.rejected_count, 0) as rejected_count
          from generate_series(
            v_first_year,
            v_last_year,
            interval '1 year'
          ) as year_series(year_start)
          left join (
            select
              date_trunc('year', job.created_at)::date as year_start,
              count(*) as job_count
            from public.jobs as job
            group by date_trunc('year', job.created_at)::date
          ) as job_stats
            on job_stats.year_start = year_series.year_start::date
          left join (
            select
              date_trunc('year', offer.created_at)::date as year_start,
              count(*) as offer_count,
              count(*) filter (where offer.status = 'accepted') as accepted_count,
              count(*) filter (where offer.status = 'rejected') as rejected_count
            from public.offers as offer
            group by date_trunc('year', offer.created_at)::date
          ) as offer_stats
            on offer_stats.year_start = year_series.year_start::date
          order by year_series.year_start
        ) as yearly_row
      ),
      '[]'::jsonb
    )
  );
end;
$$;

revoke all on function public.admin_get_analytics_performance()
  from public, anon;

grant execute on function public.admin_get_analytics_performance()
  to authenticated;
