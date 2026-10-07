-- Clinic Revenue OS — תוספת: מקור ליד "Meta Ads" (Facebook/Instagram Lead Ads)
-- להריץ ב-Supabase SQL Editor (חד-פעמי, idempotent).

insert into lead_sources (clinic_id, name)
select c.id, 'Meta Ads'
from clinics c
where not exists (
  select 1 from lead_sources s where s.clinic_id = c.id and s.name = 'Meta Ads'
);
