# Clinic Revenue OS — API Endpoints

> REST / JSON, גרסה `v1`. בסיס: `/api/v1`. אימות: `Authorization: Bearer <JWT>` (Supabase Auth). ה-`clinic_id` נגזר מהטוקן, לא נשלח בבקשה.
> תפקידים: **O** owner · **M** manager · **S** sales · **T** therapist.

## מוסכמות

- **רשימות:** `?page=1&page_size=25&sort=-created_at&q=...` → `{ data: [], page, page_size, total }`.
- **שגיאות:** `{ error: { code, message, fields? } }`. קודים: `400 validation`, `401`, `403`, `404`, `409 conflict` (למשל טלפון כפול), `422 business_rule`, `429`.
- **תאריכים:** ISO-8601 UTC. שעות פעילות מחושבות לפי `clinic.timezone`.
- **Idempotency:** `POST` יצירת ליד ציבורי תומך ב-`Idempotency-Key`.
- **Audit:** כל שינוי בסטטוס/שלב/הסכמה/מחיקה נרשם ב-`audit_logs` בצד השרת; הלקוח שולח `X-Screen`.
- **כלל שליחה:** אין endpoint ששולח הודעה ללקוחה. המערכת מייצרת טיוטה בלבד (`/messages/render`) והמשתמש שולח דרך `wa.me`. תיעוד השליחה נעשה ב-`/interactions`.

---

## 1. Auth ומשתמשים

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| POST | `/auth/login` | התחברות | — |
| POST | `/auth/logout` | | כולם |
| POST | `/auth/password/reset` | בקשת איפוס | — |
| GET | `/me` | משתמש, קליניקה, הרשאות | כולם |
| GET | `/users` | רשימת צוות | O, M |
| POST | `/users` | הזמנת משתמש `{email, full_name, role}` | O |
| PATCH | `/users/:id` | שינוי תפקיד/הפעלה | O |

## 2. לידים

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/leads` | סינון: `stage_id, source_id, owner_id, status=unanswered\|no_next_action\|overdue, created_from/to` | O, M, S* |
| POST | `/leads` | יצירה ידנית | O, M, S |
| GET | `/leads/:id` | כרטיס (כולל סיכום) | O, M, S* |
| PATCH | `/leads/:id` | עדכון שדות | O, M, S* |
| POST | `/leads/:id/stage` | שינוי שלב `{stage_id, lost_reason?, next_action, next_action_at}` | O, M, S* |
| POST | `/leads/:id/assign` | הקצאה `{owner_user_id}` | O, M |
| POST | `/leads/:id/lose` | סימון אבוד `{reason}` | O, M, S* |
| POST | `/leads/:id/convert` | המרה ללקוחה (טרנזקציה) | O, M, S* |
| POST | `/leads/import` | ייבוא CSV (multipart) → `{created, duplicates, errors[]}` | O, M |
| GET | `/leads/board` | נתוני Kanban מקובצים לפי שלב | O, M, S* |
| POST | `/public/leads/:clinicSlug` | קליטת ליד מטופס ציבורי (rate limit, honeypot, `Idempotency-Key`) | ציבורי |

`*` sales רואה רק לידים שלה או לא מוקצים.

**דוגמה — `POST /leads`**
```json
{ "full_name": "שירה כהן", "phone": "0501234567", "email": null,
  "source_id": "uuid", "service_id": "uuid", "expected_value": 1800,
  "marketing_consent": { "channel": "whatsapp", "granted": true, "source": "form" } }
```
תגובה `201`: הליד + `task` ראשונה "חזרה תוך 15 דק׳" + `suggested_message`.
שגיאה `409` אם הטלפון קיים: `{ error: { code: "duplicate_phone", existing_id } }`.

## 3. לקוחות

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/customers` | `?status=dormant&days_since_visit_gte=90&tier=vip&q=` | O, M, S, T* |
| GET | `/customers/:id` | כרטיס | O, M, S, T* |
| PATCH | `/customers/:id` | עדכון | O, M, S |
| GET | `/customers/dormant` | רדומות (90/120/180) + `churn_risk` | O, M, S |
| POST | `/customers/:id/anonymize` | אנונימיזציה (בקשת מחיקה) | O |
| GET | `/customers/:id/timeline` | ציר זמן מאוחד | O, M, S, T* |

