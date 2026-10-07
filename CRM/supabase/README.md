# חיבור Clinic Revenue OS ל-Supabase

מדריך להקמת מסד נתונים אמיתי לפרויקט, לפי [DATA_MODEL.md](../DATA_MODEL.md).

## שלב 1 — יצירת פרויקט (בדפדפן שלכם)

1. היכנסו ל-https://supabase.com/dashboard/new
2. בחרו/צרו ארגון, תנו שם לפרויקט (למשל `crm4clinic`), בחרו אזור (מומלץ Europe לביצועים בישראל), והגדירו סיסמת מסד נתונים משלכם.
3. המתינו כ-1-2 דקות עד שהפרויקט עולה.

## שלב 2 — הרצת הסכמה

1. בתפריט הפרויקט: **SQL Editor** → **New query**.
2. הדביקו את כל התוכן של [schema.sql](schema.sql) והריצו (Run).
3. **ודאו שזה באמת רץ**: אחרי הלחיצה על Run צריך להופיע "Success. No rows returned" בלי שום שגיאה אדומה, ומיד אחר כך ב-**Table Editor** (בתפריט הצד) אמורות להופיע 18 טבלאות (`clinics`, `users`, `leads` וכו'). אם Table Editor מראה "No tables or views" — הסכמה לא באמת נכנסה; הדביקו ותריצו שוב את כל התוכן של `schema.sql`. (זה הגורם הכי נפוץ לשגיאת `404 "Could not find the table ... in the schema cache"` שמופיעה על **כל** קריאה — כולל עם service_role: הטבלאות פשוט לא נוצרו, לא בעיה של הרשאות.)

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
DEMO_PASSWORD='<בחרו סיסמה חזקה משלכם>' npm run set-passwords
```

**חשוב — אל תשתמשו בברירת המחדל (`Demo1234!`) אם הדמו נגיש ציבורית (GitHub Pages):** ברירת המחדל כתובה בקוד המקור של `set-demo-passwords.mjs`, שנמצא בריפו **ה-public** — כל מי שקורא את הקוד רואה אותה. תמיד ציינו `DEMO_PASSWORD` משלכם כמשתנה סביבה (לא נשמר בשום קובץ בריפו) בכל הרצה. כתובות המייל קבועות ואנגליות (`dana.cohen@demo.crm4clinic.local` וכו') — לא נגזרות מהשם העברי, כדי להימנע מבעיות תאימות עם ולידציית אימייל. **מסך ההתחברות של הדמו לא מציג את הסיסמה** (הוסר בכוונה) — מסרו אותה בפועל למי שצריך בערוץ פרטי (וואטסאפ/מייל, לא בקוד).

לאחר ההתחברות: הדמו קורא לידים אמיתיים ישירות מ-`leads` (RLS-scoped), מציג פאנל "🗄️ לידים אמיתיים מה-DB" עם שני כפתורי הסנכרון (Google Maps / OpenStreetMap), וכל שינוי שלב בטבלה הוא כתיבה אמיתית ל-DB.

**⚠️ אם `seed.mjs` רץ לפני התיקון הזה**: יכול להיות שהמשתמשים נוצרו עם אימיילים בעברית (הפורמט הישן). אם ההתחברות נכשלת עם "user not found", בדקו ב-Authentication → Users בדשבורד איזה אימייל נוצר בפועל, או הריצו מחדש `npm run seed` (זה יוצר קליניקת דמו נוספת — לא אידמפוטנטי, זה מוכר וזמני).

**⚠️ חובה — [migrations/005_fix_rls_recursion.sql](migrations/005_fix_rls_recursion.sql):** `auth_clinic()`/`auth_role()` שואלות את `public.users`, אבל ל-`users` יש מדיניות RLS שמפעילה שוב את אותן פונקציות — רקורסיה אינסופית, שגורמת ל-`500` מ-PostgREST על כל שאילתה שתלויה בהן (כמעט כל שאילתה אחרי התחברות, כולל טעינת הפרופיל). בלי המיגרציה הזו **ההתחברות תיכשל בשקט אחרי אימות הסיסמה**. הריצו אותה פעם אחת ב-SQL Editor — היא הופכת את שתי הפונקציות ל-`security definer`, כך שהשאילתה הפנימית בתוכן עוקפת את ה-RLS (RLS לא חל על בעל הטבלה כברירת מחדל) ולא נכנסת ללולאה.

✅ **סדר ההרצה המלא, מאומת מקצה לקצה** (כפי שסופק בפועל): `schema.sql` → `002_lead_sync.sql` → `003_osm_lead_source.sql` → `004_grants.sql` → `005_fix_rls_recursion.sql` → `npm run seed` → (הרצה חוזרת של ה-INSERT-ים ב-002/003 כדי להוסיף את מקורות "Google Maps"/"OpenStreetMap" לקליניקה שרק נוצרה) → `npm run set-passwords`.

## הערות אבטחה

- מפתח ה-`service_role` **סודי** — הוא עוקף RLS. נמצא רק ב-`.env` המקומי שלכם (ב-`.gitignore`) ומשמש להרצה חד-פעמית של סקריפטי הזריעה/סיסמאות, לעולם לא בקוד דפדפן.
- מפתח ה-`anon` בטוח לחשיפה בצד לקוח — כל הגנת המידע נשענת על מדיניות ה-RLS שהוגדרה ב-`schema.sql`, ועכשיו גם על התחברות אמיתית (שלב 6).
- **`404 "Could not find the table ... in the schema cache"` על כל טבלה**: כמעט תמיד `schema.sql` לא באמת רץ (בדקו ב-Table Editor שהטבלאות קיימות) — ראו שלב 2. פחות סביר: הרשאות חסרות ([004_grants.sql](migrations/004_grants.sql)) או פרויקט בטיר החינמי שנכנס למצב "מושהה" אחרי חוסר פעילות.
- **`500` בכל שאילתה אחרי התחברות מוצלחת**: רקורסיה ב-RLS — הריצו [005_fix_rls_recursion.sql](migrations/005_fix_rls_recursion.sql) (שלב 6).

## שלב 7 — לידים מפרסום ב-Meta (Facebook/Instagram Lead Ads) → Supabase + Google Sheets

ליד חדש בטופס Lead Ads → Webhook → נשמר ב-`leads` (מקור "Meta Ads", ללא כפילויות לפי טלפון) **וגם** נוסף כשורה ב-Google Sheet. כל הלידים מוצגים בפאנל "🗄️ לידים אמיתיים מה-DB" (פילטר מקור: Meta Ads, עמודת קמפיין).

1. **Google Sheet**: צרו גיליון חדש → Extensions → Apps Script → הדביקו את [google-sheets/Code.gs](google-sheets/Code.gs), שנו את `SHARED_SECRET` למחרוזת סודית → Deploy → New deployment → Web app (Execute as: **Me**, Who has access: **Anyone**) → העתיקו את כתובת ה-Web app.
2. **מיגרציה**: הריצו [migrations/006_meta_lead_source.sql](migrations/006_meta_lead_source.sql) ב-SQL Editor.
3. **אפליקציית Meta**: ב-https://developers.facebook.com צרו App (Business) → הוסיפו מוצר **Webhooks** → Object: **Page** → Callback URL: `https://qprifajxctsbjnnqvgpq.supabase.co/functions/v1/meta-lead-webhook`, Verify token: מחרוזת שתבחרו → הירשמו לשדה **leadgen**. הרשאות נדרשות: `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`. צרו **Page access token** לטווח ארוך, והירשמו את האפליקציה לדף (Subscribe app to page, `subscribed_apps` עם `leadgen`).
4. **פריסה וסודות**:
   ```bash
   supabase secrets set META_VERIFY_TOKEN=... META_APP_SECRET=... META_PAGE_TOKEN=... \
     GOOGLE_SHEET_WEBHOOK_URL=... GOOGLE_SHEET_SECRET=...
   supabase functions deploy meta-lead-webhook --no-verify-jwt
   ```
   `--no-verify-jwt` נדרש כי Meta לא שולחת JWT; הפונקציה מאמתת כל בקשה בחתימת HMAC (`X-Hub-Signature-256`) עם ה-App Secret.
5. **בדיקה**: https://developers.facebook.com/tools/lead-ads-testing → שלחו ליד בדיקה → ודאו שורה חדשה בגיליון (טאב "Meta Leads") וליד בדמו. שגיאות — Supabase → Edge Functions → meta-lead-webhook → Logs.
