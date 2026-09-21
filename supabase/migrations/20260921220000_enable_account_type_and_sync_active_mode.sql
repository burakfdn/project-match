-- Enable additional own account type without changing active_mode.
-- Normalize invalid active_mode when account-type flags change.
-- Does not alter RLS, set_my_active_mode switch rules, or onboarding.

create or replace function public.enable_my_account_type(p_mode text)
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
    raise exception 'Geçersiz hesap türü.';
  end if;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = current_user_id
  ) then
    raise exception 'Profil bulunamadı.';
  end if;

  if p_mode = 'customer' then
    update public.profiles
    set customer_enabled = true
    where id = current_user_id;
  else
    update public.profiles
    set provider_enabled = true
    where id = current_user_id;
  end if;
end;
$$;

revoke all on function public.enable_my_account_type(text)
  from public, anon;

grant execute on function public.enable_my_account_type(text)
  to authenticated;

create or replace function public.sync_profile_active_mode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.active_mode = 'provider'
    and coalesce(new.provider_enabled, false) = false then
    if coalesce(new.customer_enabled, false) then
      new.active_mode := 'customer';
    else
      new.active_mode := 'customer';
    end if;
  elsif new.active_mode = 'customer'
    and coalesce(new.customer_enabled, false) = false then
    if coalesce(new.provider_enabled, false) then
      new.active_mode := 'provider';
    else
      new.active_mode := 'customer';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_sync_active_mode on public.profiles;

create trigger profiles_sync_active_mode
  before insert or update of customer_enabled, provider_enabled, active_mode
  on public.profiles
  for each row
  execute procedure public.sync_profile_active_mode();

update public.profiles
set active_mode = case
  when coalesce(customer_enabled, false)
    and coalesce(provider_enabled, false) then
    case
      when active_mode = 'provider' then 'provider'
      else 'customer'
    end
  when coalesce(provider_enabled, false) then 'provider'
  else 'customer'
end
where
  (active_mode = 'provider' and coalesce(provider_enabled, false) = false)
  or (active_mode = 'customer' and coalesce(customer_enabled, false) = false);
