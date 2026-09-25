/* Clinic Revenue OS — סיור מודרך למכירה (Sales guided tour) */
(function () {
  'use strict';
  const $ = (sel) => document.querySelector(sel);

  function kpi() { return window.CRM.computeKpis(); }

  // כל שלב: before() מכין את המסך, target() מחזיר את האלמנט להדגשה, title/text (יכול להיות פונקציה לטקסט דינמי)
  const STEPS = [
    {
      before: () => window.CRM.go('dashboard'),
      target: () => $('#kpi-grid'),
      title: 'הכול במקום אחד, בלי לחפש ב-WhatsApp',
      text: () => `זה הדשבורד שהקליניקה רואה כל בוקר. ${kpi().newLeads} לידים נכנסו החודש, ${kpi().unanswered} מהם עדיין ללא מענה — ובעלת הקליניקה יודעת את זה תוך שנייה, בלי לשאול את הצוות.`,
    },
    {
      before: () => window.CRM.go('dashboard'),
      target: () => $('#urgent-list'),
      title: '"מה עושים היום?" — תשובה, לא ניחוש',
      text: () => `במקום לזכור מי חיכה למי, המערכת עצמה אומרת בדיוק מה דחוף: לידים ללא מענה, הצעות תקועות, אי-הגעות ולקוחות שמגיע להן לחזור. כל שורה כאן היא כסף שממתין להיסגר.`,
    },
    {
      before: () => window.CRM.go('leads'),
      target: () => document.querySelector('#kanban'),
      title: 'כל ליד, בכל שלב, בלי לאבד אף אחד',
      text: () => `הלידים מכל הערוצים — אינסטגרם, פייסבוק, גוגל, הפניות — נכנסים לצנרת מכירה אחת. גרירה בין העמודות מעדכנת את השלב, ולכל ליד יש תמיד "פעולה הבאה" מוגדרת.`,
    },
    {
      before: () => {
        window.CRM.go('leads');
        return new Promise((res) => setTimeout(() => {
          const card = document.querySelector('#kanban .lead-card');
          if (card) card.click();
          res();
        }, 50));
      },
      target: () => $('#modal'),
      title: 'כרטיס לקוחה אחד, כל הסיפור שלה',
      text: () => `בלחיצה אחת רואים את כל מסע הלקוחה: מאיפה הגיעה, מה סוכם, מה השלב הבא — וכפתור WhatsApp עם הודעה מוכנה לשליחה, בלי לנסח מחדש כל פעם.`,
      after: () => document.getElementById('modal-backdrop').classList.remove('open'),
    },
    {
      before: () => window.CRM.go('tasks', 'overdue'),
      target: () => $('#task-list'),
      title: 'הצוות עובד מרשימה, לא מהזיכרון',
      text: () => `כל משימה מגיעה עם סיבה, יעד וטיוטת הודעה מוכנה. איש הצוות לוחץ "פתח WhatsApp", שולח, ומסמן "טופל" — בלי לפתוח שום מקום אחר.`,
    },
    {
      before: () => window.CRM.go('calendar'),
      target: () => $('#calendar-list'),
      title: 'ייעוצים וטיפולים באותה מערכת',
      text: () => `היומן מקושר ישירות ללידים וללקוחות: "לא הגיעה" יוצרת אוטומטית משימת חזרה, ו"הגיעה לייעוץ" פותחת משימה לשליחת הצעת טיפול — בלי לזכור לעשות את זה ידנית.`,
    },
    {
      before: () => window.CRM.go('revenue'),
      target: () => $('#funnel'),
      title: 'רואים בדיוק איפה הכסף נופל',
      text: () => `ה-Funnel מראה כמה לידים הופכים לייעוץ, לייעוץ שמגיעים אליו, ולעסקה סגורה — עם אחוזי המרה אמיתיים בכל שלב, לא הערכות.`,
    },
    {
      before: () => window.CRM.go('revenue'),
      target: () => $('#at-risk'),
      title: '"כסף בסיכון" — לפני שהוא הולך לאיבוד',
      text: () => `רשימה אחת של הצעות שעומדות לפוג, לידים שלא נענו ולקוחות בסיכון נטישה. זה ההבדל בין "אולי שכחנו מישהי" לבין לדעת בדיוק את מי להציל היום.`,
    },
    {
      before: () => window.CRM.go('dashboard'),
      target: () => $('#kpi-grid'),
      title: 'זהו. עכשיו זה תלוי בכם',
      text: () => `זה כל מה שצריך כדי שבעלת הקליניקה תגיד בסוף היום: "אני יודעת בדיוק למי הצוות צריך לחזור, כמה כסף בצנרת, ואיפה אני מאבדת לקוחות." רוצים לנסות עם הנתונים של הקליניקה שלכם?`,
    },
  ];

  let idx = 0;

  function ensureOverlay() {
    if ($('#tour-overlay')) return;
    const ov = document.createElement('div');
    ov.id = 'tour-overlay';
    ov.innerHTML = `
      <div id="tour-dim"></div>
      <div id="tour-spot"></div>
      <div id="tour-card">
        <div class="step-no"></div>
        <h4></h4>
        <p></p>
        <div class="tour-nav">
          <div class="dots"></div>
          <div class="tour-btns">
            <button class="btn btn-sm" id="tour-skip">דלג</button>
            <button class="btn btn-sm" id="tour-prev">הקודם</button>
            <button class="btn btn-sm btn-primary" id="tour-next">הבא</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(ov);
    $('#tour-skip').addEventListener('click', endTour);
    $('#tour-prev').addEventListener('click', () => showStep(idx - 1));
    $('#tour-next').addEventListener('click', () => {
      if (idx >= STEPS.length - 1) { endTour(); return; }
      showStep(idx + 1);
    });
    $('#tour-dim').addEventListener('click', endTour);
    window.addEventListener('resize', () => { if ($('#tour-overlay').classList.contains('open')) positionFor(STEPS[idx]); });
  }

  function startTour() {
    ensureOverlay();
    idx = 0;
    $('#tour-overlay').classList.add('open');
    showStep(0);
  }
  function endTour() {
    const overlay = $('#tour-overlay');
    if (overlay) overlay.classList.remove('open');
    if (STEPS[idx] && STEPS[idx].after) STEPS[idx].after();
  }

  async function showStep(i) {
    if (i < 0) return;
    if (STEPS[idx] && STEPS[idx].after && idx !== i) STEPS[idx].after();
    idx = i;
    const step = STEPS[idx];
    if (step.before) await step.before();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    positionFor(step);
    $('#tour-card .step-no').textContent = `שלב ${idx + 1} מתוך ${STEPS.length}`;
    $('#tour-card h4').textContent = step.title;
    $('#tour-card p').textContent = typeof step.text === 'function' ? step.text() : step.text;
    $('#tour-card .dots').innerHTML = STEPS.map((_, j) => `<span class="${j === idx ? 'active' : ''}"></span>`).join('');
    $('#tour-prev').style.visibility = idx === 0 ? 'hidden' : 'visible';
    $('#tour-next').textContent = idx === STEPS.length - 1 ? 'סיום' : 'הבא';
  }

  function positionFor(step) {
    const target = step.target ? step.target() : null;
    const spot = $('#tour-spot');
    const card = $('#tour-card');
    if (!target) { spot.style.display = 'none'; centerCard(card); return; }
    target.scrollIntoView({ block: 'center', behavior: 'instant' in document.documentElement.style ? 'auto' : 'auto' });
    const r = target.getBoundingClientRect();
    spot.style.display = 'block';
    spot.style.top = (r.top - 8) + 'px';
    spot.style.left = (r.left - 8) + 'px';
    spot.style.width = (r.width + 16) + 'px';
    spot.style.height = (r.height + 16) + 'px';

    const cardW = 340, margin = 16;
    let top = r.bottom + margin;
    let left = r.left + r.width / 2 - cardW / 2;
    if (top + 200 > window.innerHeight) top = Math.max(margin, r.top - 220);
    left = Math.min(Math.max(margin, left), window.innerWidth - cardW - margin);
    card.style.top = top + 'px';
    card.style.left = left + 'px';
  }
  function centerCard(card) {
    card.style.top = '40%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%,-50%)';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const launch = document.getElementById('tour-launch-btn');
    if (launch) launch.addEventListener('click', startTour);
    // הפעלה אוטומטית קצרה בטעינה ראשונה של הדמו, לאחר רגע התארגנות
    setTimeout(() => {
      if (!localStorage.getItem('crm_tour_seen')) {
        try { localStorage.setItem('crm_tour_seen', '1'); } catch (e) {}
      }
    }, 500);
  });
  window.startSalesTour = startTour;
})();
