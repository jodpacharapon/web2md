// Generate Chrome Web Store images from the real extension:
//   store-assets/screenshot-1.png … screenshot-3.png  (1280×800)
//   store-assets/promo-small.png                      (440×280)
//
// Usage: npm run store-assets   (needs: npx playwright install chromium)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'store-assets');
fs.mkdirSync(out, { recursive: true });
const HOST = 'notebook-daily.example';

// Temporary copy with host permissions: automation can't click the toolbar icon.
const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web2md-ext-'));
for (const item of ['manifest.json', 'popup', 'src', 'lib', 'icons']) {
  fs.cpSync(path.join(root, item), path.join(extDir, item), { recursive: true });
}
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest));

const demo = fs.readFileSync(path.join(root, 'scripts/store/demo.html'));
const server = http.createServer((req, res) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(demo));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const context = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), 'web2md-profile-')), {
  channel: 'chromium',
  headless: true,
  // Set the size up front: resizing a headless page before a screenshot can
  // leave stale tiles at the old window height.
  viewport: { width: 1180, height: 640 },
  env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' },
  args: [
    `--disable-extensions-except=${extDir}`,
    `--load-extension=${extDir}`,
    `--host-resolver-rules=MAP ${HOST} 127.0.0.1:${port}`,
  ],
});

const ext = await context.newPage();
await ext.goto('chrome://extensions/');
const extId = await ext.evaluate(async () =>
  (await new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r))).find((e) => e.name.startsWith('Web2MD')).id,
);
await ext.close();

const PAGE_W = 1180;
const PAGE_H = 640;
const pageUrl = `http://${HOST}/posts/ai-tips`;

async function capture({ select = false, scrollY = 0 } = {}) {
  const page = await context.newPage();
  await page.goto(pageUrl);
  await page.waitForTimeout(300);
  if (scrollY) await page.evaluate((y) => scrollTo(0, y), scrollY);
  if (select) {
    await page.evaluate(() => {
      const h2 = [...document.querySelectorAll('h2')][1];
      const range = document.createRange();
      range.setStartBefore(h2);
      range.setEndAfter(document.querySelector('table'));
      getSelection().removeAllRanges();
      getSelection().addRange(range);
    });
  }
  const pageShot = await page.screenshot();

  const helper = await context.newPage();
  await helper.goto(`chrome-extension://${extId}/popup/popup.html`);
  const tabId = await helper.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, pageUrl);
  await helper.close();

  const popup = await context.newPage();
  await popup.setViewportSize({ width: 444, height: 530 });
  await popup.emulateMedia({ colorScheme: 'light' });
  await popup.goto(`chrome-extension://${extId}/popup/popup.html?tabId=${tabId}`);
  await popup.waitForFunction(() => !document.getElementById('copy').disabled);
  await popup.click('#copy');
  await popup.waitForSelector('#message:not([hidden])');
  await popup.evaluate(() => document.activeElement.blur());
  const popupShot = await popup.screenshot();
  await popup.close();
  await page.close();
  return { pageShot, popupShot };
}

const b64 = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
const FONT = `Loma, "Noto Sans Thai", "Liberation Sans", system-ui, sans-serif`;

