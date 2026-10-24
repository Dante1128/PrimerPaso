-- Esquema base de PrimerPaso (Supabase / PostgreSQL 17).
-- Generado desde la base real; aplicar en orden: 0001 → 0002 → 0003.
-- Solo estructura y la configuración inicial de la plataforma: sin datos de usuarios.


-- ======================================================================
-- Extensiones
-- ======================================================================

create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ======================================================================
-- Tipos
-- ======================================================================

create type public.application_status as enum ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'opened');
create type public.collateral_event_type as enum ('deposit', 'release', 'liquidation', 'return', 'withdraw');
create type public.installment_status as enum ('pending', 'paid', 'late', 'waived');
create type public.invitation_status as enum ('pending', 'accepted', 'expired', 'revoked');
create type public.kyc_status as enum ('draft', 'pending', 'approved', 'rejected');
create type public.loan_purpose as enum ('tuition', 'laptop', 'course', 'materials', 'other');
create type public.loan_status as enum ('active', 'repaid', 'defaulted', 'liquidated', 'cancelled');
create type public.pool_movement_type as enum ('fund', 'withdraw', 'disburse', 'repay_principal');
create type public.revenue_type as enum ('interest', 'origination', 'late_fee', 'yield_share');
create type public.user_role as enum ('student', 'guarantor', 'operator', 'admin');

-- ======================================================================
-- Tablas
-- ======================================================================

create table public.audit_logs (
  id bigint generated always as identity not null,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  data jsonb,
  created_at timestamp with time zone default now() not null,
  constraint audit_logs_pkey PRIMARY KEY (id)
);

create table public.collateral_events (
  id uuid default gen_random_uuid() not null,
  loan_id uuid,
  position_onchain_id bigint,
  type collateral_event_type not null,
  amount numeric(20,7) not null,
  to_address text,
  tx_hash text not null,
  ledger bigint not null,
  created_at timestamp with time zone default now() not null,
  constraint collateral_events_tx_hash_type_key UNIQUE (tx_hash, type),
  constraint collateral_events_pkey PRIMARY KEY (id)
);

create table public.credit_profiles (
  profile_id uuid not null,
  borrower_address text not null,
  score integer default 300 not null,
  on_time_payments integer default 0 not null,
  late_payments integer default 0 not null,
  defaults integer default 0 not null,
  credential_id text,
  credential_issued_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  constraint credit_profiles_borrower_address_key UNIQUE (borrower_address),
  constraint credit_profiles_pkey PRIMARY KEY (profile_id),
  constraint credit_profiles_score_check CHECK (((score >= 300) AND (score <= 850)))
);

create table public.guarantor_invitations (
  id uuid default gen_random_uuid() not null,
  student_id uuid not null,
  guarantor_email text not null,
  guarantor_id uuid,
  code text default encode(gen_random_bytes(6), 'hex'::text) not null,
  status invitation_status default 'pending'::invitation_status not null,
  expires_at timestamp with time zone default (now() + '7 days'::interval) not null,
  created_at timestamp with time zone default now() not null,
  constraint guarantor_invitations_code_key UNIQUE (code),
  constraint guarantor_invitations_pkey PRIMARY KEY (id)
);

create table public.indexer_state (
  contract_id text not null,
  last_ledger bigint default 0 not null,
  updated_at timestamp with time zone default now() not null,
  constraint indexer_state_pkey PRIMARY KEY (contract_id)
);

create table public.installments (
  id uuid default gen_random_uuid() not null,
  loan_id uuid not null,
  number integer not null,
  due_at timestamp with time zone not null,
  principal_due numeric(20,7) not null,
  interest_due numeric(20,7) not null,
  paid_at timestamp with time zone,
  status installment_status default 'pending'::installment_status not null,
  constraint installments_loan_id_number_key UNIQUE (loan_id, number),
  constraint installments_pkey PRIMARY KEY (id)
);

create table public.kyc_submissions (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  status kyc_status default 'draft'::kyc_status not null,
  sep12_fields jsonb default '{}'::jsonb not null,
  document_paths text[] default '{}'::text[] not null,
  reviewed_by uuid,
  reviewed_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint kyc_submissions_pkey PRIMARY KEY (id)
);

