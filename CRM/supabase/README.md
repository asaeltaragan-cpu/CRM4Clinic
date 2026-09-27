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
4. **חשוב — הריצו מיד אחרי זה גם את [migrations/004_grants.sql](migrations/004_grants.sql).** טבלאות שנוצרות ב-SQL Editor (בניגוד ל-Table Editor הגרפי) לא מקבלות אוטומטית את הרשאות ה-GRANT הבסיסיות ל-`anon`/`authenticated`/`service_role` שסופאבייס בדרך כלל מגדיר לבד. בלי זה, **כל** קריאת REST לכל טבלה — כולל עם `service_role` — נכשלת עם `404 "Could not find the table ... in the schema cache"`, גם אם ה-RLS מוגדר נכון (GRANT ו-RLS הם שני דברים נפרדים ב-Postgres). זה הגורם השכיח ביותר לשגיאה הזו, שכיח בהרבה מ"הפרויקט נרדם".

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
3. פתחו את הדמו — badge קטן בסרגל העליון יראה שהחיבור פעיל (ומספר הלידים הגלויים, אם RLS מאפשר לפני התחברות).

## שלב 5 — סנכרון לידים אוטומטי משני מקורות

זה מזין את פאנל "🗄️ לידים אמיתיים מה-DB" במסך הלידים בדמו (מוצג רק אחרי התחברות — ראו שלב 6), עם שני כפתורי סנכרון (Google Maps / OpenStreetMap) ותצוגת "עודכן לאחרונה" לכל מקור.

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

**איך זה עובד**: כל מקור הוא Edge Function עצמאית שכותבת בלבד (`POST` = סנכרון חדש + upsert בלי לדרוס לידים קיימים לפי טלפון + רישום ל-`sync_logs`). **קריאה** (הצגת הלידים בדמו) כבר לא עוברת דרך ה-Functions — מאז שלב 6 (ניהול משתמשים), משתמש מחובר קורא ישירות מ-`leads` עם ה-session שלו, ו-RLS דואג לבידוד. זה גם נכון וגם פשוט יותר מהגישה הקודמת (Function עם service_role שעוקפת RLS גם לקריאה).

**עלות**: Apify — מוגבל ל-5 מונחי חיפוש × 15 מקומות = כ-$0.375 לסנכרון. OpenStreetMap — **$0 תמיד**, אבל תלוי בשרתי Overpass הציבוריים (טוב לרענון יומי, לא לעומס production כבד).

## שלב 6 — ניהול משתמשים (Supabase Auth) וכניסה לדמו

הדמו כולל עכשיו מסך התחברות אמיתי. `seed.mjs` כבר יוצר 5 משתמשי Auth (בעלת קליניקה, מנהלת, 2 מזכירות/נציגות, מטפלת), אבל עם סיסמה אקראית שלא נשמרת בשום מקום — צריך לקבוע סיסמה ידועה כדי שאפשר יהיה להתחבר בפועל:

```bash
cd CRM/supabase
npm run set-passwords
```

זה קובע את הסיסמה `Demo1234!` לכל חמשת המשתמשים (ניתן לשנות עם משתנה סביבה `DEMO_PASSWORD`). כתובות המייל קבועות ואנגליות (`dana.cohen@demo.crm4clinic.local` וכו') — לא נגזרות מהשם העברי, כדי להימנע מבעיות תאימות עם ולידציית אימייל. פרטי ההתחברות מוצגים גם במסך ההתחברות של הדמו עצמו (חשבונות דמו סינתטיים, לא מידע רגיש).

לאחר ההתחברות: הדמו קורא לידים אמיתיים ישירות מ-`leads` (RLS-scoped), מציג פאנל "🗄️ לידים אמיתיים מה-DB" עם שני כפתורי הסנכרון (Google Maps / OpenStreetMap), וכל שינוי שלב בטבלה הוא כתיבה אמיתית ל-DB.

**⚠️ אם `seed.mjs` רץ לפני התיקון הזה**: יכול להיות שהמשתמשים נוצרו עם אימיילים בעברית (הפורמט הישן). אם ההתחברות נכשלת עם "user not found", בדקו ב-Authentication → Users בדשבורד איזה אימייל נוצר בפועל, או הריצו מחדש `npm run seed` (זה יוצר קליניקת דמו נוספת — לא אידמפוטנטי, זה מוכר וזמני).

## הערות אבטחה

- מפתח ה-`service_role` **סודי** — הוא עוקף RLS. נמצא רק ב-`.env` המקומי שלכם (ב-`.gitignore`) ומשמש להרצה חד-פעמית של סקריפטי הזריעה/סיסמאות, לעולם לא בקוד דפדפן.
- מפתח ה-`anon` בטוח לחשיפה בצד לקוח — כל הגנת המידע נשענת על מדיניות ה-RLS שהוגדרה ב-`schema.sql`, ועכשיו גם על התחברות אמיתית (שלב 6).
- **אם מקבלים `404 "Could not find the table ... in the schema cache"` על כל טבלה, כולל עם service_role**: כמעט תמיד חסרות ההרשאות מ-[migrations/004_grants.sql](migrations/004_grants.sql) (ראו שלב 2.4) — הריצו אותו קודם. אם זה כבר רץ ועדיין רואים את השגיאה, נסו **Settings → API → Reload schema cache** בדשבורד; ורק אם שום דבר לא עוזר, יכול להיות שפרויקט בטיר החינמי שלא היה פעיל כשבוע נכנס למצב "מושהה" ולוקח זמן להתעורר.
