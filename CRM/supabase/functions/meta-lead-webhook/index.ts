// Clinic Revenue OS — Supabase Edge Function: Webhook ללידים מפרסום ב-Meta (Facebook/Instagram Lead Ads)
//
// זרימה: ליד חדש בטופס Lead Ads → Meta קוראת ל-webhook הזה → שולפים את פרטי הליד מ-Graph API →
// שומרים בטבלת leads (מקור "Meta Ads", בלי לדרוס קיימים לפי טלפון) → מוסיפים שורה ל-Google Sheet
// (דרך Google Apps Script — ראו google-sheets/Code.gs).
//
// פריסה (חובה --no-verify-jwt: Meta לא שולחת JWT של Supabase, האימות נעשה בחתימת HMAC):
//   supabase functions deploy meta-lead-webhook --no-verify-jwt
// סודות:
//   supabase secrets set META_VERIFY_TOKEN=<מחרוזת שתבחרו> META_APP_SECRET=<App Secret> \
//     META_PAGE_TOKEN=<Page access token לטווח ארוך> GOOGLE_SHEET_WEBHOOK_URL=<כתובת ה-Web app> \
//     GOOGLE_SHEET_SECRET=<אותו סוד כמו ב-Code.gs>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CLINIC_SLUG = 'crm4clinic-demo';
const SOURCE_NAME = 'Meta Ads';
const GRAPH = 'https://graph.facebook.com/v21.0';

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return digits ? '+' + digits : null;
}

async function validSignature(req: Request, raw: string): Promise<boolean> {
  const secret = Deno.env.get('META_APP_SECRET');
  const header = req.headers.get('x-hub-signature-256');
  if (!secret || !header) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = 'sha256=' + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === header;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // אימות ה-webhook מול Meta (חד-פעמי בהגדרה)
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === Deno.env.get('META_VERIFY_TOKEN')) {
      return new Response(url.searchParams.get('hub.challenge') ?? '', { status: 200 });
    }
    return new Response('forbidden', { status: 403 });
  }
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  const raw = await req.text();
  if (!(await validSignature(req, raw))) return new Response('bad signature', { status: 401 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: clinic } = await supabase.from('clinics').select('id').eq('slug', CLINIC_SLUG).single();
  if (!clinic) return new Response('clinic not found', { status: 500 });
  const { data: source } = await supabase.from('lead_sources').select('id').eq('clinic_id', clinic.id).eq('name', SOURCE_NAME).single();
  const { data: stage } = await supabase.from('pipeline_stages').select('id').eq('clinic_id', clinic.id).eq('position', 1).single();

  const leadgenIds: string[] = [];
  for (const entry of JSON.parse(raw).entry ?? []) {
    for (const ch of entry.changes ?? []) if (ch.field === 'leadgen' && ch.value?.leadgen_id) leadgenIds.push(ch.value.leadgen_id);
  }

  const results: unknown[] = [];
  for (const id of leadgenIds) {
    try {
      const res = await fetch(`${GRAPH}/${id}?fields=created_time,field_data,ad_name,campaign_name,form_id&access_token=${Deno.env.get('META_PAGE_TOKEN')}`);
      if (!res.ok) throw new Error(`Graph HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const lead = await res.json();
      const f: Record<string, string> = {};
      for (const fd of lead.field_data ?? []) f[fd.name] = (fd.values ?? []).join(', ');

      const name = f.full_name || [f.first_name, f.last_name].filter(Boolean).join(' ') || 'ליד מ-Meta';
      const phone = normalizePhone(f.phone_number || f.phone);
      const email = f.email || null;
      const known = new Set(['full_name', 'first_name', 'last_name', 'phone_number', 'phone', 'email']);
      const extra = Object.entries(f).filter(([k]) => !known.has(k)).map(([k, v]) => `${k}: ${v}`).join(' | ');

      let saved = 'skipped (no phone)';
      if (phone) {
        const { data: exists } = await supabase.from('leads').select('id').eq('clinic_id', clinic.id).eq('phone', phone).maybeSingle();
        if (exists) saved = 'duplicate';
        else {
          const { error } = await supabase.from('leads').insert({
            clinic_id: clinic.id, full_name: name, phone, email, source_id: source?.id ?? null,
            campaign: lead.campaign_name ?? null, stage_id: stage?.id, response_status: 'none', expected_value: 0,
            notes: [lead.ad_name && `מודעה: ${lead.ad_name}`, extra].filter(Boolean).join(' · ') || null,
          });
          if (error) throw error;
          saved = 'inserted';
        }
      }

      // Google Sheet — נשלח תמיד (גם אם הליד כבר ב-DB); Apps Script מסנן כפילויות לפי Lead ID
      const sheetUrl = Deno.env.get('GOOGLE_SHEET_WEBHOOK_URL');
      if (sheetUrl) {
        await fetch(sheetUrl, {
          method: 'POST', headers: { 'Content-Type': 'text/plain' }, redirect: 'follow',
          body: JSON.stringify({
            secret: Deno.env.get('GOOGLE_SHEET_SECRET'), lead_id: id, created_time: lead.created_time,
            name, phone: phone ?? '', email: email ?? '', campaign: lead.campaign_name ?? '',
            ad: lead.ad_name ?? '', form: lead.form_id ?? '', extra,
          }),
        });
      }
      results.push({ id, saved });
    } catch (e) {
      results.push({ id, error: String(e?.message || e) });
    }
  }
  // תמיד 200 — אחרת Meta תנסה שוב ושוב; השגיאות נראות בלוגים של הפונקציה
  console.log(JSON.stringify(results));
  return new Response(JSON.stringify({ success: true, results }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
