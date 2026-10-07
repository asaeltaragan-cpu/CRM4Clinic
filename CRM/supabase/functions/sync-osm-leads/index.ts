// Clinic Revenue OS — Supabase Edge Function: סנכרון לידים מ-OpenStreetMap (Overpass API)
//
// מקור לידים חינמי לגמרי, בלי מפתח API: שולף עסקי יופי/בריאות רלוונטיים
// בישראל מ-OpenStreetMap דרך Overpass API, ועושה upsert ל-leads (בלי לדרוס
// לידים קיימים), ורושמת שורה ב-sync_logs. אותה תבנית בדיוק כמו
// sync-apify-leads, כדי שהדמו וה-GitHub Action יעבדו עם שניהם באותו אופן.
//
// קריאת לידים (GET) לא עוברת יותר דרך הפונקציה — משתמש מחובר קורא ישירות
// מטבעת leads עם ה-session שלו (RLS). הפונקציה הזו רק כותבת (POST).
//
// פריסה: supabase functions deploy sync-osm-leads
// אין סוד נדרש — Overpass API חופשי לגמרי (רישיון ODbL, קרדיט ל-OSM contributors).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLINIC_SLUG = 'crm4clinic-demo';
const SOURCE_NAME = 'OpenStreetMap';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
];

// עסקי יופי/בריאות אסתטית בישראל — תיוגי OSM רלוונטיים
// timeout נמוך + הגבלת תוצאות בכוונה: Supabase Edge Functions מגבילות זמן
// ריצה, ושרתי Overpass הציבוריים יכולים להיות איטיים — עדיף להיכשל מהר
// ולעבור ל-mirror הבא מאשר לתקוע את הפונקציה עד שהיא נחתכת (WORKER_RESOURCE_LIMIT).
const OVERPASS_TIMEOUT_MS = 25000;
const OVERPASS_ATTEMPTS = 5; // 504 "server busy" חוזר מהר ולרוב עובר בניסיון חוזר
const OVERPASS_QUERY = `
[out:json][timeout:25][bbox:29.4,34.2,33.4,35.9];
(
  nwr["shop"="beauty"];
  nwr["healthcare"="dermatologist"];
  nwr["healthcare"="plastic_surgeon"];
  nwr["amenity"="spa"];
  nwr["leisure"="spa"];
);
out center tags 80;
`;

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return digits ? '+' + digits : null;
}

function addressOf(tags: Record<string, string>): string {
  return [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']].filter(Boolean).join(' ');
}

async function fetchOverpass(): Promise<any[]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < OVERPASS_ATTEMPTS; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          // Overpass דוחה (429) בקשות בלי User-Agent מזהה
          headers: { 'Content-Type': 'text/plain', 'User-Agent': 'CRM4Clinic/1.0 (+https://github.com/asaeltaragan-cpu/CRM4Clinic)' },
          body: OVERPASS_QUERY,
          signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
        });
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        const json = await res.json();
        return json.elements || [];
      } catch (e) {
        lastErr = e;
      }
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw lastErr;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: clinic, error: clinicErr } = await supabase
    .from('clinics').select('id').eq('slug', CLINIC_SLUG).single();
  if (clinicErr || !clinic) return json({ success: false, error: 'קליניקת דמו לא נמצאה. הריצו קודם את seed.mjs' }, 404);
  const clinicId = clinic.id;

  if (req.method !== 'POST') {
    return json({ success: false, error: 'Method not allowed — use POST' }, 405);
  }

  const { data: logRow } = await supabase
    .from('sync_logs')
    .insert({ clinic_id: clinicId, source: 'osm_overpass', status: 'running' })
    .select().single();

  try {
    // Overpass חוסם (406) את כתובות ה-IP של Supabase, אז הדמו שולף את הנתונים
    // מהדפדפן ושולח אותם ב-body ({ elements }). בלי body — ננסה לשלוף בעצמנו.
    let elements: any[] | null = null;
    try {
      const body = await req.json();
      if (Array.isArray(body?.elements)) elements = body.elements.slice(0, 200);
    } catch (_) { /* אין body */ }
    if (!elements) elements = await fetchOverpass();

    const { data: source } = await supabase
      .from('lead_sources').select('id').eq('clinic_id', clinicId).eq('name', SOURCE_NAME).single();
    const { data: stage } = await supabase
      .from('pipeline_stages').select('id').eq('clinic_id', clinicId).eq('position', 1).single();

    const candidates = elements
      .map((el: any) => el.tags || {})
      .filter((tags: any) => tags.name)
      .map((tags: any) => ({
        full_name: tags.name as string,
        phone: normalizePhone(tags.phone || tags['contact:phone']),
        notes: [tags.shop || tags.healthcare || tags.amenity || tags.leisure, addressOf(tags)].filter(Boolean).join(' · '),
      }))
      .filter((l: any) => l.full_name && l.phone);

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
      message: `${elements.length} עסקים נמצאו ב-OSM, ${candidates.length} עם שם+טלפון, ${inserted} לידים חדשים נוספו`,
    }).eq('id', logRow!.id);

    return json({ success: true, scraped: elements.length, leads_upserted: inserted, leads_skipped: skipped });
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
