// Build the zip to upload to the Chrome Web Store: dist/web2md-<version>.zip
//
// Before zipping it runs release checks, so a risky build can't slip out:
// - only whitelisted folders/files are packed (no tests, node_modules, .git)
// - manifest asks for no host permissions and no unexpected permissions
// - no remotely hosted code (MV3 rule) and no eval-like code in our own files
//
// No dependencies: the zip is written with Node's built-in zlib.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INCLUDE = ['manifest.json', 'popup', 'src', 'lib', 'icons'];
const ALLOWED_PERMISSIONS = ['activeTab', 'scripting', 'storage'];
const ALLOWED_EXT = new Set(['.json', '.html', '.css', '.js', '.png', '.md', '.txt']);

const problems = [];
const fail = (msg) => problems.push(msg);

// --- collect files ------------------------------------------------------------
function walk(rel) {
  const abs = path.join(root, rel);
  if (!fs.existsSync(abs)) {
    fail(`missing ${rel}`);
    return [];
  }
  if (fs.statSync(abs).isFile()) return [rel];
  return fs.readdirSync(abs).sort().flatMap((name) => walk(path.posix.join(rel, name)));
}
const files = INCLUDE.flatMap(walk);

// --- release checks -----------------------------------------------------------
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
if (manifest.manifest_version !== 3) fail('manifest_version must be 3');
if (manifest.host_permissions?.length) fail(`host_permissions must be empty, got ${JSON.stringify(manifest.host_permissions)}`);
if (manifest.optional_host_permissions?.length) fail('optional_host_permissions are not expected');
if (manifest.content_scripts?.length) fail('content_scripts are not expected (we inject on click only)');
if (manifest.web_accessible_resources?.length) fail('web_accessible_resources would let web pages load extension files');
if (manifest.externally_connectable) fail('externally_connectable would let web pages message the extension');
for (const p of manifest.permissions || []) {
  if (!ALLOWED_PERMISSIONS.includes(p)) fail(`unexpected permission "${p}" (update ALLOWED_PERMISSIONS on purpose if needed)`);
}
const csp = manifest.content_security_policy?.extension_pages || '';
if (/unsafe-eval|unsafe-inline|https?:/.test(csp)) fail(`CSP is too loose: ${csp}`);

for (const rel of files) {
  const ext = path.extname(rel);
  if (!ALLOWED_EXT.has(ext)) fail(`unexpected file type in package: ${rel}`);
  if (ext === '.html') {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) fail(`inline <script> in ${rel} (blocked by CSP)`);
    if (/<(script|link)[^>]+(src|href)=["']https?:/i.test(html)) fail(`remote resource in ${rel}`);
    if (/\son[a-z]+=/i.test(html)) fail(`inline event handler in ${rel}`);
  }
  if (ext === '.js' && !rel.startsWith('lib/')) {
    const js = fs.readFileSync(path.join(root, rel), 'utf8');
    if (/\beval\s*\(|new Function\s*\(|\.innerHTML\s*=|insertAdjacentHTML|document\.write\s*\(/.test(js)) {
      fail(`risky DOM/eval API in ${rel}`);
    }
    if (/\bimport\s*\(\s*['"]https?:|fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/.test(js)) {
      fail(`network access in ${rel} (Web2MD should never send data anywhere)`);
    }
  }
}

if (problems.length) {
  console.error('Release checks failed:\n' + problems.map((p) => `  ✗ ${p}`).join('\n'));
  process.exit(1);
}

// --- write the zip ------------------------------------------------------------
function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

const local = [];
const central = [];
let offset = 0;
const { time, day } = dosTime(new Date());
for (const rel of files) {
  const data = fs.readFileSync(path.join(root, rel));
  const deflated = zlib.deflateRawSync(data, { level: 9 });
  const name = Buffer.from(rel, 'utf8');
  const crc = zlib.crc32(data);

  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4); // version needed
  header.writeUInt16LE(0x0800, 6); // UTF-8 names
  header.writeUInt16LE(8, 8); // deflate
  header.writeUInt16LE(time, 10);
  header.writeUInt16LE(day, 12);
  header.writeUInt32LE(crc, 14);
  header.writeUInt32LE(deflated.length, 18);
  header.writeUInt32LE(data.length, 22);
  header.writeUInt16LE(name.length, 26);
  local.push(header, name, deflated);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0);
  entry.writeUInt16LE(20, 4);
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt16LE(time, 12);
  entry.writeUInt16LE(day, 14);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(deflated.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);

  offset += header.length + name.length + deflated.length;
}
const centralSize = central.reduce((n, b) => n + b.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(files.length, 8);
end.writeUInt16LE(files.length, 10);
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16);

const out = path.join(root, 'dist', `web2md-${manifest.version}.zip`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([...local, ...central, end]));
console.log(`Release checks passed. ${files.length} files → ${path.relative(root, out)} (${(fs.statSync(out).size / 1024).toFixed(1)} KB)`);
