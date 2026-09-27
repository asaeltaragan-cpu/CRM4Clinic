// Clinic Revenue OS — Supabase Edge Function: סנכרון לידים מ-Apify (Google Maps)
//
// מריצה את ה-Actor compass/google-maps-extractor דרך Apify REST API,
// עושה upsert של לידים חדשים לטבלת leads (בלי לדרוס לידים קיימים),
// ורושמת שורה ב-sync_logs עם התוצאה. נקראת מכפתור בדמו (למשתמש מחובר
// בלבד) וגם מ-GitHub Actions פעם ביום (ראה .github/workflows/sync-leads.yml).
//
// קריאת לידים (GET) לא עוברת יותר דרך הפונקציה — אחרי הוספת ניהול
// משתמשים (ראו CRM/demo/auth.js), משתמש מחובר קורא ישירות מטבלת leads
// עם ה-session שלו, ו-RLS דואג לבידוד הנכון. הפונקציה הזו רק כותבת.
//
// פריסה: supabase functions deploy sync-apify-leads
// סוד נדרש: supabase secrets set APIFY_TOKEN=xxxxx
// (SUPABASE_URL ו-SUPABASE_SERVICE_ROLE_KEY מוזרקים אוטומטית ע"י Supabase)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINIC_SLUG = 'crm4clinic-demo';
const SEARCH_TERMS = ['קליניקת יופי', 'מכון קוסמטיקה', 'רפואה אסתטית', 'מרפאת עור ולייזר', 'מכון להסרת שיער בלייזר'];
const MAX_PER_TERM = 15; // עלות מוגבלת מראש: 5 × 15 × $0.005 ≈ $0.375 לכל סנכרון

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return digits ? '+' + digits : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apifyToken = Deno.env.get('APIFY_TOKEN');
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: clinic, error: clinicErr } = await supabase
    .from('clinics').select('id').eq('slug', CLINIC_SLUG).single();
  if (clinicErr || !clinic) return json({ success: false, error: 'קליניקת דמו לא נמצאה. הריצו קודם את seed.mjs' }, 404);
  const clinicId = clinic.id;

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed — use POST' }, 405);
  }

  if (!apifyToken) {
    return json({ success: false, error: 'APIFY_TOKEN לא מוגדר (supabase secrets set APIFY_TOKEN=...)' }, 500);
  }

  const { data: logRow } = await supabase
    .from('sync_logs')
    .insert({ clinic_id: clinicId, source: 'apify_google_maps', status: 'running' })
    .select().single();

  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/compass~google-maps-extractor/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchStringsArray: SEARCH_TERMS,
          locationQuery: 'ישראל',
          maxCrawledPlacesPerSearch: MAX_PER_TERM,
          language: 'iw',
          skipClosedPlaces: true,
        }),
      }
    );
    if (!apifyRes.ok) throw new Error(`Apify HTTP ${apifyRes.status}: ${await apifyRes.text()}`);
    const items = await apifyRes.json();

    const { data: source } = await supabase
      .from('lead_sources').select('id').eq('clinic_id', clinicId).eq('name', 'Google Maps').single();
    const { data: stage } = await supabase
      .from('pipeline_stages').select('id').eq('clinic_id', clinicId).eq('position', 1).single();

    const candidates = items
      .filter((it: any) => !it.permanentlyClosed && !it.temporarilyClosed)
      .map((it: any) => ({
        full_name: it.title as string,
        phone: normalizePhone(it.phone || it.phoneUnformatted),
        notes: [it.categoryName, it.address].filter(Boolean).join(' · '),
      }))
      .filter((l: any) => l.full_name && l.phone);

    // הימנעות מכפילויות: לא דורסים לידים שכבר קיימים לפי טלפון
    const phones = [...new Set(candidates.map((c: any) => c.phone))];
    let existingPhones = new Set<string>();
    if (phones.length > 0) {
      const { data: existing } = await supabase
        .from('leads').select('phone').eq('clinic_id', clinicId).in('phone', phones);
      existingPhones = new Set((existing || []).map((r: any) => r.phone));
    }

    const seen = new Set<string>();
    const toInsert = candidates.filter((c: any) => {
      if (existingPhones.has(c.phone) || seen.has(c.phone)) return false;
      seen.add(c.phone);
      return true;
    }).map((c: any) => ({
      clinic_id: clinicId,
      full_name: c.full_name,
      phone: c.phone,
      source_id: source?.id ?? null,
      stage_id: stage?.id,
      response_status: 'none',
      expected_value: 0,
      notes: c.notes,
    }));

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insErr, count } = await supabase.from('leads').insert(toInsert).select('id', { count: 'exact' });
      if (insErr) throw insErr;
      inserted = count ?? toInsert.length;
    }
    const skipped = candidates.length - inserted;

    await supabase.from('sync_logs').update({
      finished_at: new Date().toISOString(), status: 'success',
      leads_upserted: inserted, leads_skipped: skipped,
      message: `${items.length} נסרקו, ${inserted} לידים חדשים נוספו, ${skipped} כבר היו קיימים`,
    }).eq('id', logRow!.id);

    return json({ success: true, scraped: items.length, leads_upserted: inserted, leads_skipped: skipped });
  } catch (e) {
    await supabase.from('sync_logs').update({
      finished_at: new Date().toISOString(), status: 'error', message: String(e?.message || e),
    }).eq('id', logRow!.id);
    return json({ success: false, error: String(e?.message || e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}
