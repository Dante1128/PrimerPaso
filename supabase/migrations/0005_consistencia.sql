-- Checkpoints y transacciones preparados: solo el backend puede escribirlos.
begin;
alter table public.indexer_state add column last_cursor text;

create table public.prepared_transactions (
  tx_hash text primary key,
  profile_id uuid not null references public.profiles(id),
  entity_id text not null,
  method text not null check (method in ('deposit_collateral', 'open_loan', 'repay')),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  result jsonb,
  created_at timestamptz not null default now()
);
alter table public.prepared_transactions enable row level security;
revoke all on public.prepared_transactions from anon, authenticated;
grant all on public.prepared_transactions to service_role;
create index prepared_transactions_entity on public.prepared_transactions(entity_id, method);

-- Evita la carrera entre dos solicitudes HTTP del mismo estudiante.
-- Si esta validación falla, revisar los duplicados antes de aplicar la migración.
do $$ begin
  if exists (
    select student_id from public.loan_applications
    where status in ('draft', 'submitted', 'approved')
    group by student_id having count(*) > 1
  ) then
    raise exception 'Hay solicitudes simultáneas: resolver duplicados antes de migrar';
  end if;
end $$;
create unique index applications_una_en_curso on public.loan_applications(student_id)
  where status in ('draft', 'submitted', 'approved');

-- Hasta 60 cuotas, igual que la validación de parámetros de la API.
alter table public.loan_applications drop constraint loan_applications_installments_check;
alter table public.loan_applications add constraint loan_applications_installments_check
  check (installments between 1 and 60);
commit;
