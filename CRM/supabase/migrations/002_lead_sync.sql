-- Clinic Revenue OS — תוספת סכמה: סנכרון לידים מ-Apify
-- להריץ ב-Supabase SQL Editor אחרי schema.sql (חד-פעמי).

-- טבלת יומן סנכרון — נראית למשתמש ("מתי בוצע הסינכרון")
create table if not exists sync_logs (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references clinics(id) on delete cascade,
  source text not null default 'apify_google_maps',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running',  -- running | success | error
  leads_upserted int default 0,
  leads_skipped int default 0,
  message text
);

alter table sync_logs enable row level security;
create policy sync_logs_tenant on sync_logs for select using (clinic_id = auth_clinic());

create index if not exists sync_logs_clinic_started_idx on sync_logs (clinic_id, started_at desc);

-- ודא שקיים מקור ליד "Google Maps" לכל קליניקה (idempotent)
insert into lead_sources (clinic_id, name)
select c.id, 'Google Maps'
from clinics c
where not exists (
  select 1 from lead_sources s where s.clinic_id = c.id and s.name = 'Google Maps'
);
