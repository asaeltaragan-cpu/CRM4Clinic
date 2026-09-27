-- Clinic Revenue OS — סכמת Supabase (PostgreSQL)
-- להריץ ב-Supabase SQL Editor על פרויקט חדש, בסדר הזה (חלק אחד בכל פעם אם יש שגיאה).
-- מבוסס על CRM/DATA_MODEL.md — ראה שם ERD ותיעוד מלא.

-- ===================== Extensions =====================
create extension if not exists pgcrypto;

-- ===================== Enums =====================
create type user_role        as enum ('owner','manager','sales','therapist');
create type stage_type       as enum ('open','won','lost');
create type response_status  as enum ('none','contacted','no_answer','replied');
create type appt_type        as enum ('consultation','treatment','check','followup');
create type appt_status      as enum ('scheduled','confirmed','cancelled','no_show','completed');
create type proposal_status  as enum ('draft','sent','accepted','declined','expired');
create type payment_type     as enum ('deposit','full');
create type payment_state    as enum ('pending','partial','paid','refunded');
create type task_status      as enum ('open','done','snoozed','irrelevant');
create type interaction_type as enum ('call','whatsapp','note','stage_change','appointment','proposal','system','form');
create type consent_channel  as enum ('whatsapp','sms','email','phone');
create type consent_kind     as enum ('service','marketing');
create type loyalty_tier     as enum ('new','active','vip');

-- ===================== Core =====================
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  timezone text not null default 'Asia/Jerusalem',
  working_hours jsonb not null default '{}',
  settings jsonb not null default '{}',
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null,
  active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  campaign text,
  active boolean default true
);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  position int not null,
  type stage_type not null default 'open',
  sla_hours numeric,
  unique (clinic_id, position)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  default_price numeric(10,2),
  default_sessions int default 1,
  maintenance_days int,
  active boolean default true
);

-- ===================== People =====================
create table leads (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text,
  source_id uuid references lead_sources(id),
  campaign text,
  service_id uuid references services(id),
  stage_id uuid not null references pipeline_stages(id),
  owner_user_id uuid references users(id),
  expected_value numeric(10,2) default 0,
  response_status response_status not null default 'none',
  next_action text,
  next_action_at timestamptz,
  lost_reason text,
  first_response_at timestamptz,
  notes text,
  customer_id uuid,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (clinic_id, phone)
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid references leads(id),
  full_name text not null,
  phone text not null,
  email text,
  birthday date,
  status text not null default 'active',
  last_visit_at timestamptz,
  next_recommended_at timestamptz,
  churn_risk boolean not null default false,
  anonymized_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (clinic_id, phone)
);
alter table leads add constraint leads_customer_fk foreign key (customer_id) references customers(id);

-- ===================== Sales objects =====================
create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid references leads(id),
  customer_id uuid references customers(id),
  therapist_user_id uuid references users(id),
  type appt_type not null,
  status appt_status not null default 'scheduled',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  notes text,
  check (lead_id is not null or customer_id is not null)
);

create table treatment_proposals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid references leads(id),
  customer_id uuid references customers(id),
  service_id uuid references services(id),
  description text,
  sessions int not null default 1,
  price numeric(10,2) not null,
  valid_until date,
  status proposal_status not null default 'draft',
  sent_at timestamptz,
  decided_at timestamptz,
  decline_reason text
);

create table treatment_packages (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  customer_id uuid not null references customers(id),
  proposal_id uuid references treatment_proposals(id),
  service_id uuid references services(id),
  total_sessions int not null,
  used_sessions int not null default 0,
  price numeric(10,2) not null,
  last_session_at timestamptz,
  created_at timestamptz default now(),
  check (used_sessions <= total_sessions)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  package_id uuid references treatment_packages(id),
  proposal_id uuid references treatment_proposals(id),
  amount numeric(10,2) not null,
  type payment_type not null,
  state payment_state not null default 'pending',
  paid_at timestamptz
);

-- ===================== Work & comms =====================
create table message_templates (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  name text not null,
  trigger_key text,
  body text not null,
  channel text not null default 'whatsapp',
  is_marketing boolean not null default false,
  active boolean default true
);

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  key text not null,
  enabled boolean not null default true,
  params jsonb not null default '{}',
  unique (clinic_id, key)
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid references leads(id),
  customer_id uuid references customers(id),
  assignee_user_id uuid references users(id),
  type text not null,
  reason text,
  due_at timestamptz not null,
  status task_status not null default 'open',
  outcome text,
  template_id uuid references message_templates(id),
  rule_id uuid references automation_rules(id),
  snoozed_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table interactions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid references leads(id),
  customer_id uuid references customers(id),
  user_id uuid references users(id),
  type interaction_type not null,
  content text,
  ai_generated boolean not null default false,
  meta jsonb default '{}',
  occurred_at timestamptz not null default now()
);

-- ===================== Loyalty & consent =====================
create table loyalty_profiles (
  customer_id uuid primary key references customers(id) on delete cascade,
  clinic_id uuid not null references clinics(id) on delete cascade,
  is_member boolean not null default false,
  joined_at date,
  tier loyalty_tier not null default 'new',
  points int not null default 0,
  benefit_available text,
  last_benefit_at timestamptz
);