function frame({ title, subtitle, pageShot, popupShot, accent = '#2563eb' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1280px; height: 800px; overflow: hidden; font-family: ${FONT};
      background: linear-gradient(135deg, ${accent} 0%, #1e3a8a 100%); color: #fff; }
    .head { padding: 34px 50px 0; height: 128px; }
    h1 { font-size: 36px; font-weight: 700; letter-spacing: -0.3px; }
    p { font-size: 19px; opacity: .9; margin-top: 8px; }
    .window { position: absolute; left: 50px; top: 140px; width: ${PAGE_W}px; height: 700px; border-radius: 12px 12px 0 0;
      overflow: hidden; background: #fff; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    .bar { height: 44px; background: #e5e7eb; display: flex; align-items: center; padding: 0 14px; gap: 8px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: #f87171; }
    .dot:nth-child(2) { background: #fbbf24; } .dot:nth-child(3) { background: #34d399; }
    .url { margin-left: 18px; flex: 1; height: 28px; border-radius: 14px; background: #fff; color: #4b5563;
      font: 14px/28px "Liberation Sans", sans-serif; padding: 0 14px; }
    .ext { width: 26px; height: 26px; border-radius: 6px; background: url(${b64(fs.readFileSync(path.join(root, 'icons/icon128.png')))}) center/cover; outline: 3px solid #93c5fd; }
    .page { display: block; }
    .popup { position: absolute; right: 60px; top: 180px; width: 444px; border-radius: 10px; overflow: hidden;
      box-shadow: 0 18px 50px rgba(0,0,0,.45); border: 1px solid #d1d5db; }
    .popup img { display: block; }
  </style></head><body>
    <div class="head"><h1>${title}</h1><p>${subtitle}</p></div>
    <div class="window">
      <div class="bar"><span class="dot"></span><span class="dot"></span><span class="dot"></span>
        <span class="url">${HOST}/posts/ai-tips</span><span class="ext"></span></div>
      <img class="page" src="${b64(pageShot)}">
    </div>
    <div class="popup"><img src="${b64(popupShot)}"></div>
  </body></html>`;
}

async function render(html, file, width, height) {
  const p = await context.newPage();
  await p.setViewportSize({ width, height });
  await p.setContent(html, { waitUntil: 'load' });
  await p.screenshot({ path: path.join(out, file) });
  await p.close();
  console.log(`store-assets/${file}`);
}

// 1. Whole page → main content
const s1 = await capture();
await render(
  frame({
    title: 'Copy any web page as clean Markdown for AI',
    subtitle: 'คัดลอกหน้าเว็บเป็น Markdown สะอาด ๆ ไปวางในแชต AI ได้ทันที · Alt+Shift+M แล้วกด Enter',
    ...s1,
  }),
  'screenshot-1.png',
  1280,
  800,
);

// 2. Selection only
const s2 = await capture({ select: true, scrollY: 160 });
await render(
  frame({
    title: 'Highlight text to convert just that part',
    subtitle: 'ไฮไลต์เฉพาะส่วนที่ต้องการ ตาราง ลิงก์ และรายการยังครบ',
    accent: '#0f766e',
    ...s2,
  }),
  'screenshot-2.png',
  1280,
  800,
);

// 3. Features & privacy
const icon = b64(fs.readFileSync(path.join(root, 'icons/icon128.png')));
const features = [
  ['Main content only', 'ตัดเมนู โฆษณา คอมเมนต์ออกให้อัตโนมัติ'],
  ['Hidden-text guard', 'ข้ามข้อความที่ซ่อนไว้ ป้องกันคำสั่งแอบแฝงถึง AI'],
  ['Tables, code & links', 'เก็บตาราง โค้ด ลิงก์ และรูปภาพครบ'],
  ['Edit before copying', 'แก้ไขได้ก่อนคัดลอก หรือดาวน์โหลดเป็นไฟล์ .md'],
  ['100% private', 'ทำงานในเบราว์เซอร์ ไม่ส่งข้อมูลออกไปไหน'],
  ['Minimal permissions', 'อ่านเฉพาะแท็บที่คุณกดเท่านั้น'],
];
await render(
  `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 1280px; height: 800px; font-family: ${FONT}; background: linear-gradient(135deg,#1e3a8a,#111827); color: #fff;
      display: flex; flex-direction: column; align-items: center; justify-content: center; padding-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 18px; }
    .brand img { width: 84px; height: 84px; }
    h1 { font-size: 46px; } .tag { font-size: 20px; opacity: .85; margin: 14px 0 46px; }
    .grid { display: grid; grid-template-columns: repeat(3, 340px); gap: 22px; }
    .card { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.15); border-radius: 14px; padding: 24px; height: 150px; }
    .card b { font-size: 22px; display: block; margin-bottom: 10px; } .card span { font-size: 17px; opacity: .85; line-height: 1.6; }
  </style></head><body>
    <div class="brand"><img src="${icon}"><h1>Web2MD</h1></div>
    <div class="tag">Copy page as Markdown · คัดลอกหน้าเว็บเป็น Markdown สำหรับ AI</div>
    <div class="grid">${features.map(([t, d]) => `<div class="card"><b>${t}</b><span>${d}</span></div>`).join('')}</div>
  </body></html>`,
  'screenshot-3.png',
  1280,
  800,
);

// Small promo tile
await render(
  `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; }
    body { width: 440px; height: 280px; font-family: ${FONT}; background: linear-gradient(135deg,#2563eb,#1e3a8a); color: #fff;
      display: flex; flex-direction: column; justify-content: center; padding: 0 36px; }
    .row { display: flex; align-items: center; gap: 14px; }
    img { width: 64px; height: 64px; } h1 { font-size: 38px; }
    p { font-size: 18px; margin-top: 16px; line-height: 1.45; opacity: .95; }
  </style></head><body>
    <div class="row"><img src="${icon}"><h1>Web2MD</h1></div>
    <p>Copy any web page as<br>clean Markdown for AI</p>
  </body></html>`,
  'promo-small.png',
  440,
  280,
);

await context.close();
server.close();