create table public.loan_applications (
  id uuid default gen_random_uuid() not null,
  student_id uuid not null,
  guarantor_id uuid,
  purpose loan_purpose default 'tuition'::loan_purpose not null,
  purpose_detail text,
  amount_usd numeric(20,7) not null,
  collateral_amount numeric(20,7) not null,
  asset_contract_id text not null,
  rate_bps integer not null,
  installments integer not null,
  status application_status default 'draft'::application_status not null,
  reviewed_by uuid,
  rejection_reason text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint loan_applications_pkey PRIMARY KEY (id),
  constraint loan_applications_installments_check CHECK (((installments >= 1) AND (installments <= 24))),
  constraint ltv_ok CHECK ((amount_usd <= (collateral_amount * 0.9)))
);

create table public.loans (
  id uuid default gen_random_uuid() not null,
  application_id uuid,
  onchain_loan_id bigint not null,
  onchain_position_id bigint,
  loan_contract_id text not null,
  student_id uuid,
  borrower_address text not null,
  depositor_address text not null,
  asset_contract_id text not null,
  principal numeric(20,7) not null,
  origination_fee numeric(20,7) default 0 not null,
  collateral_initial numeric(20,7) not null,
  collateral_locked numeric(20,7) not null,
  collateral_released numeric(20,7) default 0 not null,
  principal_paid numeric(20,7) default 0 not null,
  interest_paid numeric(20,7) default 0 not null,
  outstanding numeric(20,7) not null,
  yield_accrued numeric(20,7) default 0 not null,
  yield_to_depositor numeric(20,7) default 0 not null,
  rate_bps integer not null,
  installments integer not null,
  status loan_status default 'active'::loan_status not null,
  opened_tx_hash text,
  opened_at timestamp with time zone,
  closed_at timestamp with time zone,
  updated_at timestamp with time zone default now() not null,
  constraint loans_application_id_key UNIQUE (application_id),
  constraint loans_loan_contract_id_onchain_loan_id_key UNIQUE (loan_contract_id, onchain_loan_id),
  constraint loans_pkey PRIMARY KEY (id)
);

create table public.notifications (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  type text not null,
  channel text default 'email'::text not null,
  payload jsonb default '{}'::jsonb not null,
  read_at timestamp with time zone,
  sent_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint notifications_pkey PRIMARY KEY (id)
);

create table public.onchain_events (
  id uuid default gen_random_uuid() not null,
  contract_id text not null,
  event_type text not null,
  ledger bigint not null,
  tx_hash text not null,
  event_index integer default 0 not null,
  payload jsonb not null,
  processed boolean default false not null,
  created_at timestamp with time zone default now() not null,
  constraint onchain_events_tx_hash_event_index_key UNIQUE (tx_hash, event_index),
  constraint onchain_events_pkey PRIMARY KEY (id)
);

create table public.payments (
  id uuid default gen_random_uuid() not null,
  loan_id uuid not null,
  installment_id uuid,
  principal numeric(20,7) not null,
  interest numeric(20,7) default 0 not null,
  on_time boolean,
  tx_hash text not null,
  ledger bigint not null,
  created_at timestamp with time zone default now() not null,
  constraint payments_tx_hash_key UNIQUE (tx_hash),
  constraint payments_pkey PRIMARY KEY (id)
);

create table public.platform_revenue (
  id uuid default gen_random_uuid() not null,
  loan_id uuid,
  payment_id uuid,
  type revenue_type not null,
  amount_usd numeric(20,7) not null,
  tx_hash text,
  created_at timestamp with time zone default now() not null,
  constraint platform_revenue_pkey PRIMARY KEY (id)
);

create table public.platform_settings (
  id boolean default true not null,
  max_ltv_bps integer default 8000 not null,
  rate_bps integer default 800 not null,
  origination_fee_bps integer default 100 not null,
  late_fee_bps integer default 200 not null,
  yield_share_platform_bps integer default 2500 not null,
  grace_seconds bigint default 2592000 not null,
  min_amount_usd numeric(20,7) default 100 not null,
  max_amount_usd numeric(20,7) default 3000 not null,
  max_installments integer default 12 not null,
  updated_at timestamp with time zone default now() not null,
  constraint platform_settings_pkey PRIMARY KEY (id),
  constraint platform_settings_id_check CHECK (id)
);

create table public.pool_movements (
  id uuid default gen_random_uuid() not null,
  type pool_movement_type not null,
  amount numeric(20,7) not null,
  loan_id uuid,
  tx_hash text,
  ledger bigint,
  note text,
  created_at timestamp with time zone default now() not null,
  constraint pool_movements_pkey PRIMARY KEY (id)
);

create table public.profiles (
  id uuid not null,
  full_name text,
  phone text,
  role user_role default 'student'::user_role not null,
  document_hash text,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  constraint profiles_pkey PRIMARY KEY (id)
);

