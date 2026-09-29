// בדיקת התאמה לנייד של הדמו (CRM/demo) על Chromium (Chrome) ו-WebKit (המנוע של Safari).
// שימוש:  node mobile-check.mjs                -> שני המנועים
//         node mobile-check.mjs --only=chromium -> מנוע אחד
// משתני סביבה: CHROMIUM_PATH (נתיב לדפדפן מותקן מראש), SHOTS_DIR (תיקיית צילומים).
import { chromium, webkit, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEMO = path.resolve(here, '../../demo');
const SHOTS = process.env.SHOTS_DIR || path.join(here, 'screenshots');
const only = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1];

const MATRIX = [
  { engine: 'chromium', name: 'Pixel 7', device: devices['Pixel 7'] },
  { engine: 'chromium', name: 'Galaxy S9+', device: devices['Galaxy S9+'] },
  { engine: 'chromium', name: 'Small 320', device: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } } },
  { engine: 'chromium', name: 'Desktop Chrome', device: { viewport: { width: 1440, height: 900 } } },
  { engine: 'webkit', name: 'iPhone 13', device: devices['iPhone 13'] },
  { engine: 'webkit', name: 'iPhone SE', device: devices['iPhone SE'] },
  { engine: 'webkit', name: 'iPad Mini', device: devices['iPad Mini'] },
  { engine: 'webkit', name: 'Desktop Safari', device: { viewport: { width: 1440, height: 900 } } },
].filter(m => !only || m.engine === only);

const SCREENS = ['dashboard', 'leads', 'tasks', 'calendar', 'revenue', 'settings'];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

function serve() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    const file = path.join(DEMO, rel);
    if (!file.startsWith(DEMO) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

const noHScroll = () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1;

async function run() {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve();
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const failures = [];
  const browsers = {};

  for (const m of MATRIX) {
    const launcher = m.engine === 'webkit' ? webkit : chromium;
    const opts = m.engine === 'chromium' && process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
    browsers[m.engine] ||= await launcher.launch(opts);
    const ctx = await browsers[m.engine].newContext(m.device);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    const tag = `${m.engine}/${m.name}`;
    const slug = `${m.engine}-${m.name.replace(/\W+/g, '-')}`;
    const check = (ok, what) => { if (!ok) failures.push(`${tag}: ${what}`); console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what}`); };
    console.log(`\n== ${tag} (${page.viewportSize().width}x${page.viewportSize().height})`);

    await page.goto(url);
    await page.waitForTimeout(400);
    const mobile = page.viewportSize().width <= 900;

    if (mobile) {
      const bar = await page.evaluate(() => {
        const s = document.querySelector('.sidebar'); const r = s.getBoundingClientRect();
        return { visible: getComputedStyle(s).display !== 'none', atBottom: Math.abs(r.bottom - innerHeight) < 2, overflow: s.scrollWidth - s.clientWidth };
      });
      check(bar.visible && bar.atBottom, 'bottom tab bar visible and pinned');
      check(bar.overflow <= 1, `all tab bar items fit (overflow ${bar.overflow}px)`);
    }

    for (const s of SCREENS) {
      await page.click(`.nav-item[data-screen=${s}]`);
      await page.waitForTimeout(150);
      const active = await page.evaluate(s => document.getElementById('screen-' + s).classList.contains('active'), s);
      check(active && await page.evaluate(noHScroll), `${s}: navigates, no horizontal scroll`);
      await page.screenshot({ path: `${SHOTS}/${slug}-${s}.png` });
    }

    await page.click('.nav-item[data-screen=leads]');
    await page.click('[data-view=table]');
    await page.waitForTimeout(150);
    check(await page.evaluate(noHScroll), 'leads table view: page does not scroll sideways');

    await page.click('[data-view=kanban]');
    await page.click('.lead-card');
    await page.waitForTimeout(250);
    const modal = await page.evaluate(() => { const r = document.getElementById('modal').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
    check(modal, 'lead modal fits viewport');
    await page.screenshot({ path: `${SHOTS}/${slug}-lead-modal.png` });
    await page.evaluate(() => document.getElementById('modal-backdrop').classList.remove('open'));

    await page.click('#new-lead-btn');
    await page.waitForTimeout(200);
    const nl = await page.evaluate(() => ({
      fits: (() => { const r = document.querySelector('#new-lead-overlay .modal').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; })(),
      font: parseFloat(getComputedStyle(document.getElementById('nl-name')).fontSize),
    }));
    check(nl.fits, 'new-lead modal fits viewport');
    if (mobile) check(nl.font >= 16, `inputs >= 16px (no iOS zoom), got ${nl.font}px`);
    await page.screenshot({ path: `${SHOTS}/${slug}-new-lead.png` });
    await page.evaluate(() => document.getElementById('new-lead-overlay').classList.remove('open'));

    await page.click('#tour-launch-btn');
    await page.waitForTimeout(400);
    const tour = await page.evaluate(() => { const r = document.getElementById('tour-card').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; });
    check(tour, 'tour card inside viewport');
    await page.screenshot({ path: `${SHOTS}/${slug}-tour.png` });

    check(errors.length === 0, `no JS errors${errors.length ? ': ' + errors.join(' | ') : ''}`);
    await ctx.close();
  }

  await Promise.all(Object.values(browsers).map(b => b.close()));
  server.close();
  console.log(`\n${failures.length ? 'FAILED' : 'ALL PASSED'} (${MATRIX.length} devices)`);
  failures.forEach(f => console.log('  - ' + f));
  process.exit(failures.length ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
