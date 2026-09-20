-- Fix blind-review write path and publish-on-counterpart-action.
-- Drops client INSERT. Publishes both rows when the other party
-- already has an action. Broadens published SELECT.
-- Does not change unique indexes or CHECK constraints.
-- Does not alter jobs, offers, accept_offer, or complete_my_job.

drop policy if exists reviews_insert on public.reviews;

revoke insert
  on public.reviews
  from authenticated, anon, public;

drop policy if exists reviews_select_published on public.reviews;

create policy reviews_select_published
  on public.reviews
  for select
  to authenticated
  using (
    reviewer_id = auth.uid()
    or (
      published_at is not null
      and skipped = false
    )
  );

create or replace function public.publish_completed_review_actions(
  p_job_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.reviews as review
    where review.job_id = p_job_id
    group by review.job_id
    having count(*) >= 2
  ) then
    return;
  end if;

  update public.reviews
  set published_at = coalesce(published_at, now())
  where job_id = p_job_id
    and published_at is null;
end;
$$;

create or replace function public.submit_review(
  p_job_id bigint,
  p_rating integer,
  p_comment text default null,
  p_criteria jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  job_customer_id uuid;
  job_status text;
  accepted_provider_id uuid;
  reviewer_role text;
  reviewee_id uuid;
  counterpart_has_action boolean := false;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'Puan 1 ile 5 arasında olmalı.';
  end if;

  select job.customer_id, job.status
  into job_customer_id, job_status
  from public.jobs as job
  where job.id = p_job_id;

  if job_customer_id is null then
    raise exception 'İş bulunamadı.';
  end if;

  if job_status is distinct from 'completed' then
    raise exception 'Yalnızca tamamlanan işler değerlendirilebilir.';
  end if;

  select offer.provider_id
  into accepted_provider_id
  from public.offers as offer
  where offer.job_id = p_job_id
    and offer.status = 'accepted'
  limit 1;

  if accepted_provider_id is null then
    raise exception 'Bu işte kabul edilmiş uzman yok.';
  end if;

  if current_user_id = job_customer_id then
    reviewer_role := 'customer';
    reviewee_id := accepted_provider_id;
  elsif current_user_id = accepted_provider_id then
    reviewer_role := 'provider';
    reviewee_id := job_customer_id;
  else
    raise exception 'Bu işi değerlendirme yetkin yok.';
  end if;

  if current_user_id = reviewee_id then
    raise exception 'Kendi kendini değerlendiremezsin.';
  end if;

  if exists (
    select 1
    from public.reviews as review
    where review.job_id = p_job_id
      and review.reviewer_id = current_user_id
  ) then
    raise exception 'Bu iş için zaten değerlendirme yaptın.';
  end if;

  select exists (
    select 1
    from public.reviews as review
    where review.job_id = p_job_id
      and review.reviewer_id <> current_user_id
  )
  into counterpart_has_action;

  insert into public.reviews (
    job_id,
    provider_id,
    customer_id,
    reviewer_id,
    reviewee_id,
    reviewer_role,
    rating,
    comment,
    criteria,
    skipped,
    published_at
  )
  values (
    p_job_id,
    accepted_provider_id,
    job_customer_id,
    current_user_id,
    reviewee_id,
    reviewer_role,
    p_rating,
    nullif(btrim(coalesce(p_comment, '')), ''),
    p_criteria,
    false,
    null
  );

  if counterpart_has_action then
    update public.reviews
    set published_at = coalesce(published_at, now())
    where job_id = p_job_id
      and published_at is null;
  end if;
end;
$$;

create or replace function public.skip_review(
  p_job_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  job_customer_id uuid;
  job_status text;
  accepted_provider_id uuid;
  reviewer_role text;
  reviewee_id uuid;
  counterpart_has_action boolean := false;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  select job.customer_id, job.status
  into job_customer_id, job_status
  from public.jobs as job
  where job.id = p_job_id;

  if job_customer_id is null then
    raise exception 'İş bulunamadı.';
  end if;

  if job_status is distinct from 'completed' then
    raise exception 'Yalnızca tamamlanan işler değerlendirilebilir.';
  end if;

  select offer.provider_id
  into accepted_provider_id
  from public.offers as offer
  where offer.job_id = p_job_id
    and offer.status = 'accepted'
  limit 1;

  if accepted_provider_id is null then
    raise exception 'Bu işte kabul edilmiş uzman yok.';
  end if;

  if current_user_id = job_customer_id then
    reviewer_role := 'customer';
    reviewee_id := accepted_provider_id;
  elsif current_user_id = accepted_provider_id then
    reviewer_role := 'provider';
    reviewee_id := job_customer_id;
  else
    raise exception 'Bu işi değerlendirme yetkin yok.';
  end if;

  if current_user_id = reviewee_id then
    raise exception 'Kendi kendini değerlendiremezsin.';
  end if;

  if exists (
    select 1
    from public.reviews as review
    where review.job_id = p_job_id
      and review.reviewer_id = current_user_id
  ) then
    raise exception 'Bu iş için zaten değerlendirme yaptın.';
  end if;

  select exists (
    select 1
    from public.reviews as review
    where review.job_id = p_job_id
      and review.reviewer_id <> current_user_id
  )
  into counterpart_has_action;

  insert into public.reviews (
    job_id,
    provider_id,
    customer_id,
    reviewer_id,
    reviewee_id,
    reviewer_role,
    rating,
    comment,
    criteria,
    skipped,
    published_at
  )
  values (
    p_job_id,
    accepted_provider_id,
    job_customer_id,
    current_user_id,
    reviewee_id,
    reviewer_role,
    null,
    null,
    null,
    true,
    null
  );

  if counterpart_has_action then
    update public.reviews
    set published_at = coalesce(published_at, now())
    where job_id = p_job_id
      and published_at is null;
  end if;
end;
$$;

revoke all on function public.publish_completed_review_actions(bigint)
  from public, anon, authenticated;

revoke all on function public.submit_review(bigint, integer, text, jsonb)
  from public, anon;

revoke all on function public.skip_review(bigint)
  from public, anon;

grant execute on function public.submit_review(bigint, integer, text, jsonb)
  to authenticated;

grant execute on function public.skip_review(bigint)
  to authenticated;