create table public.student_profiles (
  profile_id uuid not null,
  university_name text not null,
  career text,
  student_code text,
  semester integer,
  enrollment_doc_path text,
  verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  constraint student_profiles_pkey PRIMARY KEY (profile_id)
);

create table public.wallets (
  id uuid default gen_random_uuid() not null,
  profile_id uuid not null,
  address text not null,
  sep10_verified_at timestamp with time zone,
  is_primary boolean default true not null,
  created_at timestamp with time zone default now() not null,
  constraint wallets_address_key UNIQUE (address),
  constraint wallets_pkey PRIMARY KEY (id)
);


-- ======================================================================
-- Llaves foráneas
-- ======================================================================

alter table public.audit_logs add constraint audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES profiles(id);
alter table public.collateral_events add constraint collateral_events_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id);
alter table public.credit_profiles add constraint credit_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.guarantor_invitations add constraint guarantor_invitations_guarantor_id_fkey FOREIGN KEY (guarantor_id) REFERENCES profiles(id);
alter table public.guarantor_invitations add constraint guarantor_invitations_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.installments add constraint installments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id) ON DELETE CASCADE;
alter table public.kyc_submissions add constraint kyc_submissions_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.kyc_submissions add constraint kyc_submissions_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
alter table public.loan_applications add constraint loan_applications_guarantor_id_fkey FOREIGN KEY (guarantor_id) REFERENCES profiles(id);
alter table public.loan_applications add constraint loan_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES profiles(id);
alter table public.loan_applications add constraint loan_applications_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id);
alter table public.loans add constraint loans_application_id_fkey FOREIGN KEY (application_id) REFERENCES loan_applications(id);
alter table public.loans add constraint loans_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id);
alter table public.notifications add constraint notifications_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.payments add constraint payments_installment_id_fkey FOREIGN KEY (installment_id) REFERENCES installments(id);
alter table public.payments add constraint payments_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id);
alter table public.platform_revenue add constraint platform_revenue_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id);
alter table public.platform_revenue add constraint platform_revenue_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES payments(id);
alter table public.pool_movements add constraint pool_movements_loan_id_fkey FOREIGN KEY (loan_id) REFERENCES loans(id);
alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
alter table public.student_profiles add constraint student_profiles_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;
alter table public.wallets add constraint wallets_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ======================================================================
-- Índices
-- ======================================================================

CREATE INDEX idx_collateral_loan ON public.collateral_events USING btree (loan_id);
CREATE INDEX idx_installments_due ON public.installments USING btree (status, due_at);
CREATE INDEX idx_kyc_profile ON public.kyc_submissions USING btree (profile_id);
CREATE INDEX idx_apps_status ON public.loan_applications USING btree (status);
CREATE INDEX idx_apps_student ON public.loan_applications USING btree (student_id);
CREATE INDEX idx_loans_depositor ON public.loans USING btree (depositor_address);
CREATE INDEX idx_loans_status ON public.loans USING btree (status);
CREATE INDEX idx_loans_student ON public.loans USING btree (student_id);
CREATE INDEX idx_notifications_profile ON public.notifications USING btree (profile_id, read_at);
CREATE INDEX idx_events_unprocessed ON public.onchain_events USING btree (processed, ledger);
CREATE INDEX idx_payments_loan ON public.payments USING btree (loan_id);
CREATE INDEX idx_revenue_type ON public.platform_revenue USING btree (type, created_at);
CREATE INDEX idx_pool_type ON public.pool_movements USING btree (type, created_at);
CREATE INDEX idx_wallets_profile ON public.wallets USING btree (profile_id);

-- ======================================================================
-- Funciones
-- ======================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  insert into profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.is_staff_platform()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (select 1 from profiles
                 where id = auth.uid() and role in ('admin', 'operator'));
$function$;

CREATE OR REPLACE FUNCTION public.my_role()
 RETURNS user_role
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select role from profiles where id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end $function$;


-- ======================================================================
-- Vistas
-- ======================================================================

create view public.v_platform_revenue with (security_invoker=true) as
 SELECT date_trunc('month'::text, created_at) AS month,
    type,
    sum(amount_usd) AS total_usd
   FROM platform_revenue
  GROUP BY (date_trunc('month'::text, created_at)), type;

create view public.v_pool_balance with (security_invoker=true) as
 SELECT COALESCE(sum(
        CASE
            WHEN type = ANY (ARRAY['fund'::pool_movement_type, 'repay_principal'::pool_movement_type]) THEN amount
            ELSE - amount
        END), 0::numeric) AS available_usd
   FROM pool_movements;


