/* Clinic Revenue OS — Demo data generator
   נתוני דוגמה: 50 לידים, 20 לקוחות, 5 אנשי צוות, 3 סוגי טיפולים, 4 מקורות ליד.
   RNG עם seed קבוע כדי שהדמו יציג תמיד את אותו סיפור עקבי למכירה. */

(function (global) {
  'use strict';

  // ---------- Seeded RNG (mulberry32) ----------
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(42);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
  const weightedPick = (items) => {
    const total = items.reduce((s, i) => s + i.w, 0);
    let r = rand() * total;
    for (const i of items) { if ((r -= i.w) <= 0) return i.v; }
    return items[items.length - 1].v;
  };
  const daysAgo = (d, hourJitter = true) => {
    const t = new Date();
    t.setDate(t.getDate() - d);
    if (hourJitter) t.setHours(int(8, 19), int(0, 59), 0, 0);
    return t;
  };
  const inDays = (d) => { const t = new Date(); t.setDate(t.getDate() + d); t.setHours(int(9,18),int(0,59)); return t; };
  const fmtPhone = () => `05${pick([0,2,3,4,5])}-${int(1000000,9999999)}`;

  // ---------- Reference data ----------
  const STAFF = [
    { id: 'u1', name: 'דנה כהן',       role: 'owner',     avatarColor: '#7c5cff' },
    { id: 'u2', name: 'מיכל לוי',       role: 'manager',   avatarColor: '#2f9e6e' },
    { id: 'u3', name: 'נועה מזרחי',     role: 'sales',     avatarColor: '#e2843a' },
    { id: 'u4', name: 'שיר בן-דוד',     role: 'sales',     avatarColor: '#d64550' },
    { id: 'u5', name: 'ליאת אברהם',     role: 'therapist', avatarColor: '#2f7fd6' },
  ];

  const SOURCES = [
    { id: 's1', name: 'Instagram',  icon: '📷', w: 40 },
    { id: 's2', name: 'Facebook',   icon: '📘', w: 25 },
    { id: 's3', name: 'Google Ads', icon: '🔍', w: 20 },
    { id: 's4', name: 'הפניות',     icon: '🤝', w: 15 },
  ];

  const TREATMENTS = [
    { id: 't1', name: 'הזרקות חומצה היאלורונית', price: 1800, sessions: 1, maintDays: 150 },
    { id: 't2', name: 'הסרת שיער בלייזר (סדרה)',  price: 350,  sessions: 6, maintDays: 60  },
    { id: 't3', name: 'טיפול פנים מחדש / פילינג', price: 450,  sessions: 4, maintDays: 45  },
  ];

  const STAGES = [
    { id: 1,  name: 'ליד חדש',                    type: 'open', slaHours: 0.25 },
    { id: 2,  name: 'ממתין למענה',                type: 'open', slaHours: 24 },
    { id: 3,  name: 'נוצר קשר',                    type: 'open', slaHours: 48 },
    { id: 4,  name: 'נקבע ייעוץ',                  type: 'open', slaHours: null },
    { id: 5,  name: 'הגיע לייעוץ',                 type: 'open', slaHours: 24 },
    { id: 6,  name: 'נשלחה הצעת טיפול',            type: 'open', slaHours: 72 },
    { id: 7,  name: 'ממתין להחלטה',                type: 'open', slaHours: 168 },
    { id: 8,  name: 'נסגר לטיפול',                 type: 'won',  slaHours: null },
    { id: 9,  name: 'בטיפול / סדרת טיפולים',       type: 'won',  slaHours: null },
    { id: 10, name: 'לקוח לשימור / טיפול חוזר',    type: 'won',  slaHours: null },
    { id: 11, name: 'אבוד / לא רלוונטי',           type: 'lost', slaHours: null },
  ];

  const LOST_REASONS = ['המחיר גבוה מדי', 'בחרה קליניקה אחרת', 'לא מעוניינת יותר', 'אין מענה לאחר 5 ניסיונות', 'לא הזמן המתאים'];
  const TEMPLATES = [
    { key: 'new_lead',   name: 'פתיחה ללידה חדשה',       marketing: false, body: 'היי {name}, כאן {agent} מ-{clinic} 😊 קיבלתי את הפנייה שלך לגבי {treatment}. אשמח לענות על כל שאלה ולהציע מועד לייעוץ. מתי נוח לך לדבר?' },
    { key: 'no_answer',  name: 'אין מענה',               marketing: false, body: 'היי {name}, ניסיתי להשיג אותך בקשר ל-{treatment}. אשמח לדעת אם עדיין רלוונטי ומתי נוח שאחזור אלייך.' },
    { key: 'reminder',   name: 'תזכורת לייעוץ',           marketing: false, body: 'היי {name}, תזכורת לייעוץ שלנו {when} ב-{clinic}. נשמח לראותך! אם צריך לשנות, אפשר להשיב כאן.' },
    { key: 'proposal',   name: 'שליחת הצעת טיפול',        marketing: false, body: '{name}, תודה על הפגישה! מצרפת את ההצעה שדיברנו עליה: {treatment}. ההצעה בתוקף עד {validUntil}. אשמח לענות על כל שאלה.' },
    { key: 'followup',   name: 'פולואפ להצעה',            marketing: false, body: 'היי {name}, רציתי לבדוק אם היו לך שאלות לגבי ההצעה. אשמח לעזור להחליט ולקבוע מועד מתאים.' },
    { key: 'dormant',    name: 'חזרה ללקוחה רדומה',       marketing: true,  body: 'היי {name}, עבר זמן מאז הביקור האחרון ב-{clinic} ורציתי לשמוע מה שלומך. נשמח לקבוע לך טיפול המשך ל-{treatment}. מתי נוח לך?' },
  ];

  const HEB_FIRST = ['שירה','דנה','נועה','מיכל','רותם','ליאור','הילה','טל','ענת','יעל','אביגיל','מאיה','גל','שני','אור','אורית','קרן','ספיר','עדי','נטלי','אלה','רוני','דניאל','ליה','נועם','הודיה','יסמין','שקד','סתיו','אביה'];
  const HEB_LAST  = ['כהן','לוי','מזרחי','פרץ','ביטון','אברהם','דהן','אזולאי','גבאי','שני','אוחיון','חדד','אלמוג','שרעבי','טל','גולן','נחום','אשכנזי','בן דוד','שושן'];
  const usedPhones = new Set();
  function uniquePhone() { let p; do { p = fmtPhone(); } while (usedPhones.has(p)); usedPhones.add(p); return p; }
  function fullName() { return `${pick(HEB_FIRST)} ${pick(HEB_LAST)}`; }

  // ---------- Build leads (50) ----------
  const stageWeights = [
    { v: 1, w: 14 }, { v: 2, w: 10 }, { v: 3, w: 8 }, { v: 4, w: 7 }, { v: 5, w: 4 },
    { v: 6, w: 6 }, { v: 7, w: 8 },
    { v: 8, w: 5 }, { v: 9, w: 6 }, { v: 10, w: 5 }, // כבר סגורות — מזינות את בסיס הלקוחות וההכנסה
    { v: 11, w: 7 }, // אבוד
  ];

  const leads = [];
  for (let i = 1; i <= 50; i++) {
    const stageId = weightedPick(stageWeights);
    const stage = STAGES.find(s => s.id === stageId);
    const source = weightedPick(SOURCES.map(s => ({ v: s, w: s.w })));
    const treatment = pick(TREATMENTS);
    const createdDaysAgo = int(0, 25);
    const created_at = daysAgo(createdDaysAgo);
    const isSalesOwner = pick(STAFF.filter(s => s.role === 'sales' || s.role === 'manager'));

    let response_status = 'none', first_response_at = null, next_action = '', next_action_at = null, lost_reason = null;

    if (stage.id === 1) {
      response_status = 'none';
      // כוונה: חלק מהלידים החדשים "ישנים" מכוונה כדי להראות SLA שנפרץ
      const overdue = i % 6 === 0;
      next_action = 'לחזור ללידה (SLA 15 דק׳)';
      next_action_at = overdue ? daysAgo(0) : inDays(0);
      if (overdue) next_action_at = new Date(Date.now() - int(20, 240) * 60000); // חרג בין 20 דק' ל-4 שעות
    } else if (stage.id === 2) {
      response_status = 'none';
      next_action = 'פולואפ — עדיין ללא מענה';
      next_action_at = daysAgo(-int(0,1) * -1); // today-ish
      next_action_at = new Date(Date.now() - int(1, 30) * 3600000);
    } else if (stage.id === 3) {
      response_status = 'contacted';
      first_response_at = new Date(created_at.getTime() + int(3, 90) * 60000);
      next_action = 'לקבוע ייעוץ (48 ש׳)';
      next_action_at = inDays(int(0, 2));
    } else if (stage.id === 4) {
      response_status = 'replied';
      first_response_at = new Date(created_at.getTime() + int(3, 90) * 60000);
      next_action = 'תזכורת לייעוץ';
      next_action_at = inDays(int(1, 6));
    } else if (stage.id === 5) {
      response_status = 'replied';
      first_response_at = new Date(created_at.getTime() + int(3, 90) * 60000);
      next_action = 'לשלוח הצעת טיפול';
      next_action_at = daysAgo(0);
    } else if (stage.id === 6) {
      response_status = 'replied';
      first_response_at = new Date(created_at.getTime() + int(3, 90) * 60000);
      next_action = 'פולואפ להצעה';
      next_action_at = inDays(int(-2, 4)); // חלק בפיגור
    } else if (stage.id === 7) {
      response_status = 'replied';
      first_response_at = new Date(created_at.getTime() + int(3, 90) * 60000);
      next_action = 'לסגור החלטה';
      next_action_at = inDays(int(-3, 2));
    } else if ([8, 9, 10].includes(stage.id)) {
      response_status = 'replied';
      first_response_at = new Date(created_at.getTime() + int(3, 90) * 60000);
      next_action = null; next_action_at = null;
    } else if (stage.id === 11) {
      response_status = 'contacted';
      lost_reason = pick(LOST_REASONS);
      next_action = null; next_action_at = null;
    }

    leads.push({
      id: `L${String(i).padStart(3, '0')}`,
      full_name: fullName(),
      phone: uniquePhone(),
      email: rand() > 0.4 ? null : `client${i}@example.com`,
      source_id: source.id,
      treatment_id: treatment.id,
      stage_id: stage.id,
      owner_id: stage.id === 1 ? pick(STAFF.filter(s=>s.role==='sales')).id : isSalesOwner.id,
      expected_value: Math.round(treatment.price * (0.8 + rand() * 0.5) / 50) * 50,
      response_status,
      first_response_at,
      next_action,
      next_action_at,
      lost_reason,
      created_at,
      notes: pick(['מעוניינת, ביקשה לחזור בערב', 'שאלה לגבי מחיר', 'קיבלה המלצה מחברה', 'מתלבטת בין שני טיפולים', 'רוצה תור השבוע', '']),
    });
  }

  // ---------- Build customers (20) ----------
  // 12 "מומרים" מתוך הלידים שהגיעו לשלבי won, + 8 לקוחות ותיקים ללא ליד מקושר
  const wonLeads = leads.filter(l => [8, 9, 10].includes(l.stage_id));
  // אם אין מספיק לידים שנסגרו, נדחוף כמה מהלידים ל-won כדי להבטיח בסיס לקוחות תקין לדמו
  while (wonLeads.length < 12) {
    const cand = leads.find(l => l.stage_id === 7 && !wonLeads.includes(l));
    if (!cand) break;
    cand.stage_id = pick([8, 9, 10]);
    wonLeads.push(cand);
  }

  const customers = [];
  let cidx = 1;
  function addCustomer({ full_name, phone, treatment, lastVisitDays, leadRef }) {
    const id = `C${String(cidx++).padStart(3, '0')}`;
    const last_visit_at = daysAgo(lastVisitDays);
    const status = lastVisitDays >= 90 ? 'dormant' : 'active';
    const churn_risk = lastVisitDays >= 120;
    const totalSessions = treatment.sessions;
    const usedSessions = Math.min(totalSessions, int(0, totalSessions));
    const next_recommended_at = new Date(last_visit_at.getTime() + treatment.maintDays * 86400000);
    const isMember = rand() > 0.35;
    customers.push({
      id, full_name, phone,
      treatment_id: treatment.id,
      status, churn_risk,
      last_visit_at,
      next_recommended_at,
      package: { total_sessions: totalSessions, used_sessions: usedSessions },
      loyalty: isMember ? { is_member: true, tier: pick(['new','active','vip']), points: int(0, 900) } : { is_member: false },
      lead_id: leadRef ? leadRef.id : null,
      birthday_soon: rand() > 0.85,
    });
  }

  wonLeads.slice(0, 12).forEach(l => {
    const t = TREATMENTS.find(t => t.id === l.treatment_id);
    addCustomer({ full_name: l.full_name, phone: l.phone, treatment: t, lastVisitDays: int(1, 200), leadRef: l });
  });
  for (let i = customers.length; i < 20; i++) {
    addCustomer({ full_name: fullName(), phone: uniquePhone(), treatment: pick(TREATMENTS), lastVisitDays: int(1, 220), leadRef: null });
  }
  // להבטיח לפחות 12 "מגיע להן טיפול חוזר" (רדומות/מומלץ מעבר) לצורך "פעולות דחופות"
  let dueCount = customers.filter(c => c.next_recommended_at <= new Date()).length;
  let idx = 0;
  while (dueCount < 12 && idx < customers.length) {
    const c = customers[idx++];
    if (c.next_recommended_at > new Date()) { c.next_recommended_at = daysAgo(-int(0,5)); dueCount++; }
  }

  // ---------- Appointments (יומן) ----------
  const appointments = [];
  let apId = 1;
  leads.filter(l => [4,5].includes(l.stage_id)).forEach(l => {
    const therapist = pick(STAFF.filter(s => s.role === 'therapist'));
    const day = l.stage_id === 5 ? int(-6, -1) : int(0, 6);
    const start = inDays(day);
    appointments.push({
      id: `A${apId++}`, lead_id: l.id, customer_id: null,
      therapist_id: therapist.id, type: 'consultation',
      status: day < 0 ? pick(['completed','no_show','completed','completed']) : pick(['scheduled','confirmed']),
      starts_at: start, ends_at: new Date(start.getTime() + 30*60000),
    });
  });
  customers.slice(0, 8).forEach(c => {
    const therapist = pick(STAFF.filter(s => s.role === 'therapist'));
    const day = int(-3, 5);
    const start = inDays(day);
    appointments.push({
      id: `A${apId++}`, lead_id: null, customer_id: c.id,
      therapist_id: therapist.id, type: 'treatment',
      status: day < 0 ? 'completed' : pick(['scheduled','confirmed']),
      starts_at: start, ends_at: new Date(start.getTime() + 60*60000),
    });
  });
  appointments.sort((a,b) => a.starts_at - b.starts_at);

  // ---------- Proposals ----------
  const proposals = [];
  let prId = 1;
  leads.filter(l => [6,7,8,9,10].includes(l.stage_id)).forEach(l => {
    const t = TREATMENTS.find(t => t.id === l.treatment_id);
    const sentDaysAgo = int(1, 10);
    const status = [8,9,10].includes(l.stage_id) ? 'accepted' : (l.next_action_at && l.next_action_at < new Date() ? 'sent' : 'sent');
    proposals.push({
      id: `P${prId++}`, lead_id: l.id, treatment_id: t.id,
      sessions: t.sessions, price: l.expected_value, sent_at: daysAgo(sentDaysAgo),
      valid_until: inDays(14 - sentDaysAgo), status,
    });
  });

  // ---------- Tasks (נגזרות מהמצב) ----------
  const tasks = [];
  let tkId = 1;
  function addTask(t) { tasks.push({ id: `T${tkId++}`, status: 'open', ...t }); }

  leads.forEach(l => {
    if (!l.next_action_at) return;
    if ([8,9,10,11].includes(l.stage_id)) return;
    const overdue = l.next_action_at < new Date();
    let templateKey = 'no_answer';
    if (l.stage_id === 1) templateKey = 'new_lead';
    else if (l.stage_id === 4) templateKey = 'reminder';
    else if (l.stage_id === 6) templateKey = 'followup';
    addTask({
      lead_id: l.id, customer_id: null,
      assignee_id: l.owner_id,
      type: l.next_action,
      reason: overdue ? 'חרג מזמן היעד' : 'פעולה מתוכננת',
      due_at: l.next_action_at,
      template_key: templateKey,
    });
  });

  customers.filter(c => c.next_recommended_at <= new Date()).forEach(c => {
    addTask({
      lead_id: null, customer_id: c.id,
      assignee_id: pick(STAFF.filter(s => s.role === 'sales')).id,
      type: 'הצעת טיפול חוזר / חידוש סדרה',
      reason: c.status === 'dormant' ? 'לקוחה רדומה' : 'מגיע לה טיפול תחזוקה',
      due_at: daysAgo(-int(0,2)),
      template_key: 'dormant',
    });
  });

  appointments.filter(a => a.status === 'no_show').forEach(a => {
    addTask({
      lead_id: a.lead_id, customer_id: a.customer_id,
      assignee_id: pick(STAFF.filter(s => s.role === 'sales')).id,
      type: 'יצירת קשר לאחר אי-הגעה וקביעה מחדש',
      reason: 'לא הגיעה לייעוץ',
      due_at: daysAgo(0),
      template_key: 'no_answer',
    });
  });

  // ---------- Helper lookups exposed ----------
  function leadById(id) { return leads.find(l => l.id === id); }
  function customerById(id) { return customers.find(c => c.id === id); }
  function staffById(id) { return STAFF.find(s => s.id === id); }
  function sourceById(id) { return SOURCES.find(s => s.id === id); }
  function treatmentById(id) { return TREATMENTS.find(t => t.id === id); }
  function stageById(id) { return STAGES.find(s => s.id === id); }

  global.DEMO = {
    STAFF, SOURCES, TREATMENTS, STAGES, TEMPLATES, LOST_REASONS,
    leads, customers, appointments, proposals, tasks,
    leadById, customerById, staffById, sourceById, treatmentById, stageById,
    clinicName: 'קליניקת אקווה אסתטיק (דמו)',
  };
})(window);