`*` therapist – רק לקוחות עם פגישה משויכת אליה.

## 4. הצעות, חבילות, תשלומים

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/proposals` | `?status=sent&no_followup=true` | O, M, S |
| POST | `/proposals` | יצירה `{lead_id\|customer_id, service_id, sessions, price, valid_until}` | O, M, S |
| PATCH | `/proposals/:id` | עדכון | O, M, S |
| POST | `/proposals/:id/send` | סימון "נשלחה" → מעביר שלב + יוצר משימות 3/7/14 | O, M, S |
| POST | `/proposals/:id/accept` | מאשרת → המרה + חבילה + משימת תור ראשון | O, M, S |
| POST | `/proposals/:id/decline` | `{reason}` | O, M, S |
| GET | `/packages?customer_id=` | חבילות ויתרה | O, M, S, T* |
| POST | `/packages/:id/consume` | ניצול מפגש `{appointment_id}` | O, M, T |
| GET | `/payments?package_id=` | | O, M |
| POST | `/payments` | רישום מקדמה/תשלום `{package_id, amount, type, state}` | O, M, S |
| PATCH | `/payments/:id` | | O, M |

## 5. יומן ופגישות

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/appointments` | `?from&to&therapist_id&status` | O, M, S, T* |
| POST | `/appointments` | יצירה; בדיקת התנגשות למטפלת → `409 slot_conflict` | O, M, S |
| PATCH | `/appointments/:id` | הזזה/עריכה | O, M, S |
| POST | `/appointments/:id/status` | `{status}` (`confirmed/cancelled/no_show/completed`) — `no_show` יוצר משימה; `completed` (ייעוץ) יוצר משימת הצעה | O, M, S, T* |
| POST | `/appointments/:id/questionnaire-link` | יצירת טוקן לשאלון | O, M, S |

## 6. משימות ופולואפ

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/tasks` | `?bucket=overdue\|today\|tomorrow\|week\|dormant\|open_proposals\|unanswered\|no_show&assignee_id` | כולם (S,T: שלהם) |
| POST | `/tasks` | משימה ידנית | O, M, S |
| PATCH | `/tasks/:id` | עריכה/שינוי אחראית | O, M, S* |
| POST | `/tasks/:id/complete` | `{outcome}` + אפשרות `{next_action, next_action_at}` | כולם* |
| POST | `/tasks/:id/snooze` | `{until}` | כולם* |
| POST | `/tasks/:id/irrelevant` | `{reason}` | O, M, S* |
| GET | `/tasks/:id/message` | טיוטת הודעה מרונדרת + קישור `wa.me` | O, M, S |

## 7. הודעות ואינטראקציות

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| POST | `/messages/render` | `{template_id, lead_id\|customer_id, vars?}` → `{text, wa_link, blocked?, reason?}`; **חוסם** תבנית שיווקית אם `do_not_contact` או אין הסכמה | O, M, S |
| POST | `/messages/ai-draft` | טיוטת AI לפי שלב `{lead_id, goal}` → `{text, ai_generated:true}` | O, M, S |
| POST | `/interactions` | תיעוד שיחה/הודעה/הערה `{lead_id\|customer_id, type, content, ai_generated?}`; קובע `first_response_at` בפעם הראשונה | O, M, S, T (note) |
| GET | `/interactions?lead_id=` | ציר זמן | O, M, S |
| POST | `/interactions/summarize` | סיכום AI להערה ארוכה | O, M, S |

## 8. הסכמות

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/consents?lead_id\|customer_id` | | O, M, S |
| POST | `/consents` | רישום הסכמה `{channel, kind, source}` | O, M, S |
| POST | `/consents/revoke` | הסרה / "לא לפנות" | O, M, S |
| POST | `/public/unsubscribe/:token` | הסרה עצמאית מדיוור | ציבורי |

