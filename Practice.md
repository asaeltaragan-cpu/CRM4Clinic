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
Apify / Overpass  →  Edge Function (Deno, Supabase)  →  טבלת leads  →  מסך הלידים בדמו
                              │
                              └──→  טבלת sync_logs (רישום כל הרצה)
```

1. **ה-Edge Function** (`sync-apify-leads` או `sync-osm-leads`) שולפת את הנתונים הגולמיים מהמקור, מנרמלת טלפון לפורמט E.164 (`+972...`), ומרכיבה שורת ליד: `full_name`, `phone`, `source_id` (מצביע ל-`lead_sources` — "Google Maps" או "OpenStreetMap"), `stage_id` (תמיד השלב הראשון, "ליד חדש"), `notes` (קטגוריה + כתובת).
2. **מניעת כפילויות**: לפני הכנסה, ה-Function בודקת אילו טלפונים כבר קיימים בטבלת `leads` עבור הקליניקה (`unique (clinic_id, phone)` בסכמה), ומכניסה **רק לידים חדשים** — לידים קיימים לעולם לא נדרסים, גם אם השלב שלהם השתנה בינתיים ע"י נציגה.
3. **טבלת `sync_logs`** מקבלת שורה בכל הרצה: `source` (`apify_google_maps` / `osm_overpass`), `started_at`, `finished_at`, `status` (`running`/`success`/`error`), `leads_upserted`, `leads_skipped`, `message`. זה מה שמאפשר תצוגת "עודכן לאחרונה" בדמו.
4. **הצגה במסך הלידים**: מכיוון שמפתח ה-`anon` (בדפדפן) חסום ע"י RLS מלקרוא ישירות מ-`leads`, הדמו **תמיד** קורא דרך אותה Edge Function (`GET` במקום קריאה ישירה לטבלה) — ה-Function משתמשת ב-`service_role` בצד השרת בלבד ומחזירה רק שדות בטוחים.

### 2.3 מתי הסנכרון רץ

- **יזום ע"י המשתמש**: כפתור **"🔄 משוך לידים חדשים"** בכל אחד משני הפאנלים במסך הלידים בדמו (`gmaps-sync-btn` / `osm-sync-btn` ב-`index.html`) — קורא `POST` ל-Edge Function המתאימה.
- **אוטומטי, פעם ביום**: `.github/workflows/sync-leads.yml` — GitHub Action עם `cron: '0 6 * * *'` (06:00 UTC), שקורא ל-**שני** ה-Functions (matrix job). אפשר גם להריץ ידנית מטאב Actions → Run workflow.

### 2.4 הוספת מקור לידים נוסף (אם יתבקש בעתיד)

לפי אותה תבנית בדיוק (ראו את שני ה-Functions הקיימים כדוגמה):
1. Edge Function חדשה תחת `CRM/supabase/functions/sync-<name>-leads/`, עם `GET` (קריאה, מסונן ל-`source_id` של המקור) ו-`POST` (סנכרון + upsert + `sync_logs`).
2. מיגרציה חדשה ב-`CRM/supabase/migrations/00N_<name>_lead_source.sql` שמוודאת קיום שורת `lead_sources` בשם המקור.
3. הוספת `{ fn, prefix, label }` למערך `SYNC_SOURCES` ב-`CRM/demo/app.js`, ופאנל DOM תואם (`<prefix>-live-leads-panel` וכו') ב-`index.html`.
4. הוספת שם ה-Function למטריצה ב-`.github/workflows/sync-leads.yml`.
5. תיעוד ב-`CRM/supabase/README.md` (שלב 5) ובטבלה בסעיף 2.1 כאן.
