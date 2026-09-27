/**
 * Clinic Revenue OS — קביעת סיסמת דמו קבועה לחמשת אנשי הצוות שנוצרו ב-seed.mjs
 * ------------------------------------------------------------
 * seed.mjs יוצר משתמשי Auth עם סיסמה אקראית שלא נשמרת בשום מקום (מכוון —
 * לא רצינו שסיסמה אמיתית תישאר בקוד). כדי שאפשר יהיה להתחבר לדמו בפועל,
 * הסקריפט הזה קובע סיסמה קבועה וידועה לכל חמשת המשתמשים.
 *
 * ⚠️ זו סיסמת דמו בלבד לחשבונות דמו סינתטיים (...@demo.crm4clinic.local),
 * לא סיסמה של אף אדם אמיתי — בטוח להציג אותה במסך ההתחברות של הדמו עצמו.
 *
 * שימוש: npm run set-passwords   (מ-CRM/supabase, אחרי npm install + .env)
 */
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'Demo1234!';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ חסרים SUPABASE_URL ו/או SUPABASE_SERVICE_ROLE_KEY. ראו .env.example');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, clinics!inner(slug)')
    .eq('clinics.slug', 'crm4clinic-demo');
  if (error) throw error;
  if (!users || !users.length) {
    console.error('❌ לא נמצאו משתמשים. הריצו קודם: npm run seed');
    process.exit(1);
  }

  for (const u of users) {
    const { error: updErr } = await supabase.auth.admin.updateUserById(u.id, { password: DEMO_PASSWORD });
    if (updErr) { console.error(`❌ ${u.email}: ${updErr.message}`); continue; }
    console.log(`✅ ${u.full_name.padEnd(14)} ${u.role.padEnd(10)} ${u.email}`);
  }
  console.log(`\nסיסמה לכל המשתמשים: ${DEMO_PASSWORD}`);
}

main().catch((err) => { console.error('❌ שגיאה:', err.message || err); process.exit(1); });
