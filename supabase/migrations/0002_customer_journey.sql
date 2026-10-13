-- Review-only migration. Do not execute automatically.
-- Email provider not chosen yet; a worker will read notifications_outbox where sent_at is null.
begin;
create schema if not exists taplocal_private;
revoke all on schema taplocal_private from public, anon, authenticated;
create table public.profiles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '', whatsapp text not null default '',
 -- Business preferences belong to the profile; order snapshots remain independent.
 company_name text not null default '', locality text not null default '', instagram_handle text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Initialize real profiles for new and existing Auth users, without client-side demo data.
create function taplocal_private.initialize_profile() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(user_id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''));
 return new;
end $$;
create trigger customer_profile_created after insert on auth.users for each row execute function taplocal_private.initialize_profile();
insert into public.profiles(user_id,full_name)
 select id,coalesce(raw_user_meta_data->>'full_name','') from auth.users;
create table public.addresses (
 id uuid primary key default gen_random_uuid(), user_id uuid not null unique references auth.users(id) on delete cascade,
 cep text not null, street text not null, number text not null, complement text not null default '',
 district text not null, city text not null, state text not null check (state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
 updated_at timestamptz not null default now()
);
create table public.orders (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 product text not null check (product in ('individual-google','individual-instagram','duo','kit')),
 quantity jsonb not null, company_name text not null default '', locality text not null,
 instagram_handle text not null default '', observation text not null default '' check (length(observation) <= 120),
 status text not null default 'aguardando_pagamento' check (status in ('aguardando_pagamento','pago','em_producao','enviado','entregue','cancelado')),
 created_at timestamptz not null default now(), paid_at timestamptz, shipped_at timestamptz,
 unique (id, user_id),
 check (jsonb_typeof(quantity) = 'object' and quantity ? 'google' and quantity ? 'instagram'),
 check (quantity=jsonb_build_object('google',(quantity->>'google')::int,'instagram',(quantity->>'instagram')::int)),
 check (length(btrim(locality))>0),
 check ((quantity->>'google')::int=0 or length(btrim(company_name))>0),
 check ((quantity->>'instagram')::int=0 or instagram_handle ~ '^[a-z0-9._]{1,30}$'),
 check ((quantity->>'google') ~ '^[0-4]$' and (quantity->>'instagram') ~ '^[0-4]$'),
 check ((product='individual-google' and quantity='{"google":1,"instagram":0}'::jsonb)
 or (product='individual-instagram' and quantity='{"google":0,"instagram":1}'::jsonb)
 or (product='duo' and quantity='{"google":1,"instagram":1}'::jsonb)
 or (product='kit' and (quantity->>'google')::int + (quantity->>'instagram')::int = 4))
);
create table public.plates (
 id uuid primary key default gen_random_uuid(), order_id uuid not null, user_id uuid not null references auth.users(id) on delete cascade,
 type text not null check (type in ('google','instagram')), configured_url text, configured_at timestamptz,
 status text not null default 'aguardando_configuracao' check (status in ('aguardando_configuracao','configurada')),
 foreign key (order_id,user_id) references public.orders(id,user_id) on delete cascade
);
create table public.deletion_requests (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 requested_at timestamptz not null default now(), status text not null default 'pendente'
);
create unique index deletion_requests_pending on public.deletion_requests(user_id) where status='pendente';
create table public.notifications_outbox (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 order_id uuid not null, type text not null check (type in ('pedido_recebido','pago','enviado','entregue')),
 created_at timestamptz not null default now(), sent_at timestamptz,
 foreign key(order_id,user_id) references public.orders(id,user_id) on delete cascade
);
create index orders_user_created on public.orders(user_id,created_at desc);
create index plates_user on public.plates(user_id);
create index plates_order on public.plates(order_id);
create index notifications_pending on public.notifications_outbox(created_at) where sent_at is null;

alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.orders enable row level security;
alter table public.plates enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.notifications_outbox enable row level security;
revoke all on public.profiles,public.addresses,public.orders,public.plates,public.deletion_requests,public.notifications_outbox from anon,authenticated;
grant select on public.profiles,public.addresses,public.orders,public.plates,public.deletion_requests to authenticated;
grant insert(user_id,full_name,whatsapp,company_name,locality,instagram_handle), update(full_name,whatsapp,company_name,locality,instagram_handle) on public.profiles to authenticated;
grant insert(user_id,cep,street,number,complement,district,city,state), update(cep,street,number,complement,district,city,state) on public.addresses to authenticated;
grant insert(id,user_id,product,quantity,company_name,locality,instagram_handle,observation), update(company_name,locality,instagram_handle,observation) on public.orders to authenticated;
grant insert(order_id,user_id,type), update(configured_url) on public.plates to authenticated;
grant insert(user_id) on public.deletion_requests to authenticated;
-- No customer privileges or policies for the notification queue.
create policy profiles_read on public.profiles for select to authenticated using ((select auth.uid())=user_id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid())=user_id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy addresses_read on public.addresses for select to authenticated using ((select auth.uid())=user_id);
create policy addresses_insert on public.addresses for insert to authenticated with check ((select auth.uid())=user_id);
create policy addresses_update on public.addresses for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy orders_read on public.orders for select to authenticated using ((select auth.uid())=user_id);
create policy orders_insert on public.orders for insert to authenticated with check ((select auth.uid())=user_id and status='aguardando_pagamento' and paid_at is null and shipped_at is null);
create policy orders_update on public.orders for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy plates_read on public.plates for select to authenticated using ((select auth.uid())=user_id);
create policy plates_insert on public.plates for insert to authenticated with check ((select auth.uid())=user_id and status='aguardando_configuracao' and configured_url is null);
create policy plates_update on public.plates for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy deletion_read on public.deletion_requests for select to authenticated using ((select auth.uid())=user_id);
create policy deletion_insert on public.deletion_requests for insert to authenticated with check ((select auth.uid())=user_id and status='pendente');

create function taplocal_private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=now(); return new; end $$;
create trigger profiles_updated before update on public.profiles for each row execute function taplocal_private.touch_updated_at();
create trigger addresses_updated before update on public.addresses for each row execute function taplocal_private.touch_updated_at();
create function taplocal_private.configure_plate() returns trigger language plpgsql set search_path='' as $$
begin
 if new.configured_url is null or new.configured_url !~ '^https://(www\.)?(google\.com|g\.page|instagram\.com)(/|\?|$)' then
  raise exception 'Invalid destination URL';
 end if;
 if (new.type='google' and new.configured_url !~ '^https://(www\.)?(google\.com|g\.page)(/|\?|$)')
 or (new.type='instagram' and new.configured_url !~ '^https://(www\.)?instagram\.com(/|\?|$)') then raise exception 'Destination does not match plate'; end if;
 new.status='configurada'; new.configured_at=now(); return new;
end $$;
create trigger plates_configuration before update of configured_url on public.plates for each row execute function taplocal_private.configure_plate();
create function taplocal_private.limit_plate_quantity() returns trigger language plpgsql set search_path='' as $$
declare capacity int; current_count int;
begin
 select (quantity->>new.type)::int into capacity from public.orders where id=new.order_id and user_id=new.user_id for update;
 select count(*) into current_count from public.plates where order_id=new.order_id and type=new.type;
 if capacity is null or current_count >= capacity then raise exception 'Plate quantity exceeded'; end if;
 return new;
end $$;
create trigger plates_quantity before insert on public.plates for each row execute function taplocal_private.limit_plate_quantity();
-- Internal trigger only: it must write a queue customers cannot write directly.
create function taplocal_private.enqueue_order_notification() returns trigger language plpgsql security definer set search_path='' as $$
declare notification_type text;
begin
 if tg_op='INSERT' then notification_type='pedido_recebido';
 elsif new.status is distinct from old.status and new.status in ('pago','enviado','entregue') then notification_type=new.status;
 end if;
 if notification_type is not null then insert into public.notifications_outbox(user_id,order_id,type) values(new.user_id,new.id,notification_type); end if;
 return new;
end $$;
create trigger orders_notification after insert or update of status on public.orders for each row execute function taplocal_private.enqueue_order_notification();
revoke all on all functions in schema taplocal_private from public,anon,authenticated;

-- Atomic transaction: a failure rolls back profile, address, order and every plate.
-- SECURITY INVOKER preserves RLS and the caller's restricted column privileges.
create function public.create_customer_order(payload jsonb) returns uuid language plpgsql security invoker set search_path='' as $$
declare uid uuid=auth.uid(); order_uuid uuid=(payload->>'id')::uuid; counts jsonb=payload->'quantity'; plate_type text; i int;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 -- Replaying an acknowledged order UUID cannot create duplicate rows or notifications.
 if exists(select 1 from public.orders where id=order_uuid and user_id=uid) then
  if not exists(select 1 from public.orders o join public.profiles p on p.user_id=o.user_id join public.addresses a on a.user_id=o.user_id
   where o.id=order_uuid and o.user_id=uid and o.product=payload->>'product' and o.quantity=counts
   and o.company_name=payload->>'company_name' and o.locality=payload->>'locality'
   and o.instagram_handle=payload->>'instagram_handle' and o.observation=payload->>'observation'
   and p.full_name=payload->>'full_name' and p.whatsapp=payload->>'whatsapp'
   and a.cep=payload->>'cep' and a.street=payload->>'street' and a.number=payload->>'number'
   and a.complement=payload->>'complement' and a.district=payload->>'district' and a.city=payload->>'city' and a.state=payload->>'state')
  then raise exception 'Existing order payload differs'; end if;
  return order_uuid;
 end if;
 insert into public.profiles(user_id,full_name,whatsapp,company_name,locality,instagram_handle)
 values(uid,payload->>'full_name',payload->>'whatsapp',payload->>'company_name',payload->>'locality',payload->>'instagram_handle')
 on conflict(user_id) do update set full_name=excluded.full_name,whatsapp=excluded.whatsapp,company_name=excluded.company_name,locality=excluded.locality,instagram_handle=excluded.instagram_handle;
 insert into public.addresses(user_id,cep,street,number,complement,district,city,state)
 values(uid,payload->>'cep',payload->>'street',payload->>'number',payload->>'complement',payload->>'district',payload->>'city',payload->>'state')
 on conflict(user_id) do update set cep=excluded.cep,street=excluded.street,number=excluded.number,complement=excluded.complement,district=excluded.district,city=excluded.city,state=excluded.state;
 insert into public.orders(id,user_id,product,quantity,company_name,locality,instagram_handle,observation)
 values(order_uuid,uid,payload->>'product',counts,payload->>'company_name',payload->>'locality',payload->>'instagram_handle',payload->>'observation');
 foreach plate_type in array array['google','instagram'] loop
  for i in 1..(counts->>plate_type)::int loop
   insert into public.plates(order_id,user_id,type) values(order_uuid,uid,plate_type);
  end loop;
 end loop;
 return order_uuid;
end $$;
revoke all on function public.create_customer_order(jsonb) from public,anon;
grant execute on function public.create_customer_order(jsonb) to authenticated;
commit;
