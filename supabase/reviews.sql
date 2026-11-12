-- Run after schema.sql and admin.sql. Guest submissions go through the server API.
begin;
create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  city text not null default '' check (char_length(city) <= 80),
  rating smallint not null check (rating between 1 and 5),
  feedback text not null check (char_length(feedback) between 10 and 2000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists reviews_product_status_date on public.customer_reviews(product_id, status, created_at desc);
create index if not exists reviews_status_date on public.customer_reviews(status, created_at desc);
-- Separate private ledger keeps rate limits and duplicates intact after spam is deleted.
create table if not exists public.review_submissions (
  duplicate_hash text primary key,
  request_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists review_submissions_rate on public.review_submissions(request_hash, created_at);
alter table public.customer_reviews enable row level security;
alter table public.review_submissions enable row level security;
revoke all on public.customer_reviews, public.review_submissions from public, anon, authenticated;
grant select, delete on public.customer_reviews to authenticated;
grant update(status) on public.customer_reviews to authenticated;
drop policy if exists "admin manage customer reviews" on public.customer_reviews;
create policy "admin manage customer reviews" on public.customer_reviews for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create or replace function public.submit_customer_review(
  p_product_id uuid, p_name text, p_city text, p_rating smallint, p_feedback text,
  p_duplicate_hash text, p_request_hash text, p_user_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare review_id uuid; verified boolean;
begin
  -- Serialize requests from the same fingerprint across instances and concurrent requests.
  perform pg_advisory_xact_lock(hashtextextended(p_request_hash, 0));
  if not exists (select 1 from products where id = p_product_id and published) then
    raise exception 'REVIEW_PRODUCT_NOT_FOUND';
  end if;
  if exists (select 1 from review_submissions where duplicate_hash = p_duplicate_hash) then
    raise exception 'REVIEW_DUPLICATE';
  end if;
  if (select count(*) from review_submissions where request_hash = p_request_hash and created_at > now() - interval '1 hour') >= 3 then
    raise exception 'REVIEW_RATE_LIMIT';
  end if;
  select exists (
    select 1 from orders o join order_items i on i.order_id = o.id
    where o.user_id = p_user_id and i.product_id = p_product_id
      and o.confirmation_status = 'confirmed' and o.payment_status = 'paid'
      and o.fulfillment_status = 'delivered'
  ) into verified;
  insert into review_submissions(duplicate_hash, request_hash) values (p_duplicate_hash, p_request_hash);
  insert into customer_reviews(product_id, name, city, rating, feedback, verified_purchase)
    values (p_product_id, p_name, p_city, p_rating, p_feedback, verified) returning id into review_id;
  return review_id;
end;
$$;
revoke all on function public.submit_customer_review(uuid,text,text,smallint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.submit_customer_review(uuid,text,text,smallint,text,text,text,uuid) to service_role;

-- One snapshot supplies both the paginated cards and statistics over ALL approved reviews.
create or replace function public.public_customer_reviews(p_product_id uuid default null, p_page integer default 1)
returns jsonb language sql stable security definer set search_path = public as $$
  with approved as (
    select r.*, p.title as product_title from customer_reviews r join products p on p.id = r.product_id
    where r.status = 'approved' and p.published and (p_product_id is null or r.product_id = p_product_id)
  ), summary as (
    select count(*) as count, round(avg(rating), 1) as average,
      jsonb_build_object('1', count(*) filter(where rating = 1), '2', count(*) filter(where rating = 2),
        '3', count(*) filter(where rating = 3), '4', count(*) filter(where rating = 4), '5', count(*) filter(where rating = 5)) as distribution
    from approved
  ), cards as (
    select id, product_id, product_title, name, city, rating, feedback, verified_purchase, created_at
    from approved order by created_at desc, id desc limit 12 offset ((greatest(1, least(p_page, 10000)) - 1) * 12)
  ) select jsonb_build_object('reviews', coalesce((select jsonb_agg(to_jsonb(cards)) from cards), '[]'::jsonb),
    'summary', to_jsonb(summary), 'page', greatest(1, least(p_page, 10000)),
    'hasMore', summary.count > greatest(1, least(p_page, 10000)) * 12) from summary;
$$;
revoke all on function public.public_customer_reviews(uuid,integer) from public;
grant execute on function public.public_customer_reviews(uuid,integer) to anon, authenticated, service_role;
commit;
