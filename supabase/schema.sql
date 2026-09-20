-- JASA AJA bootstrap schema
-- Apply this file to a fresh Supabase project, then apply final-hardening.sql.
create extension if not exists pgcrypto;

create table if not exists public.profiles(
 id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',
 phone text,
 role text not null default 'customer' check(role in('customer','mitra','admin')),
 avatar_url text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.services(
 id uuid primary key default gen_random_uuid(),
 name text not null unique,
 description text,
 icon text,
 active boolean not null default true,
 created_at timestamptz not null default now()
);
create table if not exists public.partner_profiles(
 id uuid primary key references public.profiles(id) on delete cascade,
 verified boolean not null default false,
 online boolean not null default false,
 latitude double precision,
 longitude double precision,
 address text,
 bio text,
 updated_at timestamptz not null default now()
);
create table if not exists public.partner_services(
 partner_id uuid not null references public.profiles(id) on delete cascade,
 service_id uuid not null references public.services(id) on delete cascade,
 primary key(partner_id,service_id)
);
create table if not exists public.orders(
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references public.profiles(id),
 partner_id uuid references public.profiles(id),
 service_id uuid not null references public.services(id),
 status text not null default 'searching' check(status in('searching','accepted','on_the_way','arrived','quoting','awaiting_approval','working','completed','cancelled')),
 address text not null,
 latitude double precision,
 longitude double precision,
 problem_description text,
 offered_price numeric,
 final_price numeric,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.order_status_history(
 id bigint generated always as identity primary key,
 order_id uuid not null references public.orders(id) on delete cascade,
 status text not null,
 actor_id uuid references public.profiles(id),
 created_at timestamptz not null default now()
);
create table if not exists public.partner_locations(
 partner_id uuid primary key references public.profiles(id) on delete cascade,
 latitude double precision not null,
 longitude double precision not null,
 updated_at timestamptz not null default now()
);
create table if not exists public.payments(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id) on delete cascade,
 method text not null check(method in('qris','cash')),
 amount numeric not null check(amount>=0),
 status text not null default 'pending' check(status in('pending','paid','failed')),
 reference text,
 paid_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.reviews(
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null unique references public.orders(id) on delete cascade,
 customer_id uuid not null references public.profiles(id),
 partner_id uuid not null references public.profiles(id),
 rating integer not null check(rating between 1 and 5),
 review text,
 created_at timestamptz not null default now()
);
create table if not exists public.notifications(
 id bigint generated always as identity primary key,
 user_id uuid not null references public.profiles(id) on delete cascade,
 title text not null,
 body text not null,
 type text not null default 'general',
 order_id uuid references public.orders(id) on delete cascade,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create table if not exists public.mitra_wallets(
 mitra_id uuid primary key references public.profiles(id) on delete cascade,
 balance numeric not null default 0 check(balance>=0),
 total_earned numeric not null default 0 check(total_earned>=0),
 updated_at timestamptz not null default now()
);
create table if not exists public.payouts(
 id uuid primary key default gen_random_uuid(),
 mitra_id uuid not null references public.profiles(id) on delete cascade,
 amount numeric not null check(amount>0),
 bank_name text,
 account_name text,
 account_number text,
 status text not null default 'pending' check(status in('pending','processing','paid','rejected')),
 reference text,
 created_at timestamptz not null default now(),
 processed_at timestamptz
);
create table if not exists public.app_settings(
 key text primary key,
 value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.services enable row level security;
alter table public.partner_profiles enable row level security;
alter table public.partner_services enable row level security;
alter table public.orders enable row level security;
alter table public.order_status_history enable row level security;
alter table public.partner_locations enable row level security;
alter table public.payments enable row level security;
alter table public.reviews enable row level security;
alter table public.notifications enable row level security;
alter table public.mitra_wallets enable row level security;
alter table public.payouts enable row level security;
alter table public.app_settings enable row level security;

insert into public.services(name,description,icon) values
('Service AC','Perawatan dan perbaikan AC','❄️'),
('Service Elektronik','Perbaikan perangkat elektronik','📺'),
('Tukang Listrik','Instalasi dan perbaikan listrik','⚡'),
('Tukang Bangunan','Pekerjaan bangunan dan renovasi','🧱'),
('Jasa Antar (Motor)','Pengantaran menggunakan motor','🛵'),
('Jasa Antar (Mobil)','Pengantaran menggunakan mobil','🚗')
on conflict(name) do nothing;

insert into public.app_settings(key,value) values
('platform',jsonb_build_object('name','JASA AJA','payment_methods',jsonb_build_array('qris','cash')))
on conflict(key) do nothing;
