-- AMEZA admin dashboard access and product image storage.
-- Run after schema.sql in the Supabase SQL Editor.

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users where user_id = auth.uid()
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.admin_set_order_confirmation(p_order_id uuid, p_decision text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if p_decision not in ('confirmed', 'rejected') then
    raise exception 'Invalid order decision';
  end if;

  select confirmation_status into current_status
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;
  if current_status <> 'pending' then
    raise exception 'Order has already been reviewed';
  end if;

  update public.orders
  set confirmation_status = p_decision
  where id = p_order_id;

  if p_decision = 'rejected' then
    update public.product_variants as variant
    set inventory_quantity = variant.inventory_quantity + item.quantity
    from public.order_items as item
    where item.order_id = p_order_id
      and item.variant_id = variant.id;
  end if;

  return p_decision;
end;
$$;
revoke all on function public.admin_set_order_confirmation(uuid, text) from public, anon;
grant execute on function public.admin_set_order_confirmation(uuid, text) to authenticated;

grant select, insert, update, delete on public.products, public.product_variants to authenticated;
grant select, insert, update, delete on public.collections to authenticated;
grant select on public.collection_products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, insert, update on public.site_content to authenticated;

drop policy if exists "admin manage collections" on public.collections;
create policy "admin manage collections" on public.collections
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict collection inserts to admins" on public.collections;
create policy "restrict collection inserts to admins" on public.collections
  as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists "restrict collection updates to admins" on public.collections;
create policy "restrict collection updates to admins" on public.collections
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict collection deletes to admins" on public.collections;
create policy "restrict collection deletes to admins" on public.collections
  as restrictive for delete to authenticated using (public.is_admin());

drop policy if exists "admin manage site content" on public.site_content;
create policy "admin manage site content" on public.site_content
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict site content writes to admins" on public.site_content;
create policy "restrict site content writes to admins" on public.site_content
  as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists "restrict site content updates to admins" on public.site_content;
create policy "restrict site content updates to admins" on public.site_content
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.admin_set_product_collections(p_product_id uuid, p_collection_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'Product not found';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_collection_ids, array[]::uuid[])) as selected(collection_id)
    left join public.collections collection on collection.id = selected.collection_id
    where collection.id is null or collection.handle = 'all'
  ) then
    raise exception 'One or more selected collections are invalid';
  end if;

  delete from public.collection_products where product_id = p_product_id;
  insert into public.collection_products (collection_id, product_id, position)
  select selected.collection_id, p_product_id, (selected.position - 1)::int
  from (
    select collection_id, min(ordinality) as position
    from unnest(coalesce(p_collection_ids, array[]::uuid[])) with ordinality as requested(collection_id, ordinality)
    group by collection_id
  ) as selected
  order by selected.position;
end;
$$;
revoke all on function public.admin_set_product_collections(uuid, uuid[]) from public, anon;
grant execute on function public.admin_set_product_collections(uuid, uuid[]) to authenticated;

drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict product reads to published or admin" on public.products;
create policy "restrict product reads to published or admin" on public.products
  as restrictive for select to authenticated using (published or public.is_admin());
drop policy if exists "restrict product inserts to admins" on public.products;
create policy "restrict product inserts to admins" on public.products
  as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists "restrict product updates to admins" on public.products;
create policy "restrict product updates to admins" on public.products
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict product deletes to admins" on public.products;
create policy "restrict product deletes to admins" on public.products
  as restrictive for delete to authenticated using (public.is_admin());
drop policy if exists "admin manage variants" on public.product_variants;
create policy "admin manage variants" on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict variant inserts to admins" on public.product_variants;
create policy "restrict variant inserts to admins" on public.product_variants
  as restrictive for insert to authenticated with check (public.is_admin());
drop policy if exists "restrict variant updates to admins" on public.product_variants;
create policy "restrict variant updates to admins" on public.product_variants
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict variant deletes to admins" on public.product_variants;
create policy "restrict variant deletes to admins" on public.product_variants
  as restrictive for delete to authenticated using (public.is_admin());
drop policy if exists "admin read orders" on public.orders;
create policy "admin read orders" on public.orders
  for select to authenticated using (public.is_admin());
drop policy if exists "restrict order reads to owner or admin" on public.orders;
create policy "restrict order reads to owner or admin" on public.orders
  as restrictive for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "restrict order updates to admins" on public.orders;
create policy "restrict order updates to admins" on public.orders
  as restrictive for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin read order items" on public.order_items;
create policy "admin read order items" on public.order_items
  for select to authenticated using (public.is_admin());
drop policy if exists "restrict order item reads to owner or admin" on public.order_items;
create policy "restrict order item reads to owner or admin" on public.order_items
  as restrictive for select to authenticated using (
    public.is_admin() or exists (
      select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()
    )
  );

insert into storage.buckets (id, name, public)
values ('ameza-product-images', 'ameza-product-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "public read AMEZA product images" on storage.objects;
create policy "public read AMEZA product images" on storage.objects
  for select to public using (bucket_id = 'ameza-product-images');
drop policy if exists "admin upload AMEZA product images" on storage.objects;
create policy "admin upload AMEZA product images" on storage.objects
  for insert to authenticated with check (bucket_id = 'ameza-product-images' and public.is_admin());
drop policy if exists "restrict AMEZA image uploads to admins" on storage.objects;
create policy "restrict AMEZA image uploads to admins" on storage.objects
  as restrictive for insert to authenticated
  with check (bucket_id <> 'ameza-product-images' or public.is_admin());
drop policy if exists "admin update AMEZA product images" on storage.objects;
create policy "admin update AMEZA product images" on storage.objects
  for update to authenticated using (bucket_id = 'ameza-product-images' and public.is_admin())
  with check (bucket_id = 'ameza-product-images' and public.is_admin());
drop policy if exists "restrict AMEZA image updates to admins" on storage.objects;
create policy "restrict AMEZA image updates to admins" on storage.objects
  as restrictive for update to authenticated
  using (bucket_id <> 'ameza-product-images' or public.is_admin())
  with check (bucket_id <> 'ameza-product-images' or public.is_admin());
drop policy if exists "admin delete AMEZA product images" on storage.objects;
create policy "admin delete AMEZA product images" on storage.objects
  for delete to authenticated using (bucket_id = 'ameza-product-images' and public.is_admin());
drop policy if exists "restrict AMEZA image deletes to admins" on storage.objects;
create policy "restrict AMEZA image deletes to admins" on storage.objects
  as restrictive for delete to authenticated
  using (bucket_id <> 'ameza-product-images' or public.is_admin());

-- After creating the admin in Supabase Auth, replace the UUID and run:
-- insert into public.admin_users (user_id)
-- values ('REPLACE_WITH_AUTH_USER_UUID')
-- on conflict (user_id) do nothing;
