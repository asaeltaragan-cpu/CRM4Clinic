/* Clinic Revenue OS — Demo app rendering */
(function () {
  'use strict';
  const D = window.DEMO;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // ---------------- helpers ----------------
  function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' }); }
  function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  function fmtTime(d) { return new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }); }
  function fmtMoney(n) { return '₪' + Math.round(n).toLocaleString('he-IL'); }
  function relTime(d) {
    if (!d) return '';
    const diffMs = new Date(d) - new Date();
    const abs = Math.abs(diffMs);
    const mins = Math.round(abs / 60000);
    const label = mins < 60 ? `${mins} דק׳` : (mins < 60 * 24 ? `${Math.round(mins / 60)} שעות` : `${Math.round(mins / 1440)} ימים`);
    return diffMs < 0 ? `לפני ${label}` : `בעוד ${label}`;
  }
  function isOverdue(d) { return d && new Date(d) < new Date(); }
  function waLink(phone, text) {
    const p = phone.replace(/[^0-9]/g, '').replace(/^0/, '972');
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
  }
  function renderTemplate(body, vars) {
    return body.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
  }
  function draftFor(templateKey, ctx) {
    const tpl = D.TEMPLATES.find(t => t.key === templateKey) || D.TEMPLATES[0];
    const vars = {
      name: ctx.name, clinic: D.clinicName.replace(' (דמו)', ''), agent: ctx.agent || 'הצוות',
      treatment: ctx.treatment || '', when: ctx.when || 'בקרוב', validUntil: ctx.validUntil || '',
    };
    return { text: renderTemplate(tpl.body, vars), marketing: tpl.marketing, name: tpl.name };
  }
  function avatarInitials(name) { return name.split(' ').map(p => p[0]).slice(0, 2).join(''); }
  function staffAvatar(staff, size = 26) {
    if (!staff) return '';
    return `<span class="avatar" style="width:${size}px;height:${size}px;background:${staff.avatarColor}">${avatarInitials(staff.name)}</span>`;
  }
  function stageColorClass(lead) {
    if (lead.stage_id === 1 && isOverdue(lead.next_action_at)) return 'red';
    if (lead.next_action_at && isOverdue(lead.next_action_at)) return 'orange';
    return null;
  }

  // ---------------- KPI computation ----------------
  function computeKpis() {
    const leads = D.leads;
    const openLeads = leads.filter(l => D.stageById(l.stage_id).type === 'open');
    const unanswered = leads.filter(l => l.response_status === 'none');
    const respTimes = leads.filter(l => l.first_response_at).map(l => (new Date(l.first_response_at) - new Date(l.created_at)) / 60000);
    const avgResponse = respTimes.length ? Math.round(respTimes.reduce((a, b) => a + b, 0) / respTimes.length) : 0;
    const consultationsBooked = leads.filter(l => l.stage_id >= 4).length;
    const arrivedConsult = D.appointments.filter(a => a.type === 'consultation' && a.status === 'completed').length;
    const noShow = D.appointments.filter(a => a.type === 'consultation' && a.status === 'no_show').length;
    const consultTotal = arrivedConsult + noShow;
    const attendanceRate = consultTotal ? Math.round((arrivedConsult / consultTotal) * 100) : 0;
    const openProposals = D.proposals.filter(p => p.status === 'sent');
    const openProposalsValue = openProposals.reduce((s, p) => s + p.price, 0);
    const wonThisMonth = leads.filter(l => [8, 9, 10].includes(l.stage_id)).length;
    const expectedRevenue = openProposalsValue;
    const returningDue = D.customers.filter(c => c.next_recommended_at <= new Date()).length;
    const overdueTasks = D.tasks.filter(t => t.status === 'open' && isOverdue(t.due_at)).length;
    const bySource = {};
    leads.filter(l => [8, 9, 10].includes(l.stage_id)).forEach(l => {
      const s = D.sourceById(l.source_id).name;
      bySource[s] = (bySource[s] || 0) + l.expected_value;
    });
    const topSource = Object.entries(bySource).sort((a, b) => b[1] - a[1])[0] || ['—', 0];

    return {
      newLeads: leads.length, unanswered: unanswered.length, avgResponse,
      consultationsBooked, attendanceRate, openProposals: openProposals.length,
      openProposalsValue, wonThisMonth, expectedRevenue, returningDue, overdueTasks,
      topSource: { name: topSource[0], value: topSource[1] },
      noShow,
    };
  }

  // ---------------- Dashboard ----------------
  function renderDashboard() {
    const k = computeKpis();
    const cards = [
      ['לידים חדשים (30 יום)', k.newLeads, ''],
      ['🔴 לידים ללא מענה', k.unanswered, 'red'],
      ['זמן תגובה ממוצע', k.avgResponse + ' דק׳', ''],
      ['ייעוצים שנקבעו', k.consultationsBooked, ''],
      ['שיעור הגעה לייעוץ', k.attendanceRate + '%', k.attendanceRate < 70 ? 'orange' : 'green'],
      ['הצעות טיפול פתוחות', k.openProposals, ''],
      ['ערך הזדמנויות פתוחות', fmtMoney(k.openProposalsValue), ''],
      ['עסקאות שנסגרו', k.wonThisMonth, 'green'],
      ['הכנסה צפויה', fmtMoney(k.expectedRevenue), ''],
      ['לקוחות לטיפול חוזר', k.returningDue, 'orange'],
      ['🔴 משימות באיחור', k.overdueTasks, 'red'],
      ['מקור מוביל (הכנסה)', k.topSource.name, 'green'],
    ];
    $('#kpi-grid').innerHTML = cards.map(([label, value, cls]) => `
      <div class="kpi-card"><div class="label">${label}</div><div class="value ${cls}">${value}</div></div>
    `).join('');

    const unansweredLeads = D.leads.filter(l => l.response_status === 'none' && l.stage_id === 1);
    const openFollowless = D.proposals.filter(p => p.status === 'sent');
    const noShows = D.appointments.filter(a => a.status === 'no_show');
    const dueCustomers = D.customers.filter(c => c.next_recommended_at <= new Date());
    const overdueTasks = D.tasks.filter(t => t.status === 'open' && isOverdue(t.due_at));

    const urgent = [
      { dot: 'red', text: `${unansweredLeads.length} לידים ללא מענה`, go: () => go('leads') },
      { dot: 'orange', text: `${openFollowless.length} הצעות טיפול ללא פולואפ`, go: () => go('tasks', 'proposals') },
      { dot: 'orange', text: `${noShows.length} לקוחות שלא הגיעו לייעוץ`, go: () => go('calendar') },
      { dot: 'blue', text: `${dueCustomers.length} לקוחות שמגיע להן טיפול המשך`, go: () => go('tasks', 'dormant') },
      { dot: 'red', text: `${overdueTasks.length} משימות באיחור`, go: () => go('tasks', 'overdue') },
    ];
    $('#urgent-list').innerHTML = urgent.map(u => `
      <div class="urgent-row" data-go="${u.text}"><span class="dot ${u.dot}"></span><span class="txt">${u.text}</span><span class="chev">›</span></div>
    `).join('');
    $$('#urgent-list .urgent-row').forEach((row, i) => row.addEventListener('click', urgent[i].go));
  }

  // ---------------- Leads: Kanban ----------------
  let leadFilters = { source: '', owner: '' };
  function renderLeadsKanban() {
    const stagesToShow = D.STAGES.filter(s => s.id <= 7 || s.id === 11);
    let leads = D.leads;
    if (leadFilters.source) leads = leads.filter(l => l.source_id === leadFilters.source);
    if (leadFilters.owner) leads = leads.filter(l => l.owner_id === leadFilters.owner);

    $('#kanban').innerHTML = stagesToShow.map(stage => {
      const items = leads.filter(l => l.stage_id === stage.id).sort((a, b) => (a.next_action_at||0) - (b.next_action_at||0));
      return `
      <div class="kanban-col" data-stage="${stage.id}">
        <header><span>${stage.name}</span><span class="count">${items.length}</span></header>
        <div class="kanban-cards">
          ${items.map(l => leadCardHtml(l)).join('') || '<div class="empty-hint" style="padding:16px">אין לידים</div>'}
        </div>
      </div>`;
    }).join('');

    $$('#kanban .lead-card').forEach(card => card.addEventListener('click', () => openLeadModal(card.dataset.id)));
  }
  function leadCardHtml(l) {
    const src = D.sourceById(l.source_id);
    const cls = stageColorClass(l);
    return `
      <div class="lead-card" data-id="${l.id}">
        <div class="name">${cls ? `<span class="dot ${cls}"></span>` : ''}${l.full_name}</div>
        <div class="meta">${src.icon} ${src.name} · ${D.treatmentById(l.treatment_id).name}</div>
        <div class="foot">
          <span class="value">${fmtMoney(l.expected_value)}</span>
          ${l.next_action_at ? `<span class="pill ${isOverdue(l.next_action_at) ? 'red' : 'orange'}">${relTime(l.next_action_at)}</span>` : ''}
        </div>
      </div>`;
  }
  function renderLeadsTable() {
    const rows = D.leads.map(l => {
      const src = D.sourceById(l.source_id);
      const owner = D.staffById(l.owner_id);
      const stage = D.stageById(l.stage_id);
      return `<tr data-id="${l.id}">
        <td>${isOverdue(l.next_action_at) ? '🔴 ' : ''}${l.full_name}</td>
        <td>${l.phone}</td>
        <td>${src.icon} ${src.name}</td>
        <td>${stage.name}</td>
        <td>${owner ? owner.name : '—'}</td>
        <td>${l.next_action || '—'}</td>
        <td>${fmtMoney(l.expected_value)}</td>
      </tr>`;
    }).join('');
    $('#leads-table-wrap').innerHTML = `
      <table class="data-table">
        <thead><tr><th>שם</th><th>טלפון</th><th>מקור</th><th>שלב</th><th>אחראי/ת</th><th>פעולה הבאה</th><th>שווי</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    $$('#leads-table-wrap tbody tr').forEach(tr => tr.addEventListener('click', () => openLeadModal(tr.dataset.id)));
  }
  function renderLeadsFilters() {
    $('#filter-source').innerHTML = `<option value="">כל המקורות</option>` + D.SOURCES.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
    $('#filter-owner').innerHTML = `<option value="">כל הצוות</option>` + D.STAFF.filter(s => s.role !== 'therapist').map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  }
  function renderLeadsScreen() {
    renderLeadsFilters();
    renderLeadsKanban();
    renderLeadsTable();
  }

  // ---------------- Lead / Customer modal ----------------
  let currentEntity = null; // {type:'lead'|'customer', id}
  function openLeadModal(id) { currentEntity = { type: 'lead', id }; renderModal(); $('#modal-backdrop').classList.add('open'); }
  function openCustomerModal(id) { currentEntity = { type: 'customer', id }; renderModal(); $('#modal-backdrop').classList.add('open'); }
  function closeModal() { $('#modal-backdrop').classList.remove('open'); }

  function renderModal() {
    if (currentEntity.type === 'lead') renderLeadModal(D.leadById(currentEntity.id));
    else renderCustomerModal(D.customerById(currentEntity.id));
  }

  const JOURNEY_STEPS = ['מקור', 'תקשורת', 'משימה', 'ייעוץ', 'הצעה', 'תשלום', 'טיפול', 'פולואפ', 'חידוש'];
  function journeyHtml(activeIdx) {
    return `<div class="journey">${JOURNEY_STEPS.map((s, i) => `
      <span class="node ${i < activeIdx ? 'done' : ''} ${i === activeIdx ? 'now' : ''}" title="${s}"></span>${i < JOURNEY_STEPS.length - 1 ? '<span>—</span>' : ''}
    `).join('')}</div>`;
  }

  function renderLeadModal(l) {
    const stage = D.stageById(l.stage_id);
    const owner = D.staffById(l.owner_id);
    const src = D.sourceById(l.source_id);
    const treatment = D.treatmentById(l.treatment_id);
    const activeIdx = Math.min(l.stage_id - 1, 8);

    $('#modal').innerHTML = `
      <div class="modal-head">
        <div class="info">
          <h2>${l.full_name}</h2>
          <div class="sub">${l.phone} · ${src.icon} ${src.name} · ${treatment.name}</div>
        </div>
        <button class="close" id="modal-close">✕</button>
      </div>
      <div class="quickbar">
        <div class="qitem">סטטוס<b>${stage.name}</b></div>
        <div class="qitem">אחראי/ת<b>${owner ? owner.name : '—'}</b></div>
        <div class="qitem">פעולה הבאה<b>${l.next_action || '—'} ${l.next_action_at ? '· ' + relTime(l.next_action_at) : ''}</b></div>
        <div class="qitem">שווי צפוי<b>${fmtMoney(l.expected_value)}</b></div>
      </div>
      <div class="modal-actions">
        <a class="btn btn-sm btn-wa" target="_blank" href="${waLink(l.phone, draftFor(l.stage_id===1?'new_lead':'no_answer', {name:l.full_name, treatment: treatment.name, agent: owner?owner.name:''}).text)}">💬 WhatsApp</a>
        <button class="btn btn-sm" id="lm-schedule">📅 קביעת ייעוץ</button>
        <button class="btn btn-sm" id="lm-task">✅ משימה</button>
        <button class="btn btn-sm" id="lm-stage">🔄 שינוי שלב</button>
      </div>
      <div class="tabs" id="lead-tabs">
        ${['סיכום','ציר זמן','משימות','הצעות'].map((t,i)=>`<button class="tab-btn ${i===0?'active':''}" data-tab="${i}">${t}</button>`).join('')}
      </div>
      <div class="tab-panels" id="lead-tab-panels"></div>
    `;
    $('#modal-close').addEventListener('click', closeModal);
    ['lm-schedule','lm-task','lm-stage'].forEach(id => $('#'+id) && $('#'+id).addEventListener('click', () => toast('פעולה זמינה בגרסת המוצר המלאה')));

    const panels = {
      0: `${journeyHtml(activeIdx)}<p><b>שירות מתעניינת:</b> ${treatment.name}</p><p><b>הערה אחרונה:</b> ${l.notes || '—'}</p>
          ${l.lost_reason ? `<p style="color:var(--red)"><b>סיבת אובדן:</b> ${l.lost_reason}</p>` : ''}`,
      1: leadTimelineHtml(l),
      2: taskListHtmlForEntity('lead', l.id) ,
      3: proposalsHtmlForLead(l.id),
    };
    $$('#lead-tabs .tab-btn').forEach(btn => btn.addEventListener('click', () => {
      $$('#lead-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#lead-tab-panels').innerHTML = panels[btn.dataset.tab];
    }));
    $('#lead-tab-panels').innerHTML = panels[0];
  }

  function leadTimelineHtml(l) {
    const items = [{ t: l.created_at, x: `🧲 ליד נוצר (${D.sourceById(l.source_id).name})` }];
    if (l.first_response_at) items.push({ t: l.first_response_at, x: '📞 יצירת קשר ראשונה תועדה' });
    items.push({ t: l.created_at, x: `📌 שלב נוכחי: ${D.stageById(l.stage_id).name}` });
    if (l.lost_reason) items.push({ t: l.next_action_at || l.created_at, x: `⛔ סומן כאבוד — ${l.lost_reason}` });
    items.sort((a,b)=> new Date(a.t)-new Date(b.t));
    return items.map(i => `<div class="timeline-item"><div class="t">${fmtDateTime(i.t)}</div><div>${i.x}</div></div>`).join('');
  }
  function proposalsHtmlForLead(leadId) {
    const props = D.proposals.filter(p => p.lead_id === leadId);
    if (!props.length) return `<div class="empty-hint">אין הצעות טיפול עדיין</div>`;
    return props.map(p => {
      const t = D.treatmentById(p.treatment_id);
      return `<div class="timeline-item"><div class="t">${fmtDate(p.sent_at)}</div><div><b>${t.name}</b> · ${p.sessions} מפגשים · ${fmtMoney(p.price)} · בתוקף עד ${fmtDate(p.valid_until)} · <span class="pill ${p.status==='accepted'?'':'orange'}">${p.status==='accepted'?'אושרה':'ממתינה'}</span></div></div>`;
    }).join('');
  }
  function taskListHtmlForEntity(type, id) {
    const key = type === 'lead' ? 'lead_id' : 'customer_id';
    const items = D.tasks.filter(t => t[key] === id);
    if (!items.length) return `<div class="empty-hint">אין משימות פתוחות</div>`;
    return items.map(t => `<div class="timeline-item"><div class="t">${fmtDateTime(t.due_at)}</div><div>${t.type} ${t.status==='done'?'✅':''}</div></div>`).join('');
  }

  function renderCustomerModal(c) {
    const treatment = D.treatmentById(c.treatment_id);
    const pct = Math.round((c.package.used_sessions / c.package.total_sessions) * 100);
    $('#modal').innerHTML = `
      <div class="modal-head">
        <div class="info">
          <h2>${c.full_name} ${c.loyalty.is_member ? `<span class="pill ${c.loyalty.tier==='vip'?'orange':''}">${c.loyalty.tier==='vip'?'VIP':'חברת מועדון'}</span>`:''}</h2>
          <div class="sub">${c.phone} · ${treatment.name} · ${c.status === 'dormant' ? '🔴 רדומה' : '🟢 פעילה'}</div>
        </div>
        <button class="close" id="modal-close">✕</button>
      </div>
      <div class="quickbar">
        <div class="qitem">ביקור אחרון<b>${fmtDate(c.last_visit_at)}</b></div>
        <div class="qitem">מומלץ לחזור<b>${fmtDate(c.next_recommended_at)} · ${relTime(c.next_recommended_at)}</b></div>
        <div class="qitem">חבילה<b>${c.package.used_sessions}/${c.package.total_sessions} מפגשים</b></div>
        <div class="qitem">נקודות נאמנות<b>${c.loyalty.is_member ? c.loyalty.points : '—'}</b></div>
      </div>
      <div class="modal-actions">
        <a class="btn btn-sm btn-wa" target="_blank" href="${waLink(c.phone, draftFor('dormant', {name:c.full_name, treatment: treatment.name}).text)}">💬 WhatsApp — חזרה לטיפול</a>
        <button class="btn btn-sm" id="lm-schedule2">📅 קביעת טיפול</button>
      </div>
      <div class="tab-panels">
        <div class="bar-row"><span class="label">התקדמות חבילה</span><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div><span class="val">${pct}%</span></div>
        ${c.birthday_soon ? '<p>🎂 יום הולדת מתקרב — הטבת מועדון זמינה</p>' : ''}
        ${c.churn_risk ? '<p style="color:var(--red)">⚠️ לקוחה בסיכון נטישה — לא ביקרה זמן רב</p>' : ''}
        <h4 style="margin-top:16px">משימות פתוחות</h4>
        ${taskListHtmlForEntity('customer', c.id)}
      </div>
    `;
    $('#modal-close').addEventListener('click', closeModal);
    $('#lm-schedule2') && $('#lm-schedule2').addEventListener('click', () => toast('פעולה זמינה בגרסת המוצר המלאה'));
  }

  // ---------------- Tasks ----------------
  const TASK_BUCKETS = [
    { key: 'overdue', label: '🔴 באיחור' },
    { key: 'today', label: 'להיום' },
    { key: 'tomorrow', label: 'מחר' },
    { key: 'week', label: 'השבוע' },
    { key: 'dormant', label: 'לקוחות רדומים' },
    { key: 'proposals', label: 'הצעות פתוחות' },
  ];
  let currentBucket = 'overdue';
  function bucketOf(task) {
    if (task.reason === 'לקוחה רדומה' || task.reason === 'מגיע לה טיפול תחזוקה') return 'dormant';
    if (task.template_key === 'followup') return 'proposals';
    const d = new Date(task.due_at); const now = new Date();
    if (d < now && d.toDateString() !== now.toDateString()) return 'overdue';
    if (isOverdue(task.due_at) && d.toDateString() === now.toDateString() && d < now) return 'overdue';
    if (d.toDateString() === now.toDateString()) return d < now ? 'overdue' : 'today';
    const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
    if (d.toDateString() === tmr.toDateString()) return 'tomorrow';
    return 'week';
  }
  function renderTasksScreen(bucket) {
    if (bucket) currentBucket = bucket;
    $('#task-tabs').innerHTML = TASK_BUCKETS.map(b => {
      const count = D.tasks.filter(t => t.status === 'open' && bucketOf(t) === b.key).length;
      return `<button class="task-tab ${b.key === currentBucket ? 'active' : ''}" data-bucket="${b.key}">${b.label} (${count})</button>`;
    }).join('');
    $$('#task-tabs .task-tab').forEach(btn => btn.addEventListener('click', () => renderTasksScreen(btn.dataset.bucket)));

    const items = D.tasks.filter(t => t.status === 'open' && bucketOf(t) === currentBucket)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
    $('#task-list').innerHTML = items.map(t => taskCardHtml(t)).join('') || `<div class="empty-hint">אין משימות בקטגוריה זו 🎉</div>`;

    $$('#task-list [data-complete]').forEach(b => b.addEventListener('click', () => { completeTask(b.dataset.complete); }));
    $$('#task-list [data-snooze]').forEach(b => b.addEventListener('click', () => { snoozeTask(b.dataset.snooze); }));
    $$('#task-list [data-irrelevant]').forEach(b => b.addEventListener('click', () => { irrelevantTask(b.dataset.irrelevant); }));
    $$('#task-list .task-card .name').forEach(n => n.addEventListener('click', () => {
      const t = D.tasks.find(x => x.id === n.dataset.id);
      if (t.lead_id) openLeadModal(t.lead_id); else if (t.customer_id) openCustomerModal(t.customer_id);
    }));
  }
  function taskEntityName(t) {
    if (t.lead_id) return D.leadById(t.lead_id).full_name;
    if (t.customer_id) return D.customerById(t.customer_id).full_name;
    return '—';
  }
  function taskEntityPhone(t) {
    if (t.lead_id) return D.leadById(t.lead_id).phone;
    if (t.customer_id) return D.customerById(t.customer_id).phone;
    return '';
  }
  function taskCardHtml(t) {
    const assignee = D.staffById(t.assignee_id);
    const name = taskEntityName(t);
    const phone = taskEntityPhone(t);
    const treatmentName = t.lead_id ? D.treatmentById(D.leadById(t.lead_id).treatment_id).name : (t.customer_id ? D.treatmentById(D.customerById(t.customer_id).treatment_id).name : '');
    const draft = draftFor(t.template_key, { name, treatment: treatmentName, agent: assignee ? assignee.name : '' });
    return `
      <div class="task-card">
        <div class="top">
          <div>
            <div class="name" data-id="${t.id}" style="cursor:pointer">${isOverdue(t.due_at) ? '🔴 ' : ''}${name}</div>
            <div class="reason">${t.type} · ${t.reason}</div>
          </div>
          <div style="text-align:left">
            ${staffAvatar(assignee)}
            <div style="font-size:11px;color:var(--muted);margin-top:4px">${relTime(t.due_at)}</div>
          </div>
        </div>
        <div class="draft">${draft.text}${draft.marketing ? ' <span class="pill orange">שיווקי — כפוף להסכמה</span>' : ''}</div>
        <div class="task-actions">
          <a class="btn btn-sm btn-wa" target="_blank" href="${waLink(phone, draft.text)}">💬 פתח WhatsApp</a>
          <button class="btn btn-sm btn-done" data-complete="${t.id}">✔ סמן טופל</button>
          <button class="btn btn-sm btn-snooze" data-snooze="${t.id}">⏰ דחה</button>
          <button class="btn btn-sm btn-irrelevant" data-irrelevant="${t.id}">✖ לא רלוונטי</button>
        </div>
      </div>`;
  }
  function completeTask(id) { const t = D.tasks.find(x => x.id === id); t.status = 'done'; toast('המשימה סומנה כטופלה ✔'); renderAll(); }
  function snoozeTask(id) { const t = D.tasks.find(x => x.id === id); t.due_at = new Date(Date.now() + 86400000); toast('המשימה נדחתה ליום הבא'); renderAll(); }
  function irrelevantTask(id) { const t = D.tasks.find(x => x.id === id); t.status = 'irrelevant'; toast('המשימה סומנה כלא רלוונטית'); renderAll(); }

  // ---------------- Calendar ----------------
  function renderCalendar() {
    const byDay = {};
    D.appointments.forEach(a => {
      const key = new Date(a.starts_at).toDateString();
      (byDay[key] = byDay[key] || []).push(a);
    });
    const days = Object.keys(byDay).sort((a, b) => new Date(a) - new Date(b));
    $('#calendar-list').innerHTML = days.map(day => {
      const items = byDay[day].sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
      const label = new Date(day).toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: '2-digit' });
      return `<div class="cal-day"><h4>${label}</h4>${items.map(a => calSlotHtml(a)).join('')}</div>`;
    }).join('') || '<div class="empty-hint">אין פגישות</div>';

    $$('#calendar-list .cal-slot').forEach(row => row.addEventListener('click', () => {
      const a = D.appointments.find(x => x.id === row.dataset.id);
      if (a.lead_id) openLeadModal(a.lead_id); else if (a.customer_id) openCustomerModal(a.customer_id);
    }));
  }
  function calSlotHtml(a) {
    const therapist = D.staffById(a.therapist_id);
    const name = a.lead_id ? D.leadById(a.lead_id).full_name : D.customerById(a.customer_id).full_name;
    const typeLabel = { consultation: 'ייעוץ', treatment: 'טיפול' }[a.type] || a.type;
    const statusLabel = { scheduled: 'נקבע', confirmed: 'אושר', completed: 'התקיים', no_show: 'לא הגיע', cancelled: 'בוטל' }[a.status];
    return `<div class="cal-slot" data-id="${a.id}">
      <div class="time">${fmtTime(a.starts_at)}</div>
      <div class="details"><div class="n">${name} — ${typeLabel}</div><div class="m">מטפלת: ${therapist ? therapist.name : '—'}</div></div>
      <span class="status-chip ${a.status}">${statusLabel}</span>
    </div>`;
  }

  // ---------------- Revenue ----------------
  function renderRevenue() {
    const total = D.leads.length;
    const contacted = D.leads.filter(l => l.response_status !== 'none').length;
    const booked = D.leads.filter(l => l.stage_id >= 4).length;
    const arrived = D.appointments.filter(a => a.type === 'consultation' && a.status === 'completed').length;
    const proposalSent = D.proposals.length;
    const won = D.leads.filter(l => [8, 9, 10].includes(l.stage_id)).length;
    const steps = [
      ['לידים', total, 100],
      ['נוצר קשר', contacted, Math.round(contacted / total * 100)],
      ['ייעוץ נקבע', booked, Math.round(booked / total * 100)],
      ['הגיע לייעוץ', arrived, total?Math.round(arrived / total * 100):0],
      ['הצעה נשלחה', proposalSent, Math.round(proposalSent / total * 100)],
      ['נסגר', won, Math.round(won / total * 100)],
    ];
    $('#funnel').innerHTML = steps.map(([l, n, p]) => `
      <div class="funnel-step"><div class="n">${n}</div><div class="l">${l}</div><div class="p">${p}%</div></div>
    `).join('');

    const bySource = {}, byTreatment = {}, byOwner = {};
    D.leads.filter(l => [8, 9, 10].includes(l.stage_id)).forEach(l => {
      const s = D.sourceById(l.source_id).name; bySource[s] = (bySource[s] || 0) + l.expected_value;
      const t = D.treatmentById(l.treatment_id).name; byTreatment[t] = (byTreatment[t] || 0) + l.expected_value;
      const o = D.staffById(l.owner_id); if (o) byOwner[o.name] = (byOwner[o.name] || 0) + l.expected_value;
    });
    $('#rev-by-source').innerHTML = barRows(bySource);
    $('#rev-by-treatment').innerHTML = barRows(byTreatment);
    $('#rev-by-owner').innerHTML = barRows(byOwner);

    const lostReasons = {};
    D.leads.filter(l => l.stage_id === 11).forEach(l => { lostReasons[l.lost_reason] = (lostReasons[l.lost_reason] || 0) + 1; });
    $('#lost-reasons').innerHTML = barRows(lostReasons, false);

    // כסף בסיכון
    const atRiskProposals = D.proposals.filter(p => p.status === 'sent' && new Date(p.valid_until) < new Date(Date.now() + 3*86400000));
    const atRiskLeads = D.leads.filter(l => l.response_status === 'none' && isOverdue(l.next_action_at));
    const atRiskCustomers = D.customers.filter(c => c.churn_risk);
    let riskHtml = '';
    atRiskProposals.forEach(p => { const l = D.leadById(p.lead_id); riskHtml += atRiskRow(`${l.full_name} — הצעה עומדת לפוג`, fmtMoney(p.price), () => openLeadModal(l.id)); });
    atRiskLeads.slice(0,6).forEach(l => { riskHtml += atRiskRow(`${l.full_name} — ${relTime(l.next_action_at)} ללא מענה`, fmtMoney(l.expected_value), () => openLeadModal(l.id)); });
    atRiskCustomers.slice(0,4).forEach(c => { riskHtml += atRiskRow(`${c.full_name} — בסיכון נטישה`, '', () => openCustomerModal(c.id)); });
    $('#at-risk').innerHTML = riskHtml || '<div class="empty-hint">אין כרגע כסף בסיכון 🎉</div>';
  }
  function barRows(obj, money = true) {
    const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, ...entries.map(e => e[1]));
    return entries.map(([k, v]) => `
      <div class="bar-row"><span class="label">${k}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/max*100)}%"></div></div><span class="val">${money ? fmtMoney(v) : v}</span></div>
    `).join('') || '<div class="empty-hint">אין נתונים</div>';
  }
  function atRiskRow(text, value, onClick) {
    const id = 'r' + Math.random().toString(36).slice(2);
    setTimeout(() => { const n = document.getElementById(id); if (n) n.addEventListener('click', onClick); }, 0);
    return `<div id="${id}" class="urgent-row"><span class="dot red"></span><span class="txt">${text}</span><span class="value">${value}</span></div>`;
  }

  // ---------------- Settings ----------------
  const SETTINGS_SECTIONS = ['משתמשים', 'מקורות לידים', 'שירותים ומחירון', 'תבניות הודעה', 'חוקי אוטומציה'];
  let settingsSection = 0;
  function renderSettings() {
    $('#settings-nav').innerHTML = SETTINGS_SECTIONS.map((s, i) => `<button class="${i === settingsSection ? 'active' : ''}" data-i="${i}">${s}</button>`).join('');
    $$('#settings-nav button').forEach(b => b.addEventListener('click', () => { settingsSection = +b.dataset.i; renderSettings(); }));
    let html = '';
    if (settingsSection === 0) {
      html = D.STAFF.map(s => `<div class="rule-row">${staffAvatar(s,30)}<span class="rn">${s.name}</span><span class="pill">${({owner:'בעלת קליניקה',manager:'מנהלת',sales:'מזכירה/נציגה',therapist:'מטפלת'})[s.role]}</span></div>`).join('');
    } else if (settingsSection === 1) {
      html = D.SOURCES.map(s => `<div class="rule-row"><span class="rn">${s.icon} ${s.name}</span><button class="toggle on"></button></div>`).join('');
    } else if (settingsSection === 2) {
      html = D.TREATMENTS.map(t => `<div class="rule-row"><span class="rn">${t.name}</span><span>${fmtMoney(t.price)} · ${t.sessions} מפגשים</span></div>`).join('');
    } else if (settingsSection === 3) {
      html = D.TEMPLATES.map(t => `<div class="rule-row"><span class="rn"><b>${t.name}</b><br><small style="color:var(--muted)">${t.body}</small></span>${t.marketing ? '<span class="pill orange">שיווקי</span>' : ''}</div>`).join('');
    } else if (settingsSection === 4) {
      const rules = [
        ['R01', 'ליד חדש → יצירת משימה + טיוטת הודעה'], ['R02', 'ליד ללא מענה מעל 15 דק׳ → סימון אדום'],
        ['R04', 'קיבל מענה ללא ייעוץ 48 שעות → פולואפ'], ['R08', 'הצעה נשלחה → משימות יום 3/7/14'],
        ['R13', '90/120/180 יום ללא ביקור → רדומה + הצעת חזרה'], ['R15', 'יום הולדת ללקוחת מועדון → הטבה'],
      ];
      html = rules.map(([k, n]) => `<div class="rule-row"><span class="rk">${k}</span><span class="rn">${n}</span><button class="toggle on"></button></div>`).join('');
    }
    $('#settings-content').innerHTML = html;
  }

  // ---------------- Navigation ----------------
  const SCREENS = ['dashboard', 'leads', 'tasks', 'calendar', 'revenue', 'settings'];
  function go(screen, sub) {
    SCREENS.forEach(s => { $('#screen-' + s).classList.toggle('active', s === screen); $('.nav-item[data-screen="' + s + '"]').classList.toggle('active', s === screen); });
    if (screen === 'tasks') renderTasksScreen(sub || 'overdue');
    document.querySelector('.content').scrollTop = 0;
  }

  function renderAll() {
    renderDashboard();
    renderLeadsScreen();
    renderTasksScreen();
    renderCalendar();
    renderRevenue();
    renderSettings();
    updateNavBadges();
  }
  function updateNavBadges() {
    const overdue = D.tasks.filter(t => t.status === 'open' && isOverdue(t.due_at)).length;
    const badge = $('.nav-item[data-screen="tasks"] .badge');
    if (badge) badge.textContent = overdue;
  }

  function toast(msg) {
    let t = $('#toast');
    if (!t) { t = el(`<div id="toast" style="position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#1f2430;color:#fff;padding:10px 18px;border-radius:30px;font-size:13px;z-index:300;opacity:0;transition:.2s"></div>`); document.body.appendChild(t); }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(toast._h); toast._h = setTimeout(() => t.style.opacity = '0', 2200);
  }

  // ---------------- לידים אמיתיים מה-DB (אחרי התחברות) ----------------
  // ברגע שיש session אמיתי, קוראים ישירות מהטבלאות עם ה-session של המשתמש —
  // RLS דואג לבידוד. שתי הפונקציות (sync-apify-leads / sync-osm-leads)
  // נשארות רק לכתיבה (POST) — מריצות סנכרון חדש מול המקור החיצוני.
  const dbState = { stages: [], sources: [], leads: [] };

  function fmtSyncTime(d) {
    if (!d) return 'מעולם לא';
    return new Date(d).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  async function loadDbLeadsData() {
    const sb = window.supabaseClient;
    const [{ data: stages }, { data: sources }, { data: leads }, { data: logs }] = await Promise.all([
      sb.from('pipeline_stages').select('id, name, position').order('position'),
      sb.from('lead_sources').select('id, name'),
      sb.from('leads').select('id, full_name, phone, notes, stage_id, source_id, created_at, expected_value').order('created_at', { ascending: false }).limit(300),
      sb.from('sync_logs').select('source, started_at, finished_at, status, leads_upserted').order('started_at', { ascending: false }).limit(10),
    ]);
    dbState.stages = stages || [];
    dbState.sources = sources || [];
    dbState.leads = leads || [];
    const lastGmaps = (logs || []).find(l => l.source === 'apify_google_maps');
    const lastOsm = (logs || []).find(l => l.source === 'osm_overpass');
    const part = (label, l) => l ? `${label}: ${fmtSyncTime(l.finished_at || l.started_at)}${l.status === 'success' ? ` (${l.leads_upserted} חדשים)` : l.status === 'error' ? ' — שגיאה' : ' — רץ...'}` : `${label}: מעולם לא`;
    $('#db-leads-status').textContent = `${dbState.leads.length} לידים בסה"כ · ${part('Google Maps', lastGmaps)} · ${part('OSM', lastOsm)}`;
    renderDbLeadsTable();
  }
  function renderDbLeadsTable() {
    const sourceName = (id) => (dbState.sources.find(s => s.id === id) || {}).name || '—';
    $('#db-leads-table-wrap').innerHTML = `
      <table class="data-table">
        <thead><tr><th>שם</th><th>טלפון</th><th>מקור</th><th>שלב</th><th>שווי</th><th>נוצר</th></tr></thead>
        <tbody>${dbState.leads.map(l => `
          <tr>
            <td>${l.full_name}</td>
            <td>${l.phone}</td>
            <td><span class="pill" style="background:#eaf0ff;color:var(--blue)">${sourceName(l.source_id)}</span></td>
            <td><select data-lead="${l.id}" class="db-stage-select">${dbState.stages.map(s => `<option value="${s.id}" ${s.id === l.stage_id ? 'selected' : ''}>${s.name}</option>`).join('')}</select></td>
            <td>${l.expected_value ? fmtMoney(l.expected_value) : '—'}</td>
            <td>${fmtDate(l.created_at)}</td>
          </tr>`).join('') || '<tr><td colspan="6"><div class="empty-hint">אין עדיין לידים ב-DB</div></td></tr>'}</tbody>
      </table>`;
    $$('#db-leads-table-wrap .db-stage-select').forEach((sel) => sel.addEventListener('change', async () => {
      const { error } = await window.supabaseClient.from('leads').update({ stage_id: sel.value }).eq('id', sel.dataset.lead);
      toast(error ? 'שגיאת עדכון: ' + error.message : 'השלב עודכן ✔ (כתיבה אמיתית ל-DB)');
    }));
  }
  async function runDbSync(functionName, label, btnId) {
    const btn = $('#' + btnId);
    const orig = btn.textContent;
    btn.disabled = true; btn.textContent = '🔄 מסנכרן...';
    try {
      const cfg = window.SUPABASE_CONFIG;
      const url = window.SUPABASE_FUNCTION_URL(functionName);
      const { data: { session } } = await window.supabaseClient.auth.getSession();
      const res = await fetch(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (session ? session.access_token : cfg.anonKey), apikey: cfg.anonKey },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.success === false) throw new Error(body.error || ('HTTP ' + res.status));
      toast(`✔ ${label}: ${body.leads_upserted} לידים חדשים (${body.leads_skipped} כבר היו קיימים)`);
      await loadDbLeadsData();
    } catch (e) {
      toast(`שגיאת סנכרון (${label}): ` + (e.message || e));
    } finally {
      btn.disabled = false; btn.textContent = orig;
    }
  }
  function initDbLeadsPanel() {
    $('#db-leads-panel').style.display = 'block';
    $('#gmaps-sync-btn').onclick = () => runDbSync('sync-apify-leads', 'Google Maps', 'gmaps-sync-btn');
    $('#osm-sync-btn').onclick = () => runDbSync('sync-osm-leads', 'OpenStreetMap', 'osm-sync-btn');
    $('#db-refresh-btn').onclick = () => loadDbLeadsData();
    loadDbLeadsData();
  }
  function teardownDbLeadsPanel() {
    $('#db-leads-panel').style.display = 'none';
  }

  // ---------------- ליד חדש (כפתור בסרגל העליון) ----------------
  async function openNewLeadModal() {
    if (window.AUTH && dbState.stages.length === 0) { try { await loadDbLeadsData(); } catch (e) {} }
    const sel = $('#nl-source');
    sel.innerHTML = window.AUTH
      ? dbState.sources.map(s => `<option value="${s.id}">${s.name}</option>`).join('')
      : D.SOURCES.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
    $('#new-lead-form').reset();
    $('#new-lead-error').style.display = 'none';
    $('#new-lead-overlay').classList.add('open');
    $('#nl-name').focus();
  }
  function closeNewLeadModal() { $('#new-lead-overlay').classList.remove('open'); }

  async function submitNewLead(e) {
    e.preventDefault();
    const full_name = $('#nl-name').value.trim();
    const phone = $('#nl-phone').value.trim();
    const source_id = $('#nl-source').value || null;
    const expected_value = Number($('#nl-value').value) || 0;
    const notes = $('#nl-notes').value.trim();
    const errEl = $('#new-lead-error');
    errEl.style.display = 'none';
    if (!full_name || !phone) return;

    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'שומר...';
    try {
      if (window.AUTH) {
        const stage = dbState.stages.slice().sort((a, b) => a.position - b.position)[0];
        const { error } = await window.supabaseClient.from('leads').insert({
          clinic_id: window.AUTH.profile.clinic_id,
          full_name, phone, source_id, stage_id: stage.id,
          expected_value, response_status: 'none', notes: notes || null,
        });
        if (error) throw error;
        toast('✔ הליד נשמר ב-DB');
        await loadDbLeadsData();
      } else {
        D.leads.unshift({
          id: 'L' + Math.random().toString(36).slice(2, 7).toUpperCase(),
          full_name, phone, email: null,
          source_id: source_id || D.SOURCES[0].id,
          treatment_id: D.TREATMENTS[0].id,
          stage_id: 1, owner_id: D.STAFF.find(s => s.role === 'sales').id,
          expected_value, response_status: 'none',
          first_response_at: null, next_action: 'לחזור ללידה (SLA 15 דק׳)',
          next_action_at: new Date(Date.now() + 15 * 60000),
          lost_reason: null, created_at: new Date(), notes: notes || '',
        });
        toast('✔ הליד נוסף (דמו מקומי)');
        renderLeadsScreen();
        renderDashboard();
        updateNavBadges();
      }
      closeNewLeadModal();
    } catch (err) {
      errEl.textContent = 'שגיאה בשמירה: ' + (err.message || err);
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'שמור ליד';
    }
  }

  // ---------------- Init ----------------
  function init() {
    $('#clinic-name').textContent = D.clinicName;
    $$('.nav-item[data-screen]').forEach(btn => btn.addEventListener('click', () => go(btn.dataset.screen)));
    $('#modal-backdrop').addEventListener('click', (e) => { if (e.target.id === 'modal-backdrop') closeModal(); });
    $('#new-lead-btn').addEventListener('click', openNewLeadModal);
    $('#new-lead-close').addEventListener('click', closeNewLeadModal);
    $('#new-lead-cancel').addEventListener('click', closeNewLeadModal);
    $('#new-lead-overlay').addEventListener('click', (e) => { if (e.target.id === 'new-lead-overlay') closeNewLeadModal(); });
    $('#new-lead-form').addEventListener('submit', submitNewLead);
    $('#filter-source').addEventListener('change', (e) => { leadFilters.source = e.target.value; renderLeadsScreen(); });
    $('#filter-owner').addEventListener('change', (e) => { leadFilters.owner = e.target.value; renderLeadsScreen(); });
    $$('.leads-view-btn').forEach(b => b.addEventListener('click', () => {
      $$('.leads-view-btn').forEach(x => x.classList.remove('btn-primary'));
      b.classList.add('btn-primary');
      $('#kanban-wrap').style.display = b.dataset.view === 'kanban' ? 'block' : 'none';
      $('#leads-table-wrap').style.display = b.dataset.view === 'table' ? 'block' : 'none';
    }));
    renderAll();
    go('dashboard');
    window.CRM = { go, openLeadModal, openCustomerModal, computeKpis, D };
    window.addEventListener('auth-ready', initDbLeadsPanel);
    window.addEventListener('auth-signed-out', teardownDbLeadsPanel);
  }
  document.addEventListener('DOMContentLoaded', init);
})();
