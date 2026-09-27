# חיבור Clinic Revenue OS ל-Supabase

מדריך להקמת מסד נתונים אמיתי לפרויקט, לפי [DATA_MODEL.md](../DATA_MODEL.md).

## שלב 1 — יצירת פרויקט (בדפדפן שלכם)

1. היכנסו ל-https://supabase.com/dashboard/new
2. בחרו/צרו ארגון, תנו שם לפרויקט (למשל `crm4clinic`), בחרו אזור (מומלץ Europe לביצועים בישראל), והגדירו סיסמת מסד נתונים משלכם.
3. המתינו כ-1-2 דקות עד שהפרויקט עולה.

## שלב 2 — הרצת הסכמה

1. בתפריט הפרויקט: **SQL Editor** → **New query**.
2. הדביקו את כל התוכן של [schema.sql](schema.sql) והריצו (Run).
3. ודאו שאין שגיאות — נוצרות 18 טבלאות, RLS מופעל, ופונקציות עזר (`auth_clinic`, `auth_role`).

## שלב 3 — זריעת נתוני דמו (אופציונלי אך מומלץ לפיצ')

```bash
cd CRM/supabase
npm install
cp .env.example .env
# ערכו את .env: הדביקו Project URL ו-service_role key מתוך Settings → API
npm run seed
```

הסקריפט ([seed.mjs](seed.mjs)) יוצר: קליניקת דמו אחת, 5 אנשי צוות (**כמשתמשי Auth אמיתיים**), 4 מקורות ליד, 3 שירותים, 11 שלבי Pipeline, תבניות הודעה, חוקי אוטומציה, 50 לידים, 20 לקוחות ומשימות/פגישות/הצעות טיפול נגזרות — אותו סיפור שהדמו הסטטי מציג, אבל במסד נתונים אמיתי.

## שלב 4 — חיבור הדמו/האפליקציה

1. ב-Supabase: **Settings → API**, העתיקו **Project URL** ו-**anon public key** (לא את ה-service_role — הוא נשאר רק בסקריפט הזריעה, אף פעם לא בצד לקוח).
2. ב-`CRM/demo/`, העתיקו את `config.example.js` ל-`config.js` (לא ב-git) ומלאו שם את שני הערכים.
3. פתחו את הדמו — badge קטן בסרגל העליון יראה "🔌 מחובר ל-Supabase" ומספר הלידים האמיתי מה-DB.

## שלב 5 — סנכרון לידים אוטומטי משני מקורות

זה מה שמזין את פאנלי "🔌 לידים חיים" במסך הלידים בדמו (Google Maps + OpenStreetMap), כולל כפתור "משוך לידים חדשים" ותאריך "עודכן לאחרונה" לכל אחד.

1. **הרצת המיגרציות** (ב-SQL Editor, לפי הסדר):
   - [migrations/002_lead_sync.sql](migrations/002_lead_sync.sql) — טבלת `sync_logs` + מקור ליד "Google Maps".
   - [migrations/003_osm_lead_source.sql](migrations/003_osm_lead_source.sql) — מקור ליד "OpenStreetMap".
2. **פריסת שתי ה-Edge Functions** (דורש [Supabase CLI](https://supabase.com/docs/guides/cli)):
   ```bash
   supabase login
   supabase link --project-ref qprifajxctsbjnnqvgpq
   supabase secrets set APIFY_TOKEN=<הטוקן שלכם מ-Apify Console → Settings → Integrations>
   supabase functions deploy sync-apify-leads
   supabase functions deploy sync-osm-leads
   ```
   `sync-osm-leads` לא צריך שום סוד — Overpass API (OpenStreetMap) חינמי וללא מפתח. `SUPABASE_URL` ו-`SUPABASE_SERVICE_ROLE_KEY` מוזרקים אוטומטית ע"י Supabase לשתי הפונקציות.
3. **בדיקה ידנית** (אופציונלי, לפני שהדמו קורא לזה):
   ```bash
   curl -X POST https://qprifajxctsbjnnqvgpq.supabase.co/functions/v1/sync-apify-leads -H "Authorization: Bearer <anon key>"
   curl -X POST https://qprifajxctsbjnnqvgpq.supabase.co/functions/v1/sync-osm-leads -H "Authorization: Bearer <anon key>"
   ```
4. **אוטומציה יומית**: [.github/workflows/sync-leads.yml](../../.github/workflows/sync-leads.yml) קורא לשתי ה-Functions פעם ביום (06:00 UTC) דרך GitHub Actions (matrix job) — לא נדרשת פעולה נוספת, זה כבר פעיל ברגע שה-Functions פרוסות והריפו ב-GitHub. אפשר גם להריץ ידנית מטאב **Actions → Sync leads from Apify → Supabase → Run workflow**.

**איך זה עובד**: כל מקור הוא Edge Function עצמאית באותו פורמט (`POST` = סנכרון חדש + upsert בלי לדרוס לידים קיימים לפי טלפון + רישום ל-`sync_logs`; `GET` = הלידים הנוכחיים + זמן סנכרון אחרון). הקריאה מהדמו עוברת דרך ה-Function ולא ישירות לטבלה, כי למפתח ה-anon אין הרשאת RLS לקרוא מ-`leads` (ה-service_role נשאר בצד השרת בלבד).

**עלות**: Apify — מוגבל ל-5 מונחי חיפוש × 15 מקומות = כ-$0.375 לסנכרון. OpenStreetMap — **$0 תמיד**, אבל תלוי בשרתי Overpass הציבוריים (טוב לרענון יומי, לא לעומס production כבד).

## הערות אבטחה

- מפתח ה-`service_role` **סודי** — הוא עוקף RLS. נמצא רק ב-`.env` המקומי שלכם (ב-`.gitignore`) ומשמש להרצה חד-פעמית של סקריפט הזריעה, לעולם לא בקוד דפדפן.
- מפתח ה-`anon` בטוח לחשיפה בצד לקוח — כל הגנת המידע נשענת על מדיניות ה-RLS שהוגדרה ב-`schema.sql`.
- לפני חיבור משתמשים אמיתיים: יש להוסיף מסך Auth (Supabase Auth UI/SDK) במקום משתמשי הדמו שנוצרו בסקריפט.
