-- New join table: portfolio work samples <-> services.
-- Repo has no existing SQL/RLS dumps. Policies follow how the
-- app already uses provider_work_samples:
--   SELECT by authenticated users (public provider profile)
--   INSERT/DELETE only when provider_id = auth.uid()
-- No SECURITY DEFINER. Does not modify work_sample_categories.

create table public.work_sample_services (
  work_sample_id bigint not null
    references public.provider_work_samples (id)
    on delete cascade,
  service_id bigint not null
    references public.services (id)
    on delete cascade,
  created_at timestamptz not null default now(),
  primary key (work_sample_id, service_id)
);

create index work_sample_services_work_sample_id_idx
  on public.work_sample_services (work_sample_id);

create index work_sample_services_service_id_idx
  on public.work_sample_services (service_id);

alter table public.work_sample_services enable row level security;

grant select, insert, delete
  on public.work_sample_services
  to authenticated;

create policy work_sample_services_select
  on public.work_sample_services
  for select
  to authenticated
  using (true);

create policy work_sample_services_insert
  on public.work_sample_services
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.provider_work_samples as work_sample
      where work_sample.id = work_sample_id
        and work_sample.provider_id = auth.uid()
    )
  );

create policy work_sample_services_delete
  on public.work_sample_services
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.provider_work_samples as work_sample
      where work_sample.id = work_sample_id
        and work_sample.provider_id = auth.uid()
    )
  );
