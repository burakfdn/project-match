-- Active UI mode for normal users. Does not change role, is_admin,
-- RLS policies, or existing admin authorization RPCs.

alter table public.profiles
  add column if not exists active_mode text;

update public.profiles
set active_mode = case
  when provider_enabled = true and coalesce(customer_enabled, false) = false
    then 'provider'
  when customer_enabled = true and coalesce(provider_enabled, false) = false
    then 'customer'
  when role = 'provider' then 'provider'
  when role = 'customer' then 'customer'
  when provider_enabled = true then 'provider'
  else 'customer'
end
where active_mode is null;

alter table public.profiles
  drop constraint if exists profiles_active_mode_check;

alter table public.profiles
  add constraint profiles_active_mode_check
  check (active_mode in ('customer', 'provider'));

alter table public.profiles
  alter column active_mode set default 'customer';

alter table public.profiles
  alter column active_mode set not null;

create or replace function public.set_my_active_mode(p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_mode is null or p_mode not in ('customer', 'provider') then
    raise exception 'Geçersiz mod.';
  end if;

  update public.profiles
  set
    active_mode = p_mode,
    customer_enabled = case
      when p_mode = 'customer' then true
      else customer_enabled
    end,
    provider_enabled = case
      when p_mode = 'provider' then true
      else provider_enabled
    end
  where id = current_user_id;

  if not found then
    raise exception 'Profil bulunamadı.';
  end if;
end;
$$;

revoke all on function public.set_my_active_mode(text)
  from public, anon;

grant execute on function public.set_my_active_mode(text)
  to authenticated;
