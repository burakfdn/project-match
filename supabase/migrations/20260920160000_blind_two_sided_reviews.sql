-- Two-sided blind reviews on public.reviews.
-- Keeps existing columns and rows. Backfills legacy customer → provider
-- reviews as published. Replaces unique(job_id) with one action per
-- job per reviewer/role. Does not alter jobs, offers, accept_offer,
-- or complete_my_job.

alter table public.reviews
  add column if not exists reviewer_id uuid
    references public.profiles (id)
    on delete cascade;

alter table public.reviews
  add column if not exists reviewee_id uuid
    references public.profiles (id)
    on delete cascade;

alter table public.reviews
  add column if not exists reviewer_role text;

alter table public.reviews
  add column if not exists criteria jsonb;

alter table public.reviews
  add column if not exists skipped boolean not null default false;

alter table public.reviews
  add column if not exists published_at timestamptz;

update public.reviews
set
  reviewer_id = customer_id,
  reviewee_id = provider_id,
  reviewer_role = 'customer',
  skipped = false,
  published_at = coalesce(published_at, created_at)
where reviewer_id is null
   or reviewee_id is null
   or reviewer_role is null
   or (skipped = false and published_at is null and created_at is not null);

alter table public.reviews
  alter column reviewer_id set not null;

alter table public.reviews
  alter column reviewee_id set not null;

alter table public.reviews
  alter column reviewer_role set not null;

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select pg_constraint.conname
    from pg_constraint
    where pg_constraint.conrelid = 'public.reviews'::regclass
      and pg_constraint.contype = 'u'
      and cardinality(pg_constraint.conkey) = 1
      and exists (
        select 1
        from pg_attribute
        where pg_attribute.attrelid = pg_constraint.conrelid
          and pg_attribute.attnum = pg_constraint.conkey[1]
          and pg_attribute.attname = 'job_id'
      )
  loop
    execute format(
      'alter table public.reviews drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

create unique index if not exists reviews_job_id_reviewer_id_key
  on public.reviews (job_id, reviewer_id);

create unique index if not exists reviews_job_id_reviewer_role_key
  on public.reviews (job_id, reviewer_role);

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select pg_constraint.conname
    from pg_constraint
    where pg_constraint.conrelid = 'public.reviews'::regclass
      and pg_constraint.contype = 'c'
      and pg_get_constraintdef(pg_constraint.oid) ilike '%rating%'
  loop
    execute format(
      'alter table public.reviews drop constraint %I',
      constraint_row.conname
    );
  end loop;
end
$$;

alter table public.reviews
  alter column rating drop not null;

alter table public.reviews
  add constraint reviews_reviewer_role_check
    check (reviewer_role in ('customer', 'provider'));

alter table public.reviews
  add constraint reviews_reviewer_not_reviewee_check
    check (reviewer_id <> reviewee_id);

alter table public.reviews
  add constraint reviews_rating_range_check
    check (rating is null or (rating >= 1 and rating <= 5));

alter table public.reviews
  add constraint reviews_rating_required_unless_skipped_check
    check (skipped = true or rating is not null);

create index if not exists reviews_reviewer_id_idx
  on public.reviews (reviewer_id);

create index if not exists reviews_reviewee_id_idx
  on public.reviews (reviewee_id);

create index if not exists reviews_published_at_idx
  on public.reviews (published_at)
  where published_at is not null
    and skipped = false;

drop policy if exists reviews_select on public.reviews;

create policy reviews_select_own
  on public.reviews
  for select
  to authenticated
  using (reviewer_id = auth.uid());

create policy reviews_select_published
  on public.reviews
  for select
  to authenticated
  using (
    published_at is not null
    and skipped = false
    and (
      reviewer_role = 'customer'
      or reviewee_id = auth.uid()
    )
  );

drop policy if exists reviews_insert on public.reviews;

create policy reviews_insert
  on public.reviews
  for insert
  to authenticated
  with check (
    auth.uid() = customer_id
    and coalesce(skipped, false) = false
    and provider_id <> customer_id
    and (
      reviewer_id is null
      or reviewer_id = auth.uid()
    )
    and (
      reviewer_role is null
      or reviewer_role = 'customer'
    )
    and exists (
      select 1
      from public.jobs as job
      where job.id = reviews.job_id
        and job.customer_id = auth.uid()
        and job.status = 'completed'
    )
    and exists (
      select 1
      from public.offers as offer
      where offer.job_id = reviews.job_id
        and offer.status = 'accepted'
        and offer.provider_id = reviews.provider_id
    )
  );

revoke update, delete
  on public.reviews
  from authenticated, anon, public;

create or replace function public.publish_completed_review_actions(
  p_job_id bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  action_count integer;
begin
  select count(*)
  into action_count
  from public.reviews
  where job_id = p_job_id;

  if action_count < 2 then
    return;
  end if;

  update public.reviews
  set published_at = coalesce(published_at, now())
  where job_id = p_job_id
    and skipped = false
    and published_at is null;
end;
$$;

create or replace function public.reviews_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reviewer_id is null then
    new.reviewer_id := new.customer_id;
    new.reviewee_id := coalesce(new.reviewee_id, new.provider_id);
    new.reviewer_role := coalesce(new.reviewer_role, 'customer');
    new.skipped := coalesce(new.skipped, false);
  end if;

  if new.reviewee_id is null then
    if new.reviewer_role = 'provider' then
      new.reviewee_id := new.customer_id;
    else
      new.reviewee_id := new.provider_id;
    end if;
  end if;

  if new.reviewer_id = new.reviewee_id then
    raise exception 'Kendi kendini değerlendiremezsin.';
  end if;

  if new.skipped then
    new.rating := null;
    new.comment := null;
    new.criteria := null;
    new.published_at := null;
  end if;

  return new;
end;
$$;

create or replace function public.reviews_after_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.publish_completed_review_actions(new.job_id);
  return new;
end;
$$;

drop trigger if exists reviews_before_insert on public.reviews;
create trigger reviews_before_insert
  before insert on public.reviews
  for each row
  execute procedure public.reviews_before_insert();

drop trigger if exists reviews_after_insert on public.reviews;
create trigger reviews_after_insert
  after insert on public.reviews
  for each row
  execute procedure public.reviews_after_insert();

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
end;
$$;

revoke all on function public.publish_completed_review_actions(bigint)
  from public, anon, authenticated;

revoke all on function public.reviews_before_insert()
  from public, anon, authenticated;

revoke all on function public.reviews_after_insert()
  from public, anon, authenticated;

revoke all on function public.submit_review(bigint, integer, text, jsonb)
  from public, anon;

revoke all on function public.skip_review(bigint)
  from public, anon;

grant execute on function public.submit_review(bigint, integer, text, jsonb)
  to authenticated;

grant execute on function public.skip_review(bigint)
  to authenticated;
