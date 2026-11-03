-- ============================================================================
--  AMÉZA store — Supabase / PostgreSQL schema
--  Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
--  Catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id               uuid primary key default gen_random_uuid(),
  handle           text not null unique,
  title            text not null,
  description_html text not null default '',
  vendor           text not null default 'Améza',
  product_type     text not null default '',
  tags             text[] not null default '{}',
  images           text[] not null default '{}',   -- full image URLs (Supabase Storage / CDN)
  fragrance        jsonb not null default '{}'::jsonb,
  published        boolean not null default true,
  sort_order       int not null default 0,         -- "Featured" order
  best_selling     int not null default 0,         -- higher = sells more
  created_at       timestamptz not null default now()
);

create table if not exists public.product_variants (
  id                 uuid primary key default gen_random_uuid(),
  product_id         uuid not null references public.products(id) on delete cascade,
  title              text not null default 'Default Title',
  option_name        text not null default 'Title',
  price              numeric(12,2) not null check (price >= 0),
  compare_at_price   numeric(12,2),
  sku                text,
  inventory_quantity int not null default 0,
  position           int not null default 1
);
create index if not exists product_variants_product_idx on public.product_variants(product_id);

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  handle      text not null unique,
  title       text not null,
  description text not null default '',
  image       text,
  sort_order  int not null default 0
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id    uuid not null references public.products(id) on delete cascade,
  position      int not null default 0,
  primary key (collection_id, product_id)
);

-- ---------------------------------------------------------------------------
--  Content
-- ---------------------------------------------------------------------------
create table if not exists public.site_content (
  id         text primary key default 'default' check (id = 'default'),
  content    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.pages (
  id           uuid primary key default gen_random_uuid(),
  handle       text not null unique,
  title        text not null,
  content_html text not null default '',
  published    boolean not null default true
);

create table if not exists public.blogs (
  id     uuid primary key default gen_random_uuid(),
  handle text not null unique,
  title  text not null
);

create table if not exists public.articles (
  id           uuid primary key default gen_random_uuid(),
  blog_id      uuid not null references public.blogs(id) on delete cascade,
  handle       text not null,
  title        text not null,
  author       text,
  image        text,
  excerpt      text,
  content_html text not null default '',
  published_at timestamptz not null default now(),
  published    boolean not null default true,
  unique (blog_id, handle)
);

-- ---------------------------------------------------------------------------
--  Customers (Supabase Auth owns the login; this is the extra profile data)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  first_name text,
  last_name  text,
  phone      text,
  created_at timestamptz not null default now()
);

-- auto-create a profile row whenever someone signs up
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, first_name, last_name)
  values (new.id,
          new.raw_user_meta_data->>'first_name',
          new.raw_user_meta_data->>'last_name')
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table if not exists public.addresses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  first_name text not null,
  last_name  text,
  address1   text not null,
  city       text not null,
  country    text not null default 'Pakistan',
  zip        text,
  phone      text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Orders
-- ---------------------------------------------------------------------------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  order_number       int not null unique default nextval('public.order_number_seq'),
  user_id            uuid references auth.users(id) on delete set null,
  email              text not null,
  phone              text not null,
  shipping_address   jsonb not null,
  subtotal           numeric(12,2) not null,
  shipping           numeric(12,2) not null default 0,
  discount           numeric(12,2) not null default 0,
  discount_code      text,
  total              numeric(12,2) not null,
  payment_method     text not null default 'cod',
  payment_reference text,
  payment_status     text not null default 'pending',   -- pending | paid | refunded
  confirmation_status text not null default 'pending', -- pending | confirmed | rejected
  fulfillment_status text not null default 'unfulfilled', -- unfulfilled | shipped | delivered | cancelled
  note               text,
  created_at         timestamptz not null default now()
);
alter table public.orders add column if not exists payment_reference text;
-- Existing installations keep their prior orders as confirmed; new orders wait for admin approval.
alter table public.orders add column if not exists confirmation_status text not null default 'confirmed';
alter table public.orders alter column confirmation_status set default 'pending';
create index if not exists orders_user_idx on public.orders(user_id);

create table if not exists public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders(id) on delete cascade,
  product_id    uuid references public.products(id) on delete set null,
  variant_id    uuid references public.product_variants(id) on delete set null,
  handle        text,
  title         text not null,
  variant_title text,
  price         numeric(12,2) not null,
  quantity      int not null check (quantity > 0),
  image         text
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.discount_codes (
  code         text primary key,
  percent      numeric(5,2) not null check (percent > 0 and percent <= 100),
  min_subtotal numeric(12,2) not null default 0,
  active       boolean not null default true,
  expires_at   timestamptz
);

create table if not exists public.newsletter_subscribers (
  email      text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  email      text not null,
  phone      text,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  Row Level Security
--  The Express API uses the *service role* key, which bypasses RLS.
--  These rules protect the database if someone talks to Supabase directly
--  using the public (anon) key from the browser.
-- ---------------------------------------------------------------------------
alter table public.products               enable row level security;
alter table public.product_variants       enable row level security;
alter table public.collections            enable row level security;
alter table public.collection_products    enable row level security;
alter table public.site_content           enable row level security;
alter table public.pages                  enable row level security;
alter table public.blogs                  enable row level security;
alter table public.articles               enable row level security;
alter table public.profiles               enable row level security;
alter table public.addresses              enable row level security;
alter table public.orders                 enable row level security;
alter table public.order_items            enable row level security;
alter table public.discount_codes         enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.contact_messages       enable row level security;

-- public, read-only catalogue + content
drop policy if exists "public read products"   on public.products;
create policy "public read products"   on public.products            for select using (published);
drop policy if exists "public read variants"   on public.product_variants;
create policy "public read variants"   on public.product_variants    for select using (true);
drop policy if exists "public read collections" on public.collections;
create policy "public read collections" on public.collections        for select using (true);
drop policy if exists "public read coll products" on public.collection_products;
create policy "public read coll products" on public.collection_products for select using (true);
drop policy if exists "public read site content" on public.site_content;
create policy "public read site content" on public.site_content for select using (true);
drop policy if exists "public read pages"      on public.pages;
create policy "public read pages"      on public.pages               for select using (published);
drop policy if exists "public read blogs"      on public.blogs;
create policy "public read blogs"      on public.blogs               for select using (true);
drop policy if exists "public read articles"   on public.articles;
create policy "public read articles"   on public.articles            for select using (published);
grant select on public.site_content to anon, authenticated;

-- a signed-in customer can only see / edit their own data
drop policy if exists "own profile read"   on public.profiles;
create policy "own profile read"   on public.profiles  for select using (auth.uid() = id);
drop policy if exists "own profile update" on public.profiles;
create policy "own profile update" on public.profiles  for update using (auth.uid() = id);

drop policy if exists "own addresses" on public.addresses;
create policy "own addresses" on public.addresses for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own orders read" on public.orders;
create policy "own orders read" on public.orders for select using (auth.uid() = user_id);

drop policy if exists "own order items read" on public.order_items;
create policy "own order items read" on public.order_items for select
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));

-- discount_codes, newsletter_subscribers, contact_messages: no policies =
-- nobody can touch them from the browser; only the API (service role) can.
