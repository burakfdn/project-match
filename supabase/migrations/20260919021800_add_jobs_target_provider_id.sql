-- Adds optional target_provider_id to public.jobs.
-- Nullable. Does not alter other job columns, RLS, or RPCs.

alter table public.jobs
  add column target_provider_id uuid
    references public.profiles (id)
    on delete set null;

create index jobs_target_provider_id_idx
  on public.jobs (target_provider_id);
