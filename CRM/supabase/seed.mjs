/**
 * Clinic Revenue OS — Supabase seed script
 * ------------------------------------------------------------
 * ממלא פרויקט Supabase נקי (אחרי הרצת schema.sql) בנתוני דמו:
 * 1 קליניקה, 5 אנשי צוות (משתמשי Auth אמיתיים), 4 מקורות ליד,
 * 3 שירותים, 11 שלבי Pipeline, תבניות הודעה, חוקי אוטומציה,
 * 50 לידים ו-20 לקוחות עם משימות/פגישות/הצעות טיפול נגזרות.
 *
 * שימוש:
 *   cd CRM/supabase
 *   npm install
 *   cp .env.example .env   # ומלאו SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   npm run seed
 *
 * חשוב: משתמשים במפתח ה-service_role (Settings → API) — הוא עוקף RLS ומיועד
 * להרצה חד-פעמית מהמחשב שלכם בלבד. אין להטמיע אותו בקוד לקוח/דפדפן.
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ חסרים SUPABASE_URL ו/או SUPABASE_SERVICE_ROLE_KEY. ראו .env.example');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoAdminApi: true } });

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const weightedPick = (items) => {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const i of items) { if ((r -= i.w) <= 0) return i.v; }
  return items[items.length - 1].v;
};
const daysAgoISO = (d) => { const t = new Date(); t.setDate(t.getDate() - d); t.setHours(rnd(8, 19), rnd(0, 59)); return t.toISOString(); };
const inDaysISO = (d) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(rnd(9, 18), rnd(0, 59)); return t.toISOString(); };
const HEB_FIRST = ['שירה','דנה','נועה','מיכל','רותם','ליאור','הילה','טל','ענת','יעל','אביגיל','מאיה','גל','שני','אור','אורית','קרן','ספיר','עדי','נטלי'];
const HEB_LAST = ['כהן','לוי','מזרחי','פרץ','ביטון','אברהם','דהן','אזולאי','גבאי','שני','אוחיון','חדד','אלמוג','שרעבי','טל'];
const usedPhones = new Set();
function phone() { let p; do { p = `05${pick([0,2,3,4,5])}-${rnd(1000000,9999999)}`; } while (usedPhones.has(p)); usedPhones.add(p); return p; }
function name() { return `${pick(HEB_FIRST)} ${pick(HEB_LAST)}`; }

async function main() {
  console.log('🚀 מתחיל זריעת נתונים ל-Clinic Revenue OS...');

  // 1. קליניקה
  const { data: clinic, error: clinicErr } = await supabase
    .from('clinics')
    .insert({ name: 'קליניקת אקווה אסתטיק (דמו)', slug: 'crm4clinic-demo', timezone: 'Asia/Jerusalem' })
    .select().single();
  if (clinicErr) throw clinicErr;
  console.log('✅ קליניקה נוצרה:', clinic.id);

  // 2. אנשי צוות — משתמשי Auth אמיתיים + שורת public.users
  const STAFF_DEF = [
    { full_name: 'דנה כהן', role: 'owner' },
    { full_name: 'מיכל לוי', role: 'manager' },
    { full_name: 'נועה מזרחי', role: 'sales' },
    { full_name: 'שיר בן-דוד', role: 'sales' },
    { full_name: 'ליאת אברהם', role: 'therapist' },
  ];
  const staff = [];
  for (const s of STAFF_DEF) {
    const email = `${s.full_name.replace(/\s+/g, '.').toLowerCase()}@demo.crm4clinic.local`;
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email, password: crypto.randomUUID(), email_confirm: true,
    });
    if (authErr) throw authErr;
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .insert({ id: authUser.user.id, clinic_id: clinic.id, full_name: s.full_name, email, role: s.role })
      .select().single();
    if (userErr) throw userErr;
    staff.push(userRow);
  }
  console.log(`✅ ${staff.length} אנשי צוות נוצרו (משתמשי Auth + public.users)`);

  // 3. מקורות לידים, שירותים, שלבי Pipeline
  const { data: sources } = await supabase.from('lead_sources').insert(
    ['Instagram', 'Facebook', 'Google Ads', 'הפניות'].map((n) => ({ clinic_id: clinic.id, name: n }))
  ).select();

  const { data: services } = await supabase.from('services').insert([
    { clinic_id: clinic.id, name: 'הזרקות חומצה היאלורונית', default_price: 1800, default_sessions: 1, maintenance_days: 150 },
    { clinic_id: clinic.id, name: 'הסרת שיער בלייזר (סדרה)', default_price: 350, default_sessions: 6, maintenance_days: 60 },
    { clinic_id: clinic.id, name: 'טיפול פנים מחדש / פילינג', default_price: 450, default_sessions: 4, maintenance_days: 45 },
  ]).select();

  const STAGE_DEFS = [
    ['ליד חדש', 'open', 0.25], ['ממתין למענה', 'open', 24], ['נוצר קשר', 'open', 48],
    ['נקבע ייעוץ', 'open', null], ['הגיע לייעוץ', 'open', 24], ['נשלחה הצעת טיפול', 'open', 72],
    ['ממתין להחלטה', 'open', 168], ['נסגר לטיפול', 'won', null], ['בטיפול / סדרת טיפולים', 'won', null],
    ['לקוח לשימור / טיפול חוזר', 'won', null], ['אבוד / לא רלוונטי', 'lost', null],
  ];
  const { data: stages } = await supabase.from('pipeline_stages').insert(
    STAGE_DEFS.map(([n, type, sla], i) => ({ clinic_id: clinic.id, name: n, position: i + 1, type, sla_hours: sla }))
  ).select();
  const stageByPos = (p) => stages.find((s) => s.position === p);
  console.log('✅ מקורות, שירותים ו-11 שלבי Pipeline נוצרו');

  // 4. תבניות הודעה + חוקי אוטומציה
  await supabase.from('message_templates').insert([
    { clinic_id: clinic.id, name: 'פתיחה ללידה חדשה', trigger_key: 'new_lead', is_marketing: false, body: 'היי {name}, כאן {agent} מ-{clinic} 😊 קיבלתי את הפנייה שלך לגבי {treatment}. מתי נוח לך לדבר?' },
    { clinic_id: clinic.id, name: 'אין מענה', trigger_key: 'no_answer', is_marketing: false, body: 'היי {name}, ניסיתי להשיג אותך בקשר ל-{treatment}. אשמח לדעת אם עדיין רלוונטי.' },
    { clinic_id: clinic.id, name: 'תזכורת לייעוץ', trigger_key: 'reminder', is_marketing: false, body: 'היי {name}, תזכורת לייעוץ שלנו {when} ב-{clinic}.' },
    { clinic_id: clinic.id, name: 'שליחת הצעת טיפול', trigger_key: 'proposal', is_marketing: false, body: '{name}, מצרפת את ההצעה: {treatment}. בתוקף עד {validUntil}.' },
    { clinic_id: clinic.id, name: 'פולואפ להצעה', trigger_key: 'followup', is_marketing: false, body: 'היי {name}, רציתי לבדוק אם היו לך שאלות לגבי ההצעה.' },
    { clinic_id: clinic.id, name: 'חזרה ללקוחה רדומה', trigger_key: 'dormant', is_marketing: true, body: 'היי {name}, עבר זמן מאז הביקור האחרון. נשמח לקבוע לך טיפול המשך ל-{treatment}.' },
  ]);
  await supabase.from('automation_rules').insert(
    ['R01', 'R02', 'R03', 'R04', 'R08', 'R13', 'R15'].map((k) => ({ clinic_id: clinic.id, key: k, enabled: true }))
  );
  console.log('✅ תבניות הודעה וחוקי אוטומציה נוצרו');

  // 5. 50 לידים
  const stageWeights = [
    { v: 1, w: 14 }, { v: 2, w: 10 }, { v: 3, w: 8 }, { v: 4, w: 7 }, { v: 5, w: 4 },
    { v: 6, w: 6 }, { v: 7, w: 8 }, { v: 8, w: 5 }, { v: 9, w: 6 }, { v: 10, w: 5 }, { v: 11, w: 7 },
  ];
  const salesStaff = staff.filter((s) => s.role === 'sales' || s.role === 'manager');
  const LOST_REASONS = ['המחיר גבוה מדי', 'בחרה קליניקה אחרת', 'לא מעוניינת יותר', 'אין מענה', 'לא הזמן המתאים'];
  const leadsPayload = [];
  for (let i = 0; i < 50; i++) {
    const stagePos = weightedPick(stageWeights);
    const stage = stageByPos(stagePos);
    const source = pick(sources);
    const service = pick(services);
    const createdAt = daysAgoISO(rnd(0, 25));
    let response_status = 'none', next_action = null, next_action_at = null, lost_reason = null;
    if (stagePos === 1) { next_action = 'לחזור ללידה (SLA 15 דק׳)'; next_action_at = new Date(Date.now() - rnd(5, 200) * 60000).toISOString(); }
    else if (stagePos === 2) { next_action = 'פולואפ — עדיין ללא מענה'; next_action_at = new Date(Date.now() - rnd(1, 30) * 3600000).toISOString(); }
    else if (stagePos >= 3 && stagePos <= 7) { response_status = 'replied'; next_action = 'המשך תהליך מכירה'; next_action_at = inDaysISO(rnd(-2, 4)); }
    else if (stagePos >= 8 && stagePos <= 10) { response_status = 'replied'; }
    else if (stagePos === 11) { response_status = 'contacted'; lost_reason = pick(LOST_REASONS); }
    leadsPayload.push({
      clinic_id: clinic.id, full_name: name(), phone: phone(),
      source_id: source.id, service_id: service.id, stage_id: stage.id,
      owner_user_id: pick(salesStaff).id,
      expected_value: Math.round((service.default_price * (0.8 + Math.random() * 0.5)) / 50) * 50,
      response_status, next_action, next_action_at, lost_reason, created_at: createdAt,
    });
  }
  const { data: leads, error: leadsErr } = await supabase.from('leads').insert(leadsPayload).select();
  if (leadsErr) throw leadsErr;
  console.log(`✅ ${leads.length} לידים נוצרו`);

  // 6. 20 לקוחות (12 מתוך לידים שנסגרו + 8 ותיקים)
  const wonLeads = leads.filter((l) => {
    const stage = stages.find((s) => s.id === l.stage_id);
    return stage.type === 'won';
  });
  const customersPayload = [];
  wonLeads.slice(0, 12).forEach((l) => {
    customersPayload.push({
      clinic_id: clinic.id, lead_id: l.id, full_name: l.full_name, phone: l.phone,
      status: Math.random() > 0.6 ? 'dormant' : 'active',
      last_visit_at: daysAgoISO(rnd(1, 200)),
      next_recommended_at: inDaysISO(rnd(-5, 30)),
      churn_risk: Math.random() > 0.75,
    });
  });
  for (let i = customersPayload.length; i < 20; i++) {
    customersPayload.push({
      clinic_id: clinic.id, lead_id: null, full_name: name(), phone: phone(),
      status: Math.random() > 0.5 ? 'dormant' : 'active',
      last_visit_at: daysAgoISO(rnd(1, 220)),
      next_recommended_at: inDaysISO(rnd(-5, 30)),
      churn_risk: Math.random() > 0.75,
    });
  }
  const { data: customers, error: custErr } = await supabase.from('customers').insert(customersPayload).select();
  if (custErr) throw custErr;
  // עדכון leads.customer_id בהתאמה
  for (const c of customers.filter((c) => c.lead_id)) {
    await supabase.from('leads').update({ customer_id: c.id }).eq('id', c.lead_id);
  }
  console.log(`✅ ${customers.length} לקוחות נוצרו`);

  // 7. פרופילי נאמנות
  await supabase.from('loyalty_profiles').insert(
    customers.filter(() => Math.random() > 0.35).map((c) => ({
      customer_id: c.id, clinic_id: clinic.id, is_member: true,
      joined_at: new Date().toISOString().slice(0, 10),
      tier: pick(['new', 'active', 'vip']), points: rnd(0, 900),
    }))
  );

  // 8. הצעות טיפול ללידים בשלבים 6-10
  const proposalStages = stages.filter((s) => s.position >= 6 && s.position <= 10).map((s) => s.id);
  const proposalLeads = leads.filter((l) => proposalStages.includes(l.stage_id));
  await supabase.from('treatment_proposals').insert(
    proposalLeads.map((l) => {
      const stage = stages.find((s) => s.id === l.stage_id);
      return {
        clinic_id: clinic.id, lead_id: l.id, service_id: pick(services).id,
        sessions: rnd(1, 6), price: l.expected_value,
        sent_at: daysAgoISO(rnd(1, 10)), valid_until: inDaysISO(rnd(2, 14)),
        status: stage.type === 'won' ? 'accepted' : 'sent',
      };
    })
  );

  // 9. משימות (נגזרות מלידים פתוחים + לקוחות שמגיע להן לחזור)
  const openLeads = leads.filter((l) => {
    const stage = stages.find((s) => s.id === l.stage_id);
    return stage.type === 'open' && l.next_action_at;
  });
  await supabase.from('tasks').insert(
    openLeads.map((l) => ({
      clinic_id: clinic.id, lead_id: l.id, assignee_user_id: l.owner_user_id,
      type: l.next_action, reason: 'פעולה מתוכננת', due_at: l.next_action_at,
    }))
  );
  const dueCustomers = customers.filter((c) => new Date(c.next_recommended_at) <= new Date());
  await supabase.from('tasks').insert(
    dueCustomers.map((c) => ({
      clinic_id: clinic.id, customer_id: c.id, assignee_user_id: pick(salesStaff).id,
      type: 'הצעת טיפול חוזר / חידוש סדרה', reason: c.status === 'dormant' ? 'לקוחה רדומה' : 'מגיע לה טיפול תחזוקה',
      due_at: inDaysISO(rnd(-2, 2)),
    }))
  );
  console.log('✅ הצעות טיפול ומשימות נוצרו');

  // 10. פגישות ליומן
  const therapist = staff.find((s) => s.role === 'therapist');
  const consultLeads = leads.filter((l) => {
    const stage = stages.find((s) => s.id === l.stage_id);
    return [4, 5].includes(stage.position);
  });
  await supabase.from('appointments').insert(
    consultLeads.map((l) => {
      const stage = stages.find((s) => s.id === l.stage_id);
      const day = stage.position === 5 ? rnd(-6, -1) : rnd(0, 6);
      const start = new Date(); start.setDate(start.getDate() + day); start.setHours(rnd(9, 17), 0);
      return {
        clinic_id: clinic.id, lead_id: l.id, therapist_user_id: therapist.id, type: 'consultation',
        status: day < 0 ? pick(['completed', 'no_show', 'completed']) : 'scheduled',
        starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 30 * 60000).toISOString(),
      };
    })
  );
  console.log('✅ פגישות יומן נוצרו');

  console.log('\n🎉 סיום! הפרויקט מולא בנתוני דמו מלאים.');
  console.log(`   clinic_id: ${clinic.id}`);
  console.log('   השתמשו ב-Project URL + anon key (Settings → API) כדי לחבר את הדמו/אפליקציה.');
}

main().catch((err) => { console.error('❌ שגיאה בזריעה:', err.message || err); process.exit(1); });
