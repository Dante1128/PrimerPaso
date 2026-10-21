-- Indexador idempotente: un mismo evento on-chain no puede proyectarse dos veces
-- y solo una instancia del indexador corre a la vez.

-- 1. Unicidad de los eventos crudos y de sus proyecciones.
create unique index if not exists onchain_events_evento_unico
  on public.onchain_events (contract_id, tx_hash, event_index);

-- Eventos guardados pero aún sin proyectar (se reintentan).
create index if not exists onchain_events_pendientes
  on public.onchain_events (ledger, event_index)
  where processed = false;

create unique index if not exists loans_onchain_unico
  on public.loans (loan_contract_id, onchain_loan_id);

create unique index if not exists installments_cuota_unica
  on public.installments (loan_id, number);

-- Un pago por transacción (repay emite un solo payment_recorded).
create unique index if not exists payments_tx_unico
  on public.payments (tx_hash);

-- Una fila por tipo y transacción. Los movimientos sin tx_hash (ej. el
-- fondeo inicial) no chocan: en Postgres los NULL no se consideran iguales.
create unique index if not exists collateral_events_tx_tipo_unico
  on public.collateral_events (tx_hash, type);

create unique index if not exists pool_movements_tx_tipo_unico
  on public.pool_movements (tx_hash, type);

create unique index if not exists platform_revenue_tx_tipo_unico
  on public.platform_revenue (tx_hash, type);

-- 2. Candado del indexador (lease con vencimiento, apto para serverless).
create table if not exists public.indexer_lock (
  id boolean primary key default true check (id),
  holder text,
  locked_until timestamptz
);

insert into public.indexer_lock (id) values (true) on conflict (id) do nothing;

alter table public.indexer_lock enable row level security;

-- Toma (o renueva) el candado si está libre, vencido o ya es del mismo dueño.
create or replace function public.indexer_acquire_lock(p_holder text, p_seconds int default 120)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.indexer_lock
     set holder = p_holder,
         locked_until = now() + make_interval(secs => p_seconds)
   where id = true
     and (locked_until is null or locked_until < now() or holder = p_holder);
  return found;
end;
$$;

create or replace function public.indexer_release_lock(p_holder text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.indexer_lock
     set holder = null, locked_until = null
   where id = true and holder = p_holder;
$$;

-- Solo el servidor (service_role) puede usar el candado.
revoke all on function public.indexer_acquire_lock(text, int) from public, anon, authenticated;
revoke all on function public.indexer_release_lock(text) from public, anon, authenticated;
grant execute on function public.indexer_acquire_lock(text, int) to service_role;
grant execute on function public.indexer_release_lock(text) to service_role;