-- ======================================================================
-- Triggers
-- ======================================================================

CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_apps_updated BEFORE UPDATE ON public.loan_applications FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_loans_updated BEFORE UPDATE ON public.loans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ======================================================================
-- Seguridad a nivel de fila (RLS)
-- ======================================================================

alter table public.audit_logs enable row level security;
alter table public.collateral_events enable row level security;
alter table public.credit_profiles enable row level security;
alter table public.guarantor_invitations enable row level security;
alter table public.indexer_state enable row level security;
alter table public.installments enable row level security;
alter table public.kyc_submissions enable row level security;
alter table public.loan_applications enable row level security;
alter table public.loans enable row level security;
alter table public.notifications enable row level security;
alter table public.onchain_events enable row level security;
alter table public.payments enable row level security;
alter table public.platform_revenue enable row level security;
alter table public.platform_settings enable row level security;
alter table public.pool_movements enable row level security;
alter table public.profiles enable row level security;
alter table public.student_profiles enable row level security;
alter table public.wallets enable row level security;

-- ======================================================================
-- Políticas
-- ======================================================================

create policy audit_select on public.audit_logs
  for select to public
  using (is_staff_platform());

create policy collateral_select on public.collateral_events
  for select to public
  using ((EXISTS ( SELECT 1
   FROM loans l
  WHERE (l.id = collateral_events.loan_id))));

create policy credit_select on public.credit_profiles
  for select to public
  using (((profile_id = auth.uid()) OR is_staff_platform()));

create policy invitations_select on public.guarantor_invitations
  for select to public
  using (((student_id = auth.uid()) OR (guarantor_id = auth.uid()) OR is_staff_platform()));

create policy installments_select on public.installments
  for select to public
  using ((EXISTS ( SELECT 1
   FROM loans l
  WHERE (l.id = installments.loan_id))));

create policy kyc_insert_own on public.kyc_submissions
  for insert to public
  with check (((profile_id = auth.uid()) AND (status = 'draft'::kyc_status)));

create policy kyc_select on public.kyc_submissions
  for select to public
  using (((profile_id = auth.uid()) OR is_staff_platform()));

create policy apps_insert_draft on public.loan_applications
  for insert to public
  with check (((student_id = auth.uid()) AND (status = 'draft'::application_status)));

create policy apps_select on public.loan_applications
  for select to public
  using (((student_id = auth.uid()) OR (guarantor_id = auth.uid()) OR is_staff_platform()));

create policy loans_select on public.loans
  for select to public
  using (((student_id = auth.uid()) OR (depositor_address IN ( SELECT wallets.address
   FROM wallets
  WHERE (wallets.profile_id = auth.uid()))) OR is_staff_platform()));

create policy notifications_mark_read on public.notifications
  for update to public
  using ((profile_id = auth.uid()))
  with check ((profile_id = auth.uid()));

create policy notifications_select on public.notifications
  for select to public
  using ((profile_id = auth.uid()));

create policy payments_select on public.payments
  for select to public
  using ((EXISTS ( SELECT 1
   FROM loans l
  WHERE (l.id = payments.loan_id))));

create policy revenue_select on public.platform_revenue
  for select to public
  using (is_staff_platform());

create policy settings_select on public.platform_settings
  for select to public
  using (true);

create policy pool_select on public.pool_movements
  for select to public
  using (is_staff_platform());

create policy profiles_select on public.profiles
  for select to public
  using (((id = auth.uid()) OR is_staff_platform()));

create policy profiles_update_own on public.profiles
  for update to public
  using ((id = auth.uid()))
  with check (((id = auth.uid()) AND (role = my_role())));

create policy student_profiles_insert_own on public.student_profiles
  for insert to public
  with check (((profile_id = auth.uid()) AND (verified_at IS NULL)));

create policy student_profiles_select on public.student_profiles
  for select to public
  using (((profile_id = auth.uid()) OR is_staff_platform()));

create policy wallets_select on public.wallets
  for select to public
  using (((profile_id = auth.uid()) OR is_staff_platform()));


-- ======================================================================
-- Configuración inicial de la plataforma
-- ======================================================================

insert into public.platform_settings (id, max_ltv_bps, rate_bps, origination_fee_bps, late_fee_bps, yield_share_platform_bps, grace_seconds, min_amount_usd, max_amount_usd, max_installments)
values (true, 8000, 800, 100, 200, 2500, '120', '100.0000000', '3000.0000000', 12)
on conflict (id) do nothing;
