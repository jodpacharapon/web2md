// End-to-end test: loads the real extension into Chromium, opens a page,
// opens the popup for that tab, checks the Markdown and the clipboard,
// and saves screenshots to tests/e2e/screenshots/.
//
// Usage: node tests/e2e/run.mjs [extra-url ...]
//
// Note: in real use Chrome grants access through `activeTab` when you click the
// icon. Automation can't click the toolbar, so the test loads a temporary copy
// of the extension with host permissions added. Everything else is the real code.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const shots = path.join(here, 'screenshots');
fs.mkdirSync(shots, { recursive: true });

// 1. Temporary copy of the extension with host permissions for automation.
const extDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web2md-ext-'));
for (const item of ['manifest.json', 'popup', 'src', 'lib', 'icons']) {
  fs.cpSync(path.join(root, item), path.join(extDir, item), { recursive: true });
}
const manifest = JSON.parse(fs.readFileSync(path.join(extDir, 'manifest.json'), 'utf8'));
manifest.host_permissions = ['<all_urls>'];
fs.writeFileSync(path.join(extDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

// 2. Serve the fixture pages.
const fixtures = path.join(here, 'fixtures');
const server = http.createServer((req, res) => {
  const file = path.join(fixtures, decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(fixtures) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(fs.readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

// 3. Launch Chromium with the extension.
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web2md-profile-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  channel: 'chromium',
  headless: true,
  viewport: { width: 1100, height: 760 },
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`],
});
await context.grantPermissions(['clipboard-read', 'clipboard-write']);

// Find the extension id from chrome://extensions-internals is awkward; use the
// popup URL pattern instead: open any extension page via the management API.
async function extensionId() {
  const page = await context.newPage();
  await page.goto('chrome://extensions/');
  const id = await page.evaluate(async () => {
    const items = await new Promise((r) => chrome.developerPrivate.getExtensionsInfo(r));
    return items.find((e) => e.name.startsWith('Web2MD')).id;
  });
  await page.close();
  return id;
}
const extId = await extensionId();
console.log('Extension loaded:', extId);

// Look up a tab id while the page is on an http(s) URL the extension can see.
async function tabIdOf(page) {
  const helper = await context.newPage();
  await helper.goto(`chrome-extension://${extId}/popup/popup.html`);
  const id = await helper.evaluate(async (url) => (await chrome.tabs.query({ url }))[0].id, page.url());
  await helper.close();
  return id;
}

async function openPopupFor(page, { cleanup = true, tabId } = {}) {
  tabId ??= await tabIdOf(page);
  const popup = await context.newPage();
  await popup.setViewportSize({ width: 444, height: 520 });
  await popup.goto(`chrome-extension://${extId}/popup/popup.html?tabId=${tabId}`);
  if (!cleanup) await popup.uncheck('#opt-cleanup');
  await popup.waitForFunction(() => !document.getElementById('copy').disabled || !document.getElementById('message').hidden);
  return popup;
}

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(['PASS', name]);
  } catch (err) {
    results.push(['FAIL', name, err.message.split('\n')[0]]);
  }
}

// --- Scenario 1: whole page -------------------------------------------------
const page = await context.newPage();
await page.goto(`${base}/blog.html`);
await page.screenshot({ path: path.join(shots, '1-page.png') });

const popup = await openPopupFor(page);
const md = await popup.inputValue('#output');
fs.writeFileSync(path.join(shots, 'whole-page.md'), md);
await popup.screenshot({ path: path.join(shots, '2-popup-whole-page.png') });

await check('whole page: badge says "Whole page"', async () =>
  assert.equal(await popup.textContent('#mode'), 'Whole page'));
await check('whole page: Thai heading kept', () => assert.match(md, /^# วิธีใช้ Markdown กับ AI$/m));
await check('whole page: title first, then source URL', () =>
  assert.ok(md.startsWith(`# วิธีใช้ Markdown กับ AI\n\nSource: ${base}/blog.html\n\n`), md.slice(0, 120)));
await check('whole page: bold/italic', () => {
  assert.match(md, /\*\*เข้าใจโครงสร้าง\*\*/);
  assert.match(md, /\*ประหยัด token\*/);
});
await check('whole page: relative link made absolute', () =>
  assert.match(md, new RegExp(`\\[คู่มือ\\]\\(${base}/docs/guide\\.html\\)`)));
await check('whole page: image made absolute', () =>
  assert.match(md, new RegExp(`!\\[แผนภาพ\\]\\(${base}/img/diagram\\.png\\)`)));
await check('whole page: fenced code block', () => assert.match(md, /```js?\nconst md = htmlToMarkdown\(html\);/));
await check('whole page: table', () => {
  assert.match(md, /\| รูปแบบ \| Token \| อ่านง่าย \|/);
  assert.match(md, /\| Markdown \| 900 \| ใช่ \|/);
});
await check('whole page: blockquote', () => assert.match(md, /^> ส่ง Markdown/m));
await check('whole page: no nav/sidebar/footer/cookie/script noise', () => {
  for (const noise of ['NAV MENU', 'SIDEBAR AD', 'SITE FOOTER', 'SITE HEADER', 'COOKIE BANNER', 'TRACKING SCRIPT']) {
    assert.ok(!md.includes(noise), `found "${noise}"`);
  }
});

// --- Scenario 2: copy button -> clipboard ------------------------------------
await check('copy button puts the Markdown on the clipboard', async () => {
  await popup.click('#copy');
  await popup.waitForSelector('#message:not([hidden])');
  assert.equal(await popup.textContent('#message'), 'Copied! Paste it into your AI chat.');
  const clip = await popup.evaluate(() => navigator.clipboard.readText());
  assert.equal(clip, md);
});
await popup.screenshot({ path: path.join(shots, '3-popup-copied.png') });

// --- Scenario 3: title/URL header toggle ------------------------------------
await check('unchecking "Add title & source URL" removes the header', async () => {
  await popup.uncheck('#opt-header');
  const v = await popup.inputValue('#output');
  assert.ok(!v.includes('Source:'));
  await popup.check('#opt-header');
});
await popup.close();

// --- Scenario 4: selection only ---------------------------------------------
await page.evaluate(() => {
  const table = document.querySelector('table');
  const range = document.createRange();
  range.selectNode(table);
  getSelection().removeAllRanges();
  getSelection().addRange(range);
});
const selPopup = await openPopupFor(page);
const selMd = await selPopup.inputValue('#output');
fs.writeFileSync(path.join(shots, 'selection.md'), selMd);
await selPopup.screenshot({ path: path.join(shots, '4-popup-selection.png') });
await check('selection: badge says "Selection only"', async () =>
  assert.equal(await selPopup.textContent('#mode'), 'Selection only'));
await check('selection: only the table is converted', () => {
  assert.match(selMd, /\| Markdown \| 900 \| ใช่ \|/);
  assert.ok(!selMd.includes('ข้อดี'), 'contains text outside the selection');
});
await selPopup.close();

// --- Scenario 5: page without <article>, cleanup on and off ------------------
const plain = await context.newPage();
await plain.goto(`${base}/plain.html`);
const plainPopup = await openPopupFor(plain);
const plainMd = await plainPopup.inputValue('#output');
fs.writeFileSync(path.join(shots, 'plain-page.md'), plainMd);
await check('no <article>: content kept, header/nav/footer removed', () => {
  assert.match(plainMd, /^# Release notes$/m);
  assert.match(plainMd, /`offline mode`/);
  assert.match(plainMd, /^1\. Install the update\n2\. Restart the app$/m);
  for (const noise of ['SITE HEADER', 'NAV MENU', 'SITE FOOTER']) assert.ok(!plainMd.includes(noise), `found "${noise}"`);
});
await check('cleanup off: menus are kept', async () => {
  await plainPopup.uncheck('#opt-cleanup');
  await plainPopup.waitForFunction(() => document.getElementById('output').value.includes('NAV MENU'), null, { timeout: 5000 });
});
await plainPopup.close();
await plain.close();

// --- Scenario 6: pages Chrome won't let extensions read --------------------
const blocked = await context.newPage();
await blocked.goto(`${base}/blog.html?tab=blocked`); // unique URL so we find this tab, not the first one
const blockedTabId = await tabIdOf(blocked);
await blocked.goto('chrome://version/');
const blockedPopup = await openPopupFor(blocked, { tabId: blockedTabId });
await blockedPopup.screenshot({ path: path.join(shots, '5-popup-blocked-page.png') });
await check('chrome:// page shows a friendly error', async () => {
  assert.match(await blockedPopup.textContent('#message'), /doesn't allow extensions/);
  assert.ok(await blockedPopup.isDisabled('#copy'));
});
await blockedPopup.close();
await blocked.close();

// --- Optional: real websites passed on the command line ---------------------
for (const [i, url] of process.argv.slice(2).entries()) {
  const live = await context.newPage();
  try {
    await live.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await live.waitForTimeout(1500);
    const p = await openPopupFor(live);
    const out = await p.inputValue('#output');
    fs.writeFileSync(path.join(shots, `live-${i + 1}.md`), out);
    await p.screenshot({ path: path.join(shots, `6-live-${i + 1}.png`) });
    await check(`live site ${url}: produced Markdown (${out.length} chars)`, () => {
      assert.ok(out.length > 200);
      assert.ok(!out.includes('[]('), 'contains empty links');
    });
    await p.close();
  } catch (err) {
    results.push(['SKIP', `live site ${url}`, err.message.split('\n')[0]]);
  }
  await live.close();
}

await context.close();
server.close();

for (const [status, name, detail] of results) console.log(`${status}  ${name}${detail ? `  — ${detail}` : ''}`);
const failed = results.filter((r) => r[0] === 'FAIL').length;
console.log(`\n${results.length - failed} passed, ${failed} failed. Screenshots: ${path.relative(root, shots)}/`);
process.exit(failed ? 1 : 0);
