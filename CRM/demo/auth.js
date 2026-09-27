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
    // כל שלב מבודד ב-try/catch משלו: כשל בהרשמת מאזין אחד (למשל אלמנט
    // שעדיין לא קיים ב-DOM) לא יחסום את הצגת מסך ההתחברות — זה הדבר
    // הכי חשוב שחייב לקרות תמיד.
    try {
      $('#login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        $('#login-error').style.display = 'none';
        const email = $('#login-email').value.trim();
        const password = $('#login-password').value;
        const btn = e.target.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'מתחבר/ת...';
        try {
          const { data, error } = await supabase.auth.signInWithPassword({ email, password });
          if (error) { showLoginError('התחברות נכשלה: ' + error.message); return; }
          await loadProfileAndEnter(supabase, data.user.id);
        } catch (err) {
          console.error('[auth] login submit failed:', err);
          showLoginError('שגיאה בלתי צפויה בהתחברות: ' + (err.message || err));
        } finally {
          btn.disabled = false; btn.textContent = 'התחבר/י';
        }
      });
    } catch (err) { console.error('[auth] failed to wire login form:', err); }

    try {
      $('#logout-btn').addEventListener('click', async () => {
        try {
          await supabase.auth.signOut();
        } finally {
          window.AUTH = null;
          $('#topbar-who-authed').style.display = 'none';
          window.dispatchEvent(new Event('auth-signed-out'));
          showLogin();
        }
      });
    } catch (err) { console.error('[auth] failed to wire logout button:', err); }

    supabase.auth.getSession()
      .then(({ data }) => {
        if (data.session) return loadProfileAndEnter(supabase, data.session.user.id);
        showLogin();
      })
      .catch((err) => {
        console.error('[auth] getSession failed:', err);
        showLogin();
      });
  }

  window.addEventListener('supabase-ready', (e) => {
    try {
      init(e.detail.supabase);
    } catch (err) {
      console.error('[auth] init() threw synchronously:', err);
      showLogin();
    }
  });
})();
