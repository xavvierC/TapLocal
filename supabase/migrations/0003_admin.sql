-- REVIEW ONLY. Requires 0002_customer_journey.sql. Do not execute automatically.
begin;
create table public.admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon,authenticated;
grant select on public.admins to authenticated;
-- Membership is managed manually by the owner, never through the browser.
create policy admins_own_membership on public.admins for select to authenticated
 using ((select auth.uid())=user_id);
create function public.is_admin() returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.admins where user_id=auth.uid())
$$;
revoke all on function public.is_admin() from public,anon;
grant execute on function public.is_admin() to authenticated;

create table public.inventory (
 id text primary key check(id in ('google','instagram')), label text not null,
 stock_count integer not null check(stock_count>=0), updated_at timestamptz not null default now()
);
-- OWNER MUST CONFIRM these initial quantities before applying this migration.
insert into public.inventory(id,label,stock_count) values('google','Placa Google',20),('instagram','Placa Instagram',20);
create table public.settings (
 key text primary key, value numeric, text_value text, updated_at timestamptz not null default now(),
 check ((value is null) <> (text_value is null)),
 check (key<>'commission_percent' or (value is not null and value between 0 and 100)),
 check (key<>'commission_cap' or (value is not null and value>=0)),
 check (key<>'cycle' or (text_value is not null and text_value='monthly'))
);
insert into public.settings(key,value,text_value) values
 ('commission_percent',15,null),('commission_cap',800,null),('cycle',null,'monthly');
