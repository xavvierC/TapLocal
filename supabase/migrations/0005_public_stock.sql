-- Public, read-only stock counts for the site. Exposes only id and stock_count.
-- The view runs with the owner's privileges, so it reads the inventory table without opening that table to customers.
create or replace view public.stock_public as
select id, stock_count from public.inventory;

grant select on public.stock_public to anon, authenticated;
