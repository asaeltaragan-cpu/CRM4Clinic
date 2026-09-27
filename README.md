# CRM4Clinic — Clinic Revenue OS

## מטרת הפרויקט

**Clinic Revenue OS** הוא מוצר SaaS (בשלב MVP/דמו) — מערכת CRM ואוטומציית מכירות לקליניקות אסתטיקה קטנות ובינוניות בישראל. המטרה **אינה** לבנות עוד יומן תורים או מערכת ניהול קליניקה מלאה, אלא לפתור בעיה עסקית ממוקדת:

> לידים שכבר הגיעו לקליניקה לא הופכים לטיפול וללקוח משלם, בגלל תגובה איטית, חוסר מעקב, תהליך מכירה לא אחיד, ותלות בזיכרון של הצוות.

המערכת נותנת לכל ליד תהליך מסודר (Pipeline), פולואפ מבוקר, ודשבורד שעונה על השאלה: *"איפה אני מאבדת הכנסה, ומה הצוות צריך לעשות היום?"*

## מה יש בפרויקט (כללי)

הפרויקט הזה הוא **חבילת אפיון + דמו עובד**, לא עוד קוד production מלא:

1. **מסמכי אפיון מוצר** (`CRM/*.md`) — Spec, Sitemap, Wireframes, מודל נתונים, API, תרחישי בדיקות.
2. **דמו אינטראקטיבי לצוות מכירות** (`CRM/demo/`) — אתר סטטי (HTML/CSS/JS, בלי build) עם נתוני דוגמה וסיור מודרך, שרץ ישירות בדפדפן.
3. **מסד נתונים אמיתי ב-Supabase** (`CRM/supabase/`) — סכמה מלאה (PostgreSQL + RLS), סקריפט זריעת דמו, ו-Edge Functions לסנכרון לידים.
4. **לידים אמיתיים ממקורות חיצוניים** (`CRM/leads/` + Edge Functions) — קליניקות אסתטיקה אמיתיות בישראל, נשלפות אוטומטית מ-Google Maps (Apify) ומ-OpenStreetMap (חינמי), ומוזרמות למסד הנתונים ולמסך הלידים בדמו.

## מבנה הפרויקט

```
CRM4Clinic/
├── README.md                    ← קובץ זה
├── Practice.md                  ← הוראות עבודה לפעולות חוזרות בפרויקט
├── .github/workflows/
│   └── sync-leads.yml           ← GitHub Action: סנכרון לידים יומי אוטומטי
└── CRM/
    ├── PRODUCT_SPEC.md          ← מסמך אפיון MVP מלא (פרסונות, User Stories, KPI, Roadmap...)
    ├── SITEMAP.md                ← מבנה ניווט וכל המסכים
    ├── WIREFRAMES.md              ← Wireframes טקסטואליים לכל מסך
    ├── DATA_MODEL.md              ← ERD + סכמת SQL + RLS
    ├── API.md                     ← כל ה-REST endpoints
    ├── TEST_SCENARIOS.md          ← תרחישי בדיקות (TC-XXX)
    │
    ├── demo/                     ← הדמו האינטראקטיבי (ה-GUI)
    │   ├── index.html             ← נקודת הכניסה
    │   ├── app.js                 ← כל לוגיקת הרינדור והאינטראקציה
    │   ├── data.js                ← מחולל נתוני דמו (seed קבוע)
    │   ├── tour.js                ← הסיור המודרך למכירה
    │   ├── styles.css
    │   ├── supabaseClient.js      ← חיבור אופציונלי ל-Supabase (badge + client)
    │   ├── auth.js                 ← מסך התחברות + ניהול session (Supabase Auth)
    │   ├── config.example.js      ← תבנית להגדרות Supabase (config.js בפועל לא ב-git)
    │   └── README.md
    │
    ├── supabase/                  ← הבק-אנד האמיתי
    │   ├── schema.sql              ← סכמת בסיס (18 טבלאות + RLS)
    │   ├── migrations/             ← תוספות סכמה מדורגות (002, 003, ...)
    │   ├── functions/              ← Edge Functions (כתיבה בלבד — POST)
    │   │   ├── sync-apify-leads/   ← סנכרון מ-Google Maps (Apify)
    │   │   └── sync-osm-leads/     ← סנכרון מ-OpenStreetMap (חינמי)
    │   ├── seed.mjs                ← זריעת נתוני דמו לפרויקט Supabase אמיתי
    │   ├── set-demo-passwords.mjs  ← קביעת סיסמת דמו קבועה ל-5 אנשי הצוות
    │   └── README.md               ← הוראות הקמה מלאות
    │
    └── leads/                     ← תוצרי מקור לידים חיצוני (Proof of Concept)
        ├── aesthetic-clinics-israel.csv
        └── README.md
```

## איך עובדים עם ה-GUI (הדמו)

הדמו הוא **אתר סטטי בלבד** — אין build, אין npm install. פותחים אותו ישירות או דרך שרת סטטי מקומי:

```bash
cd CRM/demo
python -m http.server 8080
# לפתוח http://localhost:8080
```

**ניווט:** סרגל צד ימני (RTL) עם 7 מודולים — דשבורד, לידים, משימות ופולואפ, יומן, הכנסות והמרות, הגדרות.

**סיור מודרך למכירה:** כפתור **"🎯 סיור מודרך למכירה"** בתחתית הסרגל הצדדי — 9 שלבים שעוברים בין המסכים עם הסבר מכירתי שנשאב מהנתונים בזמן אמת. זו נקודת הכניסה המומלצת להצגה ראשונה מול קליניקה.

**מסך הלידים** הוא המסך הכי "חי": Kanban + טבלה עם 50 לידי דמו, ולמשתמש מחובר (ראו למטה) — גם פאנל "🗄️ לידים אמיתיים מה-DB" עם טבלת לידים חיה מ-Supabase (כולל אלה שהגיעו מ-Google Maps/OpenStreetMap), שינוי שלב אמיתי, ושני כפתורי סנכרון יזום (ראו [Practice.md](Practice.md) לפירוט המלא של תהליך הלידים).

**חיבור ל-Supabase + ניהול משתמשים (אופציונלי):** בלי `CRM/demo/config.js` הדמו עובד לגמרי על נתונים מקומיים (`data.js`), בלי מסך התחברות. עם `config.js` מוגדר (מועתק מ-`config.example.js`), הדמו מציג **מסך התחברות אמיתי** (Supabase Auth) — 5 חשבונות דמו מוצגים במסך עצמו עם סיסמה משותפת. אחרי התחברות נפתח פאנל הלידים האמיתי מה-DB. הוראות מלאות: [CRM/supabase/README.md](CRM/supabase/README.md).

## תיעוד נוסף

| נושא | קובץ |
|---|---|
| עבודה עם הפרויקט, פעולות חוזרות, Git, טיפול בלידים | [Practice.md](Practice.md) |
| הקמת Supabase, סנכרון לידים, Edge Functions | [CRM/supabase/README.md](CRM/supabase/README.md) |
| הדמו — מה יש בו ואיך מריצים | [CRM/demo/README.md](CRM/demo/README.md) |
| מקור הלידים מ-Apify (Google Maps) | [CRM/leads/README.md](CRM/leads/README.md) |
