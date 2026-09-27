/* Clinic Revenue OS — חיבור Supabase אופציונלי לדמו.
   אם config.js קיים ומוגדר (ראו config.example.js), הדמו מבצע קריאה אמיתית ל-DB
   ומציג badge "מחובר ל-Supabase". בלי config.js — שקט לחלוטין, והדמו ממשיך
   לעבוד כרגיל על נתוני data.js המקומיים.

   בנוסף חושף:
   - window.supabaseClient — מופע supabase-js (לשימוש חופשי בקוד האפליקציה)
   - window.SUPABASE_FUNCTION_URL('name') — בונה URL ל-Edge Function
   - אירוע 'supabase-ready' ב-window כשהחיבור מוכן, לשימוש ע"י app.js */
(function () {
  'use strict';

  function setBadge(html) {
    let b = document.getElementById('db-badge');
    if (!b) {
      b = document.createElement('div');
      b.id = 'db-badge';
      b.style.cssText = 'font-size:11px;padding:4px 10px;border-radius:20px;background:#f1f2f7;color:#6b7280;margin-inline-end:8px;white-space:nowrap;';
      const who = document.querySelector('.topbar .who');
      if (who) who.prepend(b);
    }
    b.innerHTML = html;
  }

  window.SUPABASE_FUNCTION_URL = function (name) {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg) return null;
    return cfg.url.replace(/\/$/, '') + '/functions/v1/' + name;
  };

  async function init() {
    const cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || cfg.url.includes('YOUR-PROJECT-REF')) {
      return; // אין קונפיג — מצב הדגמה מקומי, בלי להציג badge
    }
    setBadge('🔌 מתחבר ל-Supabase…');
    try {
      const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
      const supabase = createClient(cfg.url, cfg.anonKey);
      const { count, error } = await supabase.from('leads').select('*', { count: 'exact', head: true });
      if (error) throw error;
      setBadge(`🔌 מחובר ל-Supabase · ${count ?? 0} לידים ב-DB (RLS)`);
      window.supabaseClient = supabase;
      window.dispatchEvent(new CustomEvent('supabase-ready', { detail: { supabase, config: cfg } }));
    } catch (e) {
      console.warn('Supabase connection failed, staying in local demo mode:', e.message || e);
      setBadge('⚠️ חיבור ל-Supabase נכשל — מצב הדגמה מקומי');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
