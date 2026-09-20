-- JASA AJA final hardening / incremental SQL
-- The base schema is already present in the connected Supabase project.
create schema if not exists private;

create index if not exists idx_orders_customer on public.orders(customer_id);
create index if not exists idx_orders_partner on public.orders(partner_id);
create index if not exists idx_orders_service on public.orders(service_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_history_order on public.order_status_history(order_id);
create index if not exists idx_history_actor on public.order_status_history(actor_id);
create index if not exists idx_notifications_user on public.notifications(user_id);
create index if not exists idx_notifications_order on public.notifications(order_id);
create index if not exists idx_partner_services_service on public.partner_services(service_id);
create index if not exists idx_reviews_customer on public.reviews(customer_id);
create index if not exists idx_reviews_partner on public.reviews(partner_id);

create table if not exists public.notifications(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null, body text not null, type text not null default 'general',
 order_id uuid references public.orders(id) on delete cascade,
 read_at timestamptz, created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists notifications_own_select on public.notifications;
create policy notifications_own_select on public.notifications for select to authenticated using((select auth.uid())=user_id);
drop policy if exists notifications_own_update on public.notifications;
create policy notifications_own_update on public.notifications for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql set search_path=pg_catalog as $$ begin new.updated_at=now(); return new; end $$;

create or replace function private.enforce_profile_update() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if auth.uid() is null then raise exception 'Authentication required'; end if; if (select role from public.profiles where id=auth.uid())<>'admin' and new.role is distinct from old.role then raise exception 'Role changes are admin-only'; end if; return new; end $$;
revoke all on function private.enforce_profile_update() from public,anon,authenticated;
drop trigger if exists enforce_profile_update on public.profiles;
create trigger enforce_profile_update before update on public.profiles for each row execute function private.enforce_profile_update();

create or replace function private.enforce_order_update() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare r text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select role into r from public.profiles where id=auth.uid();
 if r='customer' then
   if new.customer_id<>old.customer_id or new.service_id<>old.service_id or new.address<>old.address or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude or new.problem_description is distinct from old.problem_description or new.partner_id is distinct from old.partner_id or new.offered_price is distinct from old.offered_price then raise exception 'Customer cannot modify protected order fields'; end if;
   if old.status='awaiting_approval' and new.status='working' and new.final_price=old.offered_price then return new; end if;
   if new.status='cancelled' and old.status in('searching','accepted','on_the_way','arrived','quoting','awaiting_approval') then return new; end if;
   if new.status<>old.status then raise exception 'Invalid customer status transition'; end if;
 elsif r='mitra' then
   if new.customer_id<>old.customer_id or new.service_id<>old.service_id or new.address<>old.address or new.latitude is distinct from old.latitude or new.longitude is distinct from old.longitude or new.problem_description is distinct from old.problem_description then raise exception 'Mitra cannot modify protected order fields'; end if;
   if old.partner_id is null then
     if new.partner_id<>auth.uid() or old.status<>'searching' or new.status<>'accepted' then raise exception 'Invalid order acceptance'; end if;
   else
     if new.partner_id<>old.partner_id then raise exception 'Invalid partner assignment'; end if;
     if old.status='accepted' and new.status='on_the_way' then return new; end if;
     if old.status='on_the_way' and new.status='arrived' then return new; end if;
     if old.status in('arrived','quoting') and new.status='awaiting_approval' and new.offered_price is not null and new.offered_price>0 then return new; end if;
     if old.status='working' and new.status='completed' then return new; end if;
     if new.status=old.status and new.offered_price is not distinct from old.offered_price then return new; end if;
     raise exception 'Invalid mitra status transition';
   end if;
 elsif r='admin' then return new;
 else raise exception 'Invalid role'; end if;
 return new;
end $$;
revoke all on function private.enforce_order_update() from public,anon,authenticated;
drop trigger if exists enforce_order_update on public.orders;
create trigger enforce_order_update before update on public.orders for each row execute function private.enforce_order_update();

create or replace function private.record_order_status() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if new.status is distinct from old.status then insert into public.order_status_history(order_id,status,actor_id) values(new.id,new.status,auth.uid()); end if; return new; end $$;
revoke all on function private.record_order_status() from public,anon,authenticated;
drop trigger if exists record_order_status on public.orders;
create trigger record_order_status after update on public.orders for each row execute function private.record_order_status();

create or replace function private.notify_order_change() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$ begin if new.status is distinct from old.status then insert into public.notifications(user_id,title,body,type,order_id) values(new.customer_id,'Status pesanan berubah','Pesanan Anda sekarang: '||replace(new.status,'_',' '),'order',new.id); if new.partner_id is not null then insert into public.notifications(user_id,title,body,type,order_id) values(new.partner_id,'Update order','Status pesanan: '||replace(new.status,'_',' '),'order',new.id); end if; end if; return new; end $$;
revoke all on function private.notify_order_change() from public,anon,authenticated;
drop trigger if exists notify_order_change on public.orders;
create trigger notify_order_change after update on public.orders for each row execute function private.notify_order_change();

do $$ begin
 begin alter publication supabase_realtime add table public.orders; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.partner_locations; exception when duplicate_object then null; end;
 begin alter publication supabase_realtime add table public.notifications; exception when duplicate_object then null; end;
end $$;


-- Wallet / payout / settings hardening
alter table public.mitra_wallets enable row level security;
alter table public.payouts enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists wallets_own_select on public.mitra_wallets;
create policy wallets_own_select on public.mitra_wallets for select to authenticated using((select auth.uid())=mitra_id);
drop policy if exists wallets_admin_all on public.mitra_wallets;
create policy wallets_admin_all on public.mitra_wallets for all to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists payouts_own_select on public.payouts;
create policy payouts_own_select on public.payouts for select to authenticated using((select auth.uid())=mitra_id);
drop policy if exists payouts_own_insert on public.payouts;
create policy payouts_own_insert on public.payouts for insert to authenticated with check((select auth.uid())=mitra_id and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='mitra'));
drop policy if exists payouts_admin_all on public.payouts;
create policy payouts_admin_all on public.payouts for all to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists settings_admin_all on public.app_settings;
create policy settings_admin_all on public.app_settings for all to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists payments_participant_insert on public.payments;
create policy payments_customer_insert on public.payments for insert to authenticated with check(exists(select 1 from public.orders o where o.id=payments.order_id and o.customer_id=(select auth.uid()) and o.status='completed' and payments.amount=o.final_price));
drop policy if exists payments_participant_update on public.payments;
create policy payments_admin_update on public.payments for update to authenticated using(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin')) with check(exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

create or replace function private.enforce_payment_update() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare r text;
begin
 select role into r from public.profiles where id=auth.uid();
 if r='admin' then return new; end if;
 if auth.uid() is null or auth.uid()<>(select customer_id from public.orders where id=new.order_id) then raise exception 'Payment modification denied'; end if;
 if new.order_id<>old.order_id or new.amount<>old.amount or new.method<>old.method or new.status<>old.status then raise exception 'Payment fields are immutable'; end if;
 return new;
end $$;
revoke all on function private.enforce_payment_update() from public,anon,authenticated;
drop trigger if exists enforce_payment_update on public.payments;
create trigger enforce_payment_update before update on public.payments for each row execute function private.enforce_payment_update();

create or replace function private.ensure_wallet_for_mitra() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
begin
 if new.role='mitra' then insert into public.mitra_wallets(mitra_id) values(new.id) on conflict do nothing; end if;
 return new;
end $$;
revoke all on function private.ensure_wallet_for_mitra() from public,anon,authenticated;
drop trigger if exists ensure_wallet_for_mitra on public.profiles;
create trigger ensure_wallet_for_mitra after insert on public.profiles for each row execute function private.ensure_wallet_for_mitra();
