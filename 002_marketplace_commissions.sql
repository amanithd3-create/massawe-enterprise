-- Massawe Enterprise marketplace + 5% referral commission foundation
-- Apply in Supabase SQL Editor. This does NOT enable live payment collection.
create extension if not exists pgcrypto;

-- Extend account roles without trusting browser-supplied role metadata.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('owner','admin','staff','vendor','customer'));

-- Marketplace business partners.
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  business_name text not null,
  description text,
  category text,
  contact_email text,
  contact_phone text,
  whatsapp_number text,
  website_url text,
  location text,
  logo_url text,
  status text not null default 'pending' check (status in ('pending','approved','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists businesses_status_idx on public.businesses(status);

-- Attach products to an approved partner business; products can still be Massawe-owned.
alter table public.products add column if not exists business_id uuid references public.businesses(id) on delete set null;
alter table public.products add column if not exists image_url text;
create index if not exists products_business_idx on public.products(business_id);

-- Every attributed sale records the 5% platform fee and the partner payout amount.
create table if not exists public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  business_id uuid not null references public.businesses(id),
  order_item_id uuid references public.order_items(id) on delete set null,
  gross_amount_tzs numeric(14,2) not null check (gross_amount_tzs >= 0),
  commission_rate numeric(5,4) not null default 0.0500 check (commission_rate = 0.0500),
  commission_amount_tzs numeric(14,2) not null check (commission_amount_tzs >= 0),
  partner_amount_tzs numeric(14,2) not null check (partner_amount_tzs >= 0),
  status text not null default 'pending' check (status in ('pending','approved','paid','reversed')),
  created_at timestamptz not null default now(),
  unique(order_id, order_item_id)
);
create index if not exists commission_business_status_idx on public.commission_ledger(business_id,status);

alter table public.businesses enable row level security;
alter table public.commission_ledger enable row level security;

-- Public can discover approved businesses. Owners can manage their own application/profile.
drop policy if exists "public discover approved businesses" on public.businesses;
create policy "public discover approved businesses" on public.businesses
  for select using (status = 'approved' or owner_user_id = auth.uid() or public.is_staff());
drop policy if exists "business owner create own listing" on public.businesses;
create policy "business owner create own listing" on public.businesses
  for insert with check (owner_user_id = auth.uid() and status = 'pending');
drop policy if exists "business owner update own listing" on public.businesses;
create policy "business owner update own listing" on public.businesses
  for update using (owner_user_id = auth.uid() or public.is_staff())
  with check (owner_user_id = auth.uid() or public.is_staff());

-- Approved vendors may add/edit their own products; public product reads remain governed by existing policy.
drop policy if exists "approved business manage own products" on public.products;
create policy "approved business manage own products" on public.products
  for all using (
    public.is_staff() or exists (
      select 1 from public.businesses b
      where b.id = products.business_id and b.owner_user_id = auth.uid() and b.status = 'approved'
    )
  ) with check (
    public.is_staff() or exists (
      select 1 from public.businesses b
      where b.id = products.business_id and b.owner_user_id = auth.uid() and b.status = 'approved'
    )
  );

-- Only staff can see and manage the commission ledger. Vendors should receive a restricted
-- reporting view/function later, never direct write access to commission values.
drop policy if exists "staff manage commission ledger" on public.commission_ledger;
create policy "staff manage commission ledger" on public.commission_ledger
  for all using (public.is_staff()) with check (public.is_staff());

-- Automatically grant the owner role only to the exact owner email when that account is created.
-- This is a trusted database trigger; never accept role from sign-up form metadata.
create or replace function public.set_massawe_owner_role()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if lower(coalesce(new.email,'')) = 'amanithd3@gmail.com' then
    insert into public.profiles(id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'name','Massawe Owner'), 'owner')
    on conflict (id) do update set role = 'owner';
  else
    insert into public.profiles(id, full_name, role)
    values (new.id, coalesce(new.raw_user_meta_data->>'name',''), 'customer')
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_massawe_profile on auth.users;
create trigger on_auth_user_created_massawe_profile
  after insert on auth.users
  for each row execute procedure public.set_massawe_owner_role();

-- Promote the named owner account if it already exists in Supabase Auth.
insert into public.profiles(id, full_name, role)
select id, coalesce(raw_user_meta_data->>'name','Massawe Owner'), 'owner'
from auth.users where lower(email) = 'amanithd3@gmail.com'
on conflict (id) do update set role = 'owner';

