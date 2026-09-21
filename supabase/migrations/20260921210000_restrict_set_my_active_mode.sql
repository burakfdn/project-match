-- Restrict set_my_active_mode to switching existing account types only.
-- Does not change profiles columns, RLS, onboarding, or other RPCs.

create or replace function public.set_my_active_mode(p_mode text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  v_customer_enabled boolean;
  v_provider_enabled boolean;
begin
  if current_user_id is null then
    raise exception 'Giriş yapmalısın.';
  end if;

  if p_mode is null or p_mode not in ('customer', 'provider') then
    raise exception 'Geçersiz mod.';
  end if;

  select
    profile.customer_enabled,
    profile.provider_enabled
  into
    v_customer_enabled,
    v_provider_enabled
  from public.profiles as profile
  where profile.id = current_user_id;

  if not found then
    raise exception 'Profil bulunamadı.';
  end if;

  if p_mode = 'customer' and coalesce(v_customer_enabled, false) = false then
    raise exception 'Bu hesap türü aktif değil.';
  end if;

  if p_mode = 'provider' and coalesce(v_provider_enabled, false) = false then
    raise exception 'Bu hesap türü aktif değil.';
  end if;

  update public.profiles
  set active_mode = p_mode
  where id = current_user_id;
end;
$$;

revoke all on function public.set_my_active_mode(text)
  from public, anon;

grant execute on function public.set_my_active_mode(text)
  to authenticated;
