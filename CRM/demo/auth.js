/* Clinic Revenue OS — ניהול משתמשים (Supabase Auth) לדמו.
   פעיל רק כש-config.js מוגדר (supabaseClient.js כבר יצר window.supabaseClient).
   בלי config.js — המסך הזה כולו לא נכנס לתמונה, והדמו עובד כרגיל על data.js. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);

  // הערה: פרטי ההתחברות (מיילים + סיסמה) לא מוצגים כאן בכוונה — הדמו הזה
  // עלול להיות פרוס ציבורית (GitHub Pages). מסרו את הפרטים בפועל בערוץ פרטי.
  const ROLE_LABEL = { owner: 'בעלת קליניקה', manager: 'מנהלת', sales: 'מזכירה/נציגה', therapist: 'מטפלת' };
  const initials = (name) => (name || '').split(' ').map((p) => p[0]).slice(0, 2).join('');

  function showLogin() {
    const ov = $('#login-overlay');
    if (ov) ov.style.display = 'flex';
    $('#topbar-who-authed').style.display = 'none';
    $('#topbar-who-demo').style.display = 'flex';
    $('#db-leads-panel') && ($('#db-leads-panel').style.display = 'none');
  }
  function hideLogin() {
    const ov = $('#login-overlay');
    if (ov) ov.style.display = 'none';
  }
  function showLoginError(msg) {
    const el = $('#login-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  async function loadProfileAndEnter(supabase, userId) {
    const { data: profile, error } = await supabase
      .from('users').select('id, full_name, role, clinic_id').eq('id', userId).single();
    if (error || !profile) { showLoginError('החיבור הצליח אבל לא נמצא פרופיל משתמש. ודאו ש-seed.mjs רץ.'); return; }
    window.AUTH = { userId, profile };
    hideLogin();
    $('#who-name').textContent = `${profile.full_name} · ${ROLE_LABEL[profile.role] || profile.role}`;
    $('#who-avatar').textContent = initials(profile.full_name);
    $('#topbar-who-authed').style.display = 'flex';
    $('#topbar-who-demo').style.display = 'none';
    window.dispatchEvent(new CustomEvent('auth-ready', { detail: { profile } }));
  }

  function init(supabase) {
    $('#login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      $('#login-error').style.display = 'none';
      const email = $('#login-email').value.trim();
      const password = $('#login-password').value;
      const btn = e.target.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'מתחבר/ת...';
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      btn.disabled = false; btn.textContent = 'התחבר/י';
      if (error) { showLoginError('התחברות נכשלה: ' + error.message); return; }
      await loadProfileAndEnter(supabase, data.user.id);
    });

    $('#logout-btn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.AUTH = null;
      $('#topbar-who-authed').style.display = 'none';
      window.dispatchEvent(new Event('auth-signed-out'));
      showLogin();
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadProfileAndEnter(supabase, data.session.user.id);
      else showLogin();
    });
  }

  window.addEventListener('supabase-ready', (e) => init(e.detail.supabase));
})();
