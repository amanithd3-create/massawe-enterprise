
-- MASSAWE ENTERPRISE
-- Marketplace and Affiliate Commission System
-- Fixed commission: 5%

create extension if not exists pgcrypto;

-- 1. Marketplace sellers
create table if not exists public.sellers (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  country text default 'Tanzania',
  status text not null default 'pending'
    check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now(),
  unique(owner_user_id)
);

-- 2. External affiliate platforms
create table if not exists public.affiliate_partners (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete set null,
  platform_name text not null,
  website_url text,
  status text not null default 'pending'
    check (status in ('pending','active','suspended')),
  created_at timestamptz not null default now()
);

-- 3. Products from marketplace sellers and affiliate platforms
create table if not exists public.affiliate_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_url text,
  price numeric(12,2) not null default 0 check (price >= 0),
  currency text not null default 'TZS',
  source_type text not null
    check (source_type in ('marketplace','affiliate')),
  seller_id uuid references public.sellers(id) on delete cascade,
  affiliate_partner_id uuid references public.affiliate_partners(id) on delete cascade,
  external_product_id text,
  affiliate_url text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),

  constraint product_source_owner_check check (
    (source_type = 'marketplace'
      and seller_id is not null
      and affiliate_partner_id is null)
    or
    (source_type = 'affiliate'
      and affiliate_partner_id is not null
      and seller_id is null
      and affiliate_url is not null)
  )
);

-- 4. Customer clicks on external affiliate products
create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  affiliate_product_id uuid not null
    references public.affiliate_products(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- 5. Confirmed sales and commissions
create table if not exists public.commissions (
  id uuid primary key default gen_random_uuid(),
  affiliate_product_id uuid not null
    references public.affiliate_products(id),
  seller_id uuid references public.sellers(id),
  affiliate_partner_id uuid references public.affiliate_partners(id),
  click_id uuid references public.affiliate_clicks(id),
  order_reference text not null,
  gross_amount numeric(12,2) not null check (gross_amount > 0),
  commission_rate numeric(5,4) not null default 0.0500
    check (commission_rate = 0.0500),
  commission_amount numeric(12,2) not null,
  currency text not null default 'TZS',
  status text not null default 'earned'
    check (status in ('earned','reversed','paid')),
  created_at timestamptz not null default now(),

  unique(affiliate_product_id, order_reference)
);

-- 6. Seller payouts
create table if not exists public.seller_payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id),
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'TZS',
  payment_method text,
  payment_reference text,
  status text not null default 'pending'
    check (status in ('pending','processing','paid','failed')),
  created_at timestamptz not null default now()
);

-- Indexes
create index if not exists idx_products_active
  on public.affiliate_products(is_active);

create index if not exists idx_products_seller
  on public.affiliate_products(seller_id);

create index if not exists idx_products_partner
  on public.affiliate_products(affiliate_partner_id);

create index if not exists idx_clicks_product
  on public.affiliate_clicks(affiliate_product_id);

create index if not exists idx_commissions_seller
  on public.commissions(seller_id);

create index if not exists idx_commissions_partner
  on public.commissions(affiliate_partner_id);

create index if not exists idx_payouts_seller
  on public.seller_payouts(seller_id);

-- Enable security
alter table public.sellers enable row level security;
alter table public.affiliate_partners enable row level security;
alter table public.affiliate_products enable row level security;
alter table public.affiliate_clicks enable row level security;
alter table public.commissions enable row level security;
alter table public.seller_payouts enable row level security;

-- Sellers can see and update their own seller account
drop policy if exists "Owners view own sellers"
on public.sellers;

create policy "Owners view own sellers"
on public.sellers for select
to authenticated
using (owner_user_id = auth.uid());

drop policy if exists "Owners update own sellers"
on public.sellers;

create policy "Owners update own sellers"
on public.sellers for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());

-- Active products can be viewed by customers
drop policy if exists "Public view active products"
on public.affiliate_products;

create policy "Public view active products"
on public.affiliate_products for select
to anon, authenticated
using (is_active = true);

-- Sellers can view their own products
drop policy if exists "Sellers view own products"
on public.affiliate_products;

create policy "Sellers view own products"
on public.affiliate_products for select
to authenticated
using (
  seller_id in (
    select id from public.sellers
    where owner_user_id = auth.uid()
  )
);

-- Affiliate partners can view their own products
drop policy if exists "Partners view own products"
on public.affiliate_products;

create policy "Partners view own products"
on public.affiliate_products for select
to authenticated
using (
  affiliate_partner_id in (
    select id from public.affiliate_partners
    where owner_user_id = auth.uid()
  )
);

-- Sellers can see their commissions
drop policy if exists "Sellers view own commissions"
on public.commissions;

create policy "Sellers view own commissions"
on public.commissions for select
to authenticated
using (
  seller_id in (
    select id from public.sellers
    where owner_user_id = auth.uid()
  )
);

-- Affiliate partners can see their commissions
drop policy if exists "Partners view own commissions"
on public.commissions;

create policy "Partners view own commissions"
on public.commissions for select
to authenticated
using (
  affiliate_partner_id in (
    select id from public.affiliate_partners
    where owner_user_id = auth.uid()
  )
);

-- Sellers can view their payouts
drop policy if exists "Sellers view own payouts"
on public.seller_payouts;

create policy "Sellers view own payouts"
on public.seller_payouts for select
to authenticated
using (
  seller_id in (
    select id from public.sellers
    where owner_user_id = auth.uid()
  )
);

-- Clicks and financial records are written by trusted server functions.
-- Do not add public insert/update policies to these tables.
