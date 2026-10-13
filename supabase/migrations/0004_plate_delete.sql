-- Review-only migration. Apply manually after owner approval.
grant delete on public.plates to authenticated;

create policy plates_customer_delete on public.plates for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.orders o
    where o.id = plates.order_id
      and o.status in ('aguardando_pagamento', 'cancelado')
  )
);
