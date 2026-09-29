# Practice — הוראות עבודה לפעולות חוזרות בפרויקט

מסמך זה מרכז נהלים שחוזרים על עצמם בעבודה על CRM4Clinic — לא אפיון מוצר (זה ב-`CRM/PRODUCT_SPEC.md`) אלא **איך עובדים על הפרויקט עצמו**.

---

## 1. Git — Push/Commit על כל פעולה

**כלל קבוע: כל שינוי בפרויקט (קובץ חדש, עריכה, מחיקה) מסתיים ב-commit + push לריפו `CRM4Clinic` ב-GitHub, גם אם השינוי קטן.**

- לא מצטברים כמה שינויים "לקומיט גדול בסוף" — כל יחידת עבודה הגיונית (מסמך שנוצר, פיצ'ר שנבנה, תיקון) מקבלת commit משלה מיד כשהיא מוכנה.
- הודעת commit: שורה ראשונה קצרה בציווי ("Add...", "Fix...", "Update...") + גוף שמסביר מה ולמה, בסגנון ה-commits הקיימים בהיסטוריה.
- **לפני כל commit**: `git status --short` ו-`git add` **מפורש** של הקבצים הרלוונטיים בלבד — לא `git add -A` / `git add .` בלי בדיקה, כדי לא לגרור בטעות קבצים שלא שייכים לריפו.
- **קבצים שלעולם לא נכנסים ל-git** (ראו `.gitignore` ב-root וב-`CRM/supabase/`):
  - `CRM/supabase/.env` — מכיל `SUPABASE_SERVICE_ROLE_KEY` (סוד מלא, עוקף RLS).
  - `CRM/demo/config.js` — מכיל Project URL + anon key (פחות רגיש, אבל אישי לפרויקט Supabase של המשתמש).
  - `node_modules/`.
- **קבצים שיודעים שהם קיימים בתיקייה אך במכוון לא נכנסים לריפו** (הוחלט מפורשות בשיחה): `CRM/ProjectSpec.txt`, `CRM/Business radar-v1.zip`, `TrashTraining/` (ריפו git נפרד ולא קשור), `rtl-for-vs-code-agents-*.vsix`.
- **לפני push**: לוודא שלא נכנס סוד בטעות (חיפוש מהיר אחרי `service_role`, `SERVICE_ROLE_KEY`, סיסמאות) — קרה כבר פעם אחת בפרויקט הזה (מפתח service_role הודבק בטעות ל-`.env.example` במקום ל-`.env`) ותוקן לפני ה-push. ראו את זה כתזכורת קבועה, לא חד-פעמית.

---

## 2. טיפול בלידים משני המקורות החיצוניים

לפרויקט יש **שני מקורות לידים אמיתיים וחיצוניים**, שניהם עובדים באותה תבנית בדיוק. זה התהליך המלא — מאיפה ליד מגיע ועד איפה הוא נשמר.

### 2.1 מאיפה לידים מגיעים

| מקור | טכנולוגיה | עלות | Edge Function |
|---|---|---|---|
| **Google Maps** | Apify Actor `compass/google-maps-extractor` — חיפוש 5 מונחים בעברית ("קליניקת יופי", "מכון קוסמטיקה", "רפואה אסתטית", "מרפאת עור ולייזר", "מכון להסרת שיער בלייזר") ב-`locationQuery: "ישראל"` | ~$0.375 לסנכרון (pay-per-event, מוגבל ל-15 מקומות למונח) | `CRM/supabase/functions/sync-apify-leads` |
| **OpenStreetMap** | Overpass API — שאילתת OSM לתגיות `shop=beauty`, `healthcare=dermatologist`, `healthcare=plastic_surgeon`, `amenity=spa`, `leisure=spa` באזור ישראל | **$0 — חינמי לגמרי, ללא מפתח API** | `CRM/supabase/functions/sync-osm-leads` |

שני המקורות מספקים **מידע עסקי ציבורי בלבד** (שם עסק, טלפון, קטגוריה, כתובת) — לא מידע אישי של מטופלים.

### 2.2 איך הם מאוחסנים ונשמרים

```
Apify / Overpass  →  Edge Function (Deno, Supabase, POST בלבד)  →  טבלת leads  →  מסך הלידים בדמו (משתמש מחובר)
                              │
                              └──→  טבלת sync_logs (רישום כל הרצה)
```

1. **ה-Edge Function** (`sync-apify-leads` או `sync-osm-leads`) שולפת את הנתונים הגולמיים מהמקור, מנרמלת טלפון לפורמט E.164 (`+972...`), ומרכיבה שורת ליד: `full_name`, `phone`, `source_id` (מצביע ל-`lead_sources` — "Google Maps" או "OpenStreetMap"), `stage_id` (תמיד השלב הראשון, "ליד חדש"), `notes` (קטגוריה + כתובת).
2. **מניעת כפילויות**: לפני הכנסה, ה-Function בודקת אילו טלפונים כבר קיימים בטבלת `leads` עבור הקליניקה (`unique (clinic_id, phone)` בסכמה), ומכניסה **רק לידים חדשים** — לידים קיימים לעולם לא נדרסים, גם אם השלב שלהם השתנה בינתיים ע"י נציגה.
3. **טבלת `sync_logs`** מקבלת שורה בכל הרצה: `source` (`apify_google_maps` / `osm_overpass`), `started_at`, `finished_at`, `status` (`running`/`success`/`error`), `leads_upserted`, `leads_skipped`, `message`. זה מה שמאפשר תצוגת "עודכן לאחרונה" בדמו.
4. **הצגה במסך הלידים**: הפונקציות עצמן **לא** חושפות קריאה יותר (הוסר ה-`GET` שהיה בהן קודם, לפני שהתווסף ניהול משתמשים) — משתמש מחובר בדמו קורא **ישירות** מטבלת `leads` עם ה-session שלו, ו-RLS דואג לבידוד הנכון לפי קליניקה ותפקיד. זה גם מדויק יותר (RLS אמיתי, לא bypass דרך service_role) וגם פשוט יותר. ראו סעיף 3 (ניהול משתמשים) להרחבה.

### 2.3 מתי הסנכרון רץ

- **יזום ע"י המשתמש המחובר**: כפתורי **"🔄 Google Maps"** / **"🔄 OpenStreetMap"** בפאנל "🗄️ לידים אמיתיים מה-DB" במסך הלידים (מוצג רק אחרי התחברות) — קוראים `POST` ל-Edge Function המתאימה, ואז מרעננים את הטבלה בקריאה ישירה.
- **אוטומטי, פעם ביום**: `.github/workflows/sync-leads.yml` — GitHub Action עם `cron: '0 6 * * *'` (06:00 UTC), שקורא ל-**שני** ה-Functions (matrix job) עם ה-anon key (לא תלוי במשתמש מחובר — זו קריאת שרת-לשרת). אפשר גם להריץ ידנית מטאב Actions → Run workflow.

### 2.4 הוספת מקור לידים נוסף (אם יתבקש בעתיד)

לפי אותה תבנית בדיוק (ראו את שני ה-Functions הקיימים כדוגמה):
1. Edge Function חדשה תחת `CRM/supabase/functions/sync-<name>-leads/`, `POST` בלבד (סנכרון + upsert + `sync_logs`; אין צורך ב-`GET` — הקריאה כבר עוברת ישירות מהטבלה, ראו 2.2).
2. מיגרציה חדשה ב-`CRM/supabase/migrations/00N_<name>_lead_source.sql` שמוודאת קיום שורת `lead_sources` בשם המקור.
3. הוספת כפתור נוסף ב-`db-leads-panel` (`index.html`) וקריאה מתאימה ל-`runDbSync(...)` ב-`CRM/demo/app.js`.
4. הוספת שם ה-Function למטריצה ב-`.github/workflows/sync-leads.yml`.
5. תיעוד ב-`CRM/supabase/README.md` (שלב 5) ובטבלה בסעיף 2.1 כאן.

---

## 3. ניהול משתמשים (Supabase Auth)

הדמו כולל מסך התחברות אמיתי (`CRM/demo/auth.js`), פעיל רק כש-`config.js` מוגדר.

- **5 חשבונות דמו** נוצרים ב-`seed.mjs` (בעלת קליניקה, מנהלת, 2 מזכירות/נציגות, מטפלת) כמשתמשי Supabase Auth אמיתיים, עם אימייל ASCII קבוע (`dana.cohen@demo.crm4clinic.local` וכו' — **לא** נגזר מהשם העברי, כדי להימנע מבעיות תאימות אימייל). האימיילים עצמם כן גלויים בקוד המקור הציבורי (`seed.mjs`) — זה בסדר, הם לא סודיים.
- **סיסמה — לעולם לא ברירת המחדל בפרסום ציבורי**: `seed.mjs` יוצר סיסמה אקראית שלא נשמרת. `npm run set-passwords` קובע סיסמה ידועה, אבל ברירת המחדל של הסקריפט (`Demo1234!`) **כתובה בקוד המקור בריפו הפומבי** — לא מספיק "ליישן" אותה כפרטית. **תמיד** להריץ עם `DEMO_PASSWORD='<סיסמה חזקה שלא מופיעה בשום מקום בקוד>' npm run set-passwords`, ולמסור את הסיסמה בפועל בערוץ פרטי (וואטסאפ/מייל) למי שצריך — לא לתעד אותה בשום קובץ בריפו.
- **מסך ההתחברות בכוונה לא מציג רשימת חשבונות/סיסמה** (הוסר — ראה היסטוריית git). זה קריטי כי הדמו פרוס גם ב-GitHub Pages **ציבורי** ומחובר לאותו DB אמיתי; הצגת הסיסמה על המסך = כל מי שנכנס לקישור יכול להתחבר ולערוך/למחוק נתונים אמיתיים.
- **פרסום ציבורי עם config.js**: ה-workflow [deploy-pages.yml](../.github/workflows/deploy-pages.yml) **יוצר** את `CRM/demo/config.js` בזמן ה-build מתוך GitHub repo variables (`vars.SUPABASE_URL`, `vars.SUPABASE_ANON_KEY` — לא secrets, כי ה-anon key בטוח לחשיפה ציבורית מטבעו) — הקובץ עצמו עדיין **לא** נכנס ל-git בשום שלב. עדכון הערכים: `gh variable set SUPABASE_URL --repo asaeltaragan-cpu/CRM4Clinic --body "..."` (וכנ"ל ל-`SUPABASE_ANON_KEY`).
- **זרימה**: `auth.js` מאזין לאירוע `supabase-ready` (מ-`supabaseClient.js`), בודק session קיים, ואם אין — מציג את מסך ההתחברות. אחרי `signInWithPassword` מוצלח, טוען את שורת הפרופיל מ-`users`, ומשגר אירוע `auth-ready` שעליו `app.js` מאזין כדי לפתוח את פאנל הלידים האמיתי (`initDbLeadsPanel`). התנתקות משגרת `auth-signed-out` (`teardownDbLeadsPanel`).
- **חשוב לזכור**: `supabase-ready` משוגר מיד אחרי יצירת ה-client (לא תלוי בהצלחת שום שאילתה) — אל תוסיפו תלות בין אתחול האימות לבין בדיקת badge כלשהי, כדי שמסך ההתחברות תמיד יעלה גם אם טבלה ספציפית לא זמינה כרגע.
- **פרויקט Supabase "נרדם"**: בטיר החינמי, פרויקט לא פעיל כשבוע נכנס למצב מושהה ולוקח זמן להתעורר בפעם הבאה שפונים אליו. זה קורה, אבל בפועל הסיבה השכיחה יותר ל"table not found in schema cache" היא ש-`schema.sql` פשוט לא רץ — לבדוק תמיד קודם ב-Table Editor שהטבלאות קיימות.
- **סדר הקמה מאומת (עבד בפועל)**: `schema.sql` → `002` → `003` → `004_grants.sql` → `005_fix_rls_recursion.sql` (קריטי — בלעדיו ההתחברות נכשלת ב-500 אחרי אימות הסיסמה, בגלל רקורסיה ב-RLS כש-`auth_clinic()`/`auth_role()` שואלות את `users` שיש לה מדיניות שמפעילה אותן שוב) → `npm run seed` → הרצה חוזרת של ה-INSERT-ים ב-002/003 (עכשיו יש קליניקה) → `npm run set-passwords`.

---

## 4. התאמה לנייד - חובה בכל שינוי ממשק

**כלל קבוע: כל שינוי ב-UI (בעיקר `CRM/demo/**`) חייב לעבוד באופן מיטבי בטלפון נייד, ב-Chrome וב-Safari, לפני שהוא נחשב גמור.** בעלות קליניקות ומזכירות עובדות בעיקר מהטלפון, והדמו נשלח ללקוחות כקישור - כלומר נפתח קודם כל בנייד.

### 4.1 כללי עיצוב

- **Mobile-first**: כל מסך חייב לעבוד ברוחב 320px **בלי גלילה אופקית של הדף** ועם ניווט זמין תמיד.
- **ניווט**: מתחת ל-900px הסיידבר הופך לסרגל תחתון (`.sidebar` ב-`styles.css`). מסך חדש = כפתור `.nav-item` עם `data-short` (תווית קצרה לנייד) ו-`<span class="nav-ico">` / `<span class="nav-label">`.
- **טבלאות**: תמיד בתוך עוטף עם `class="table-scroll"` - הטבלה גוללת בתוך עצמה, לא הדף.
- **שדות קלט**: `font-size` לפחות 16px בנייד (אחרת iPhone עושה zoom אוטומטי ב-focus).
- **אזורי מגע**: לפחות 40px גובה לכפתורים.
- **רוחבים**: אין רוחב קבוע בפיקסלים בלי `max-width` / `min()`. מודאלים עד 95vw. גריד עם עמודה קבועה - לעבור לעמודה אחת במובייל.
- **iPhone עם notch**: שימוש ב-`env(safe-area-inset-bottom)` לאלמנטים צמודים לתחתית (ה-meta viewport כולל `viewport-fit=cover`).

### 4.2 בדיקה חובה לפני push

1. **מקומית** (Chromium):
   ```bash
   cd CRM/tests/mobile && npm ci
   CHROMIUM_PATH=/opt/pw-browsers/chromium node mobile-check.mjs --only=chromium   # בסביבת Claude Code בענן
   node mobile-check.mjs                                                            # במחשב עם דפדפני Playwright מותקנים
   ```
   הסקריפט עובר על Pixel 7, Galaxy S9+, 320px ודסקטופ (Chrome) ועל iPhone 13, iPhone SE, iPad Mini ודסקטופ (WebKit = המנוע של Safari): ניווט לכל מסך, אין גלילה אופקית, מודאלים וסיור בתוך המסך, inputs ב-16px, אין שגיאות JS. צילומי מסך נשמרים ב-`CRM/tests/mobile/screenshots/`.
2. **ב-GitHub Actions**: `.github/workflows/mobile-check.yml` רץ אוטומטית על כל push/PR שנוגע ב-`CRM/demo/**` - חייב להיות ירוק על שני המנועים. צילומי המסך זמינים כ-artifact בשם `mobile-screenshots`.
3. **לצרף צילומי מסך מהנייד** למשתמש בסיום כל שינוי UI.
4. מסך או רכיב חדש - להוסיף אותו לבדיקה ב-`mobile-check.mjs`.

### 4.3 מגבלה ידועה

WebKit של Playwright הוא המנוע של Safari, **לא** Safari של iOS עצמו. הוא תופס את רוב בעיות ה-layout, אבל לא התנהגויות ייחודיות ל-iPhone (סרגל הכתובת המתכווץ, המקלדת שדוחפת את המסך, ה-notch בפועל). **לפני הצגה ללקוח - לפתוח את הקישור בטלפון אמיתי (iPhone + Android).**
