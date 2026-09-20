-- JASA AJA completion patch
-- Apply this after schema.sql and final-hardening.sql.
alter table public.orders
  add column if not exists customer_service_fee numeric not null default 0 check(customer_service_fee>=0),
  add column if not exists platform_commission numeric not null default 0 check(platform_commission>=0),
  add column if not exists customer_total numeric not null default 0 check(customer_total>=0);

insert into public.app_settings(key,value)
values('platform',jsonb_build_object('name','JASA AJA','commission_percent',8,'customer_service_fee_percent',8,'payment_methods',jsonb_build_array('qris','cash')))
on conflict(key) do update set value=public.app_settings.value || excluded.value,updated_at=now();

create or replace function private.prepare_order_pricing()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare cp numeric:=8; sf numeric:=8;
begin
 select coalesce((value->>'commission_percent')::numeric,8),coalesce((value->>'customer_service_fee_percent')::numeric,8) into cp,sf from public.app_settings where key='platform';
 if new.status='working' and new.final_price is not null then
   new.platform_commission:=round(new.final_price*cp/100,2);
   new.customer_service_fee:=round(new.final_price*sf/100,2);
   new.customer_total:=new.final_price+new.customer_service_fee;
 end if;
 return new;
end $$;
revoke all on function private.prepare_order_pricing() from public,anon,authenticated;
drop trigger if exists prepare_order_pricing on public.orders;
create trigger prepare_order_pricing before insert or update on public.orders for each row execute function private.prepare_order_pricing();

create or replace function private.ensure_mitra_profile()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.role='mitra' then insert into public.partner_profiles(id) values(new.id) on conflict(id) do nothing; end if;
 return new;
end $$;
revoke all on function private.ensure_mitra_profile() from public,anon,authenticated;
drop trigger if exists ensure_mitra_profile on public.profiles;
create trigger ensure_mitra_profile after insert on public.profiles for each row execute function private.ensure_mitra_profile();

create or replace function private.apply_payment_to_wallet()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare pid uuid; net numeric;
begin
 if new.status='paid' and old.status is distinct from 'paid' then
   select partner_id,greatest(coalesce(final_price,0)-coalesce(platform_commission,0),0) into pid,net from public.orders where id=new.order_id;
   if pid is not null then
     insert into public.mitra_wallets(mitra_id,balance,total_earned) values(pid,net,net)
     on conflict(mitra_id) do update set balance=public.mitra_wallets.balance+excluded.balance,total_earned=public.mitra_wallets.total_earned+excluded.total_earned,updated_at=now();
   end if;
 end if;
 return new;
end $$;
revoke all on function private.apply_payment_to_wallet() from public,anon,authenticated;

drop policy if exists payments_customer_insert on public.payments;
create policy payments_customer_insert on public.payments for insert to authenticated with check(exists(select 1 from public.orders o where o.id=payments.order_id and o.customer_id=(select auth.uid()) and o.status='completed' and payments.amount=o.customer_total));