create table consents (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics(id) on delete cascade,
  lead_id uuid references leads(id),
  customer_id uuid references customers(id),
  channel consent_channel not null,
  kind consent_kind not null,
  granted boolean not null,
  source text,
  granted_at timestamptz,
  revoked_at timestamptz,
  do_not_contact boolean not null default false
);

create table audit_logs (
  id bigint generated always as identity primary key,
  clinic_id uuid not null,
  user_id uuid,
  entity text not null,
  entity_id uuid,
  action text not null,
  before jsonb, after jsonb,
  screen text,
  at timestamptz default now()
);

-- ===================== Indexes =====================
create index on leads (clinic_id, stage_id);
create index on leads (clinic_id, owner_user_id, next_action_at);
create index on leads (clinic_id, response_status, created_at);
create index on tasks (clinic_id, assignee_user_id, status, due_at);
create index on appointments (clinic_id, starts_at);
create index on appointments (therapist_user_id, starts_at);
create index on interactions (lead_id, occurred_at desc);
create index on interactions (customer_id, occurred_at desc);
create index on customers (clinic_id, last_visit_at);

-- ===================== Helper functions (RLS) =====================
create or replace function auth_clinic() returns uuid language sql stable as
  $$ select clinic_id from public.users where id = auth.uid() $$;
create or replace function auth_role() returns user_role language sql stable as
  $$ select role from public.users where id = auth.uid() $$;

-- ===================== RLS =====================
alter table clinics enable row level security;
alter table users enable row level security;
alter table lead_sources enable row level security;
alter table pipeline_stages enable row level security;
alter table services enable row level security;
alter table leads enable row level security;
alter table customers enable row level security;
alter table appointments enable row level security;
alter table treatment_proposals enable row level security;
alter table treatment_packages enable row level security;
alter table payments enable row level security;
alter table message_templates enable row level security;
alter table automation_rules enable row level security;
alter table tasks enable row level security;
alter table interactions enable row level security;
alter table loyalty_profiles enable row level security;
alter table consents enable row level security;
alter table audit_logs enable row level security;

-- דפוס בידוד בסיסי לכל טבלה עם clinic_id (חוזר לכל טבלה למעלה)
create policy clinics_tenant on clinics for select using (id = auth_clinic());
create policy users_tenant on users for select using (clinic_id = auth_clinic());
create policy sources_tenant on lead_sources for all using (clinic_id = auth_clinic());
create policy stages_tenant on pipeline_stages for all using (clinic_id = auth_clinic());
create policy services_tenant on services for all using (clinic_id = auth_clinic());
create policy leads_tenant on leads for all using (clinic_id = auth_clinic());
create policy customers_tenant on customers for all using (clinic_id = auth_clinic());
create policy appts_tenant on appointments for all using (clinic_id = auth_clinic());
create policy proposals_tenant on treatment_proposals for all using (clinic_id = auth_clinic());
create policy packages_tenant on treatment_packages for all using (clinic_id = auth_clinic());
create policy payments_tenant on payments for all using (clinic_id = auth_clinic());
create policy templates_tenant on message_templates for all using (clinic_id = auth_clinic());
create policy rules_tenant on automation_rules for all using (clinic_id = auth_clinic());
create policy tasks_tenant on tasks for all using (clinic_id = auth_clinic());
create policy interactions_tenant on interactions for all using (clinic_id = auth_clinic());
create policy loyalty_tenant on loyalty_profiles for all using (clinic_id = auth_clinic());
create policy consents_tenant on consents for all using (clinic_id = auth_clinic());
create policy audit_tenant on audit_logs for select using (clinic_id = auth_clinic());

-- הגבלות נוספות לפי תפקיד (ראו CRM/DATA_MODEL.md סעיף 3 להרחבה)
create policy leads_sales_scope on leads as restrictive for select
  using (auth_role() <> 'sales' or owner_user_id = auth.uid() or owner_user_id is null);
create policy leads_no_therapist on leads as restrictive for all
  using (auth_role() <> 'therapist');
create policy appt_therapist_scope on appointments as restrictive for select
  using (auth_role() <> 'therapist' or therapist_user_id = auth.uid());
create policy payments_finance_only on payments as restrictive for select
  using (auth_role() in ('owner','manager'));

-- ===================== Seed: שלבי Pipeline לדוגמה =====================
-- הרצה חד-פעמית לאחר יצירת קליניקה ראשונה. יש להחליף :clinic_id בזיהוי האמיתי.
-- insert into pipeline_stages (clinic_id, name, position, type, sla_hours) values
--   (:clinic_id, 'ליד חדש', 1, 'open', 0.25),
--   (:clinic_id, 'ממתין למענה', 2, 'open', 24),
--   (:clinic_id, 'נוצר קשר', 3, 'open', 48),
--   (:clinic_id, 'נקבע ייעוץ', 4, 'open', null),
--   (:clinic_id, 'הגיע לייעוץ', 5, 'open', 24),
--   (:clinic_id, 'נשלחה הצעת טיפול', 6, 'open', 72),
--   (:clinic_id, 'ממתין להחלטה', 7, 'open', 168),
--   (:clinic_id, 'נסגר לטיפול', 8, 'won', null),
--   (:clinic_id, 'בטיפול / סדרת טיפולים', 9, 'won', null),
--   (:clinic_id, 'לקוח לשימור / טיפול חוזר', 10, 'won', null),
--   (:clinic_id, 'אבוד / לא רלוונטי', 11, 'lost', null);
