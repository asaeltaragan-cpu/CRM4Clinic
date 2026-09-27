-- Clinic Revenue OS — תיקון: הרשאות PostgREST חסרות
-- ------------------------------------------------------------
-- אבחון: מאז ה-schema.sql הראשוני, כל שאילתת REST על כל טבלה (גם עם
-- service_role) מחזירה 404 "Could not find the table ... in the schema
-- cache" — לא שגיאת RLS (401/403), אלא שגיאה שמשמעה ש-PostgREST בכלל
-- לא רואה את הטבלה עבור התפקיד המבקש.
--
-- הסיבה הסבירה ביותר: טבלאות שנוצרות ב-SQL Editor (בניגוד ל-Table
-- Editor הגרפי) לא מקבלות אוטומטית את הרשאות ה-GRANT הרגילות ל-
-- anon/authenticated/service_role שסופאבייס בדרך כלל מגדיר לבד. GRANT
-- (הרשאת גישה לטבלה ברמת Postgres) ו-RLS (מי רואה אילו שורות) הם שני
-- דברים נפרדים — גם עם RLS מוגדר נכון, בלי GRANT הטבלה "לא קיימת" מבחינת
-- PostgREST.
--
-- להריץ ב-SQL Editor פעם אחת (אחרי migrations 002-003).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines in schema public to anon, authenticated, service_role;

-- כדי שגם טבלאות עתידיות (מיגרציות הבאות) יקבלו את זה אוטומטית
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- אחרי הרצה, כדאי גם: Settings → API → "Reload schema cache" בדשבורד
-- (לפעמים PostgREST צריך רענון מפורש כדי לקלוט את ההרשאות החדשות).