## 9. מועדון

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/loyalty?tier=&benefit_available=` | | O, M, S(קריאה) |
| PUT | `/customers/:id/loyalty` | הצטרפות, רמה, הטבה זמינה | O, M |
| POST | `/customers/:id/loyalty/benefit` | תיעוד הטבה שניתנה | O, M |

## 10. דשבורד ודוחות

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET | `/dashboard/kpis?period=month` | 12 KPI | O, M; S ללא כסף |
| GET | `/dashboard/urgent` | ספירות + deep-links לפעולות דחופות | O, M, S |
| GET | `/reports/funnel?from&to` | שלבים + % המרה | O, M |
| GET | `/reports/revenue?group_by=source\|service\|user&from&to` | הכנסה בפועל/צפויה | O, M |
| GET | `/reports/lost-reasons` | | O, M |
| GET | `/reports/retention` | חוזרות, רדומות שחזרו | O, M |
| GET | `/reports/at-risk` | לידים/הצעות/לקוחות שלא טופלו | O, M |
| GET | `/reports/team` | זמן תגובה והשלמת משימות לפי עובדת | O, M |

**דוגמה — `GET /dashboard/kpis`**
```json
{ "new_leads": 42, "unanswered_leads": 8, "avg_first_response_min": 23,
  "consultations_booked": 19, "attendance_rate": 0.79, "open_proposals": 11,
  "open_proposals_value": 27400, "won_this_month": 9, "expected_revenue": 15900,
  "returning_customers_to_contact": 12, "overdue_tasks": 6,
  "top_source_by_revenue": { "name": "Instagram", "revenue": 21300 } }
```

## 11. הגדרות

| Method | Path | תיאור | תפקידים |
|---|---|---|---|
| GET/PATCH | `/clinic` | פרטי קליניקה, שעות, timezone | O (M קריאה) |
| CRUD | `/lead-sources` | | O, M |
| CRUD | `/services` | שירותים ומחירון | O, M |
| CRUD | `/templates` | תבניות (`is_marketing`, משתנים מותרים) | O, M |
| CRUD | `/pipeline-stages` | שינוי שם/סדר, SLA (לא מחיקת שלב עם לידים) | O |
| GET/PATCH | `/automation-rules/:key` | הפעלה/כיבוי + פרמטרים | O (M קריאה+כיבוי) |
| GET | `/audit-logs?entity&user_id&from&to` | | O |
| GET/PATCH | `/forms/lead` | הגדרת טופס ליד ציבורי, שדות, מקור ברירת מחדל | O, M |
| GET/PATCH | `/forms/questionnaire` | שאלון לפני ייעוץ | O, M |

## 12. ציבורי (בלי JWT, עם טוקן)

| Method | Path | תיאור |
|---|---|---|
| POST | `/public/leads/:clinicSlug` | קליטת ליד |
| GET/POST | `/public/questionnaire/:token` | הצגה ושליחת שאלון; טוקן חד-פעמי עם תפוגה |
| POST | `/public/unsubscribe/:token` | הסרה |

## 13. Jobs (מתוזמנים, פנימי — לא endpoints ציבוריים)

| Job | תדירות | תפקיד |
|---|---|---|
| `sla-check` | כל דקה | R02/R03: לידים ללא מענה בשעות פעילות |
| `followup-scheduler` | כל 15 דק׳ | R04, R08, R09, R12 |
| `dormant-scan` | יומי 06:00 | R13: 90/120/180 ימים, `churn_risk` |
| `appointment-reminders` | כל שעה | R05: משימת תזכורת 24 ש׳ מראש |
| `birthdays` | יומי | R15 |
| `daily-digest` | יומי 08:00 (אופציונלי) | מייל/התראה לבעלת קליניקה |

כל job יוצר **משימות בלבד** ולא שולח הודעות. עבודה לפי `clinic_id` ו-`timezone`.

## 14. חוקי עסק אכופים בשרת

1. `POST /leads/:id/stage` לשלב `open` דורש `next_action` + `next_action_at`; לשלב `lost` דורש `lost_reason`.
2. `POST /messages/render` מחזיר `blocked: true` לתבנית שיווקית כשקיים `do_not_contact` או אין הסכמה פעילה בערוץ.
3. `POST /leads/:id/convert` דורש הצעה מאושרת או אישור מפורש `{force: true}` (רשום ב-audit).
4. `POST /packages/:id/consume` נכשל (`422`) כש-`used_sessions = total_sessions`.
5. מטפלת אינה מקבלת שדות כספיים בתגובות (`price`, `expected_value`, תשלומים) — הסרה ברמת ה-serializer.
6. `POST /customers/:id/anonymize` בלתי הפיך; דורש `confirm: true`.
