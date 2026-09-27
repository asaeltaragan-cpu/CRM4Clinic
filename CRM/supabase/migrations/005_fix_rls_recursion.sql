-- Clinic Revenue OS — תיקון: רקורסיה אינסופית ב-RLS
-- ------------------------------------------------------------
-- auth_clinic()/auth_role() שואלות את public.users, אבל ל-users יש
-- מדיניות RLS משלה שמפעילה שוב את auth_clinic() — רקורסיה, גורמת
-- ל-500 מ-PostgREST בכל שאילתה שתלויה בפונקציות האלה (כמעט הכול).
--
-- תיקון: SECURITY DEFINER הופך את הפונקציה לרוץ בהרשאות הבעלים שלה
-- (postgres, ברירת מחדל), ו-RLS לא חל על בעלי טבלה כברירת מחדל —
-- כך השאילתה הפנימית בתוך הפונקציה עוקפת את ה-RLS ולא נכנסת ללולאה.

create or replace function auth_clinic() returns uuid
language sql stable security definer set search_path = public as
  $$ select clinic_id from public.users where id = auth.uid() $$;

create or replace function auth_role() returns user_role
language sql stable security definer set search_path = public as
  $$ select role from public.users where id = auth.uid() $$;
