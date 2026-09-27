-- Clinic Revenue OS — תוספת: מקור ליד "OpenStreetMap"
-- להריץ ב-Supabase SQL Editor אחרי 002_lead_sync.sql (חד-פעמי).

insert into lead_sources (clinic_id, name)
select c.id, 'OpenStreetMap'
from clinics c
where not exists (
  select 1 from lead_sources s where s.clinic_id = c.id and s.name = 'OpenStreetMap'
);