create table public.admin_log (
 id uuid primary key default gen_random_uuid(),
 admin_user_id uuid references auth.users(id) on delete set null,
 action text not null, target_id text not null, details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.inventory enable row level security;
alter table public.settings enable row level security;
alter table public.admin_log enable row level security;
revoke all on public.inventory,public.settings,public.admin_log from anon,authenticated;
grant select,insert,update on public.inventory,public.settings to authenticated;
grant select on public.admin_log to authenticated;
create policy inventory_admin on public.inventory for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy settings_admin on public.settings for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy log_admin_read on public.admin_log for select to authenticated using ((select public.is_admin()));
-- Audit inserts come only from internal triggers. No client INSERT/UPDATE/DELETE grants.

alter table public.orders add column price_cents integer;
-- No earlier price snapshots exist. Owner must review this backfill if historical orders exist.
update public.orders set price_cents=case product when 'duo' then 17990 when 'kit' then 29990 else 9990 end;
alter table public.orders alter column price_cents set not null;
alter table public.orders add constraint orders_price_nonnegative check(price_cents>=0);
-- Preserve the deletion request after the owner manually removes the Auth account.
alter table public.deletion_requests drop constraint deletion_requests_user_id_fkey;
alter table public.deletion_requests alter column user_id drop not null;
alter table public.deletion_requests add foreign key(user_id) references auth.users(id) on delete set null;
alter table public.deletion_requests add constraint deletion_request_status check(status in ('pendente','concluida'));

-- Customer ownership policies from 0002 remain intact. These policies add admin access,
-- not public access. Non-admins cannot see admin tables or other customers' records.
create policy profiles_admin_read on public.profiles for select to authenticated using ((select public.is_admin()));
create policy addresses_admin_read on public.addresses for select to authenticated using ((select public.is_admin()));
create policy orders_admin on public.orders for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy plates_admin on public.plates for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy deletion_admin on public.deletion_requests for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy notifications_admin on public.notifications_outbox for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
grant update(status) on public.orders,public.plates,public.deletion_requests to authenticated;
grant select,insert,update on public.notifications_outbox to authenticated;
grant insert(id,user_id,product,quantity,company_name,locality,instagram_handle,observation) on public.orders to authenticated;
grant insert(order_id,user_id,type) on public.plates to authenticated;
-- Restrictive INSERT rules also apply to admins. All orders start unpaid, all plates pending.
create policy orders_initial_state on public.orders as restrictive for insert to authenticated
 with check (status='aguardando_pagamento' and paid_at is null and shipped_at is null);
create policy plates_initial_state on public.plates as restrictive for insert to authenticated
 with check (status='aguardando_configuracao' and configured_url is null);
create policy deletion_initial_state on public.deletion_requests as restrictive for insert to authenticated
 with check (status='pendente');

create function taplocal_private.order_admin_rules() returns trigger language plpgsql security invoker set search_path='' as $$
declare item record; wanted integer; actual integer;
begin
 if tg_op='INSERT' then
  -- Trusted price snapshot: never accept a price supplied by the customer.
  new.price_cents=case new.product when 'duo' then 17990 when 'kit' then 29990 else 9990 end;
  return new;
 end if;
 if new.price_cents is distinct from old.price_cents or new.product is distinct from old.product or new.quantity is distinct from old.quantity
 or new.user_id is distinct from old.user_id or new.id is distinct from old.id or new.created_at is distinct from old.created_at then
  raise exception 'Os dados originais do pedido não podem ser alterados.';
 end if;
 if new.paid_at is distinct from old.paid_at or new.shipped_at is distinct from old.shipped_at then
  raise exception 'As datas do pedido são preenchidas automaticamente.';
 end if;
 if new.status is not distinct from old.status then return new; end if;
 -- Column grants apply to the shared authenticated role; this guard additionally
 -- prevents customers' existing ownership UPDATE policies from changing status.
 if not public.is_admin() then raise exception 'Acesso restrito.'; end if;
 if not ((old.status='aguardando_pagamento' and new.status in ('pago','cancelado'))
 or (old.status='pago' and new.status='em_producao')
 or (old.status='em_producao' and new.status='enviado')
 or (old.status='enviado' and new.status='entregue')) then
  raise exception 'Esta mudança de status não é permitida.';
 end if;
 if new.status='pago' then
  -- Lock in the same order for concurrent payments and stock adjustments.
  for item in select id,stock_count from public.inventory order by id for update loop
   wanted=(new.quantity->>item.id)::integer;
   select count(*) into actual from public.plates where order_id=new.id and type=item.id;
   if actual<>wanted then raise exception 'Confira as placas deste pedido antes de confirmar o pagamento.'; end if;
   if item.stock_count<wanted then raise exception 'Estoque insuficiente. Confira o estoque antes de confirmar o pagamento.'; end if;
   if wanted>0 then update public.inventory set stock_count=stock_count-wanted where id=item.id; end if;
  end loop;
  if (select count(*) from public.inventory)<>2 then raise exception 'Confira os dois tipos de estoque.'; end if;
  new.paid_at=coalesce(old.paid_at,now());
 elsif new.status='enviado' then new.shipped_at=coalesce(old.shipped_at,now());
 end if;
 return new;
end $$;
create trigger orders_admin_rules before insert or update on public.orders for each row execute function taplocal_private.order_admin_rules();

-- Saving a customer link requests review. Only the owner confirms configuration.
create or replace function taplocal_private.configure_plate() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.configured_url is null or
 (new.type='google' and new.configured_url !~ '^https://(www\.)?(google\.com|g\.page)(/|\?|$)') or
 (new.type='instagram' and new.configured_url !~ '^https://(www\.)?instagram\.com(/|\?|$)') then
  raise exception 'Confira o link da placa.';
 end if;
 if new.configured_url is distinct from old.configured_url then
  new.status='aguardando_configuracao'; new.configured_at=null;
 end if;
 return new;
end $$;
create function taplocal_private.guard_plate_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.user_id is distinct from old.user_id or new.order_id is distinct from old.order_id or new.type is distinct from old.type or new.id is distinct from old.id then
  raise exception 'Os dados originais da placa não podem ser alterados.';
 end if;
 -- The configuration trigger may reset status when a valid link is changed.
 if new.configured_url is distinct from old.configured_url then return new; end if;
 if new.status is distinct from old.status or new.configured_at is distinct from old.configured_at then
  if not public.is_admin() or new.status<>'configurada' or new.configured_url is null then raise exception 'Acesso restrito.'; end if;
  new.configured_at=now();
 end if;
 return new;
end $$;
-- Runs after plates_configuration, including for changes initiated by the customer.
create trigger plates_status_guard before update on public.plates for each row execute function taplocal_private.guard_plate_status();
create function taplocal_private.guard_deletion_status() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status is distinct from old.status and
 (not public.is_admin() or old.status<>'pendente' or new.status<>'concluida') then raise exception 'Acesso restrito.'; end if;
 return new;
end $$;
create trigger deletion_status_guard before update of status on public.deletion_requests for each row execute function taplocal_private.guard_deletion_status();

create trigger inventory_updated before update on public.inventory for each row execute function taplocal_private.touch_updated_at();
create trigger settings_updated before update on public.settings for each row execute function taplocal_private.touch_updated_at();
-- Internal audit writer only. It must insert records into a client-immutable table.
create function taplocal_private.audit_admin_change() returns trigger language plpgsql security definer set search_path='' as $$
declare event text; changes jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.admins where user_id=auth.uid()) then return new; end if;
 -- Branch by relation before referencing fields that do not exist on every record.
 if tg_table_name='orders' then
  if new.status is distinct from old.status then event='order_status'; changes=jsonb_build_object('before',old.status,'after',new.status); end if;
 elsif tg_table_name='inventory' then
  if new.stock_count is distinct from old.stock_count then event='inventory_adjustment'; changes=jsonb_build_object('before',old.stock_count,'after',new.stock_count); end if;
 elsif tg_table_name='deletion_requests' then
  if new.status is distinct from old.status then event='deletion_completed'; changes=jsonb_build_object('before',old.status,'after',new.status); end if;
 elsif tg_table_name='plates' then
  if new.status is distinct from old.status then event='plate_configuration'; changes=jsonb_build_object('before',old.status,'after',new.status); end if;
 end if;
 if event is not null then insert into public.admin_log(admin_user_id,action,target_id,details) values(auth.uid(),event,new.id::text,changes); end if;
 return new;
end $$;
create trigger orders_audit after update on public.orders for each row execute function taplocal_private.audit_admin_change();
create trigger inventory_audit after update on public.inventory for each row execute function taplocal_private.audit_admin_change();
create trigger deletion_audit after update on public.deletion_requests for each row execute function taplocal_private.audit_admin_change();
create trigger plates_audit after update on public.plates for each row execute function taplocal_private.audit_admin_change();
revoke all on all functions in schema taplocal_private from public,anon,authenticated;

create index orders_admin_created on public.orders(created_at desc);
create index orders_admin_paid on public.orders(paid_at) where paid_at is not null;
create index plates_admin_pending on public.plates(order_id) where status='aguardando_configuracao';
create index deletion_admin_pending on public.deletion_requests(requested_at) where status='pendente';
create index admin_log_created on public.admin_log(created_at desc);
commit;
