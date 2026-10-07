// Copy third-party browser builds and their licenses from node_modules into lib/.
// Manifest V3 forbids loading code from the network, so libraries ship inside the extension.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const nm = (p) => path.join(root, 'node_modules', p);
const lib = (p) => path.join(root, 'lib', p);

const files = [
  ['turndown/lib/turndown.browser.es.js', 'turndown.browser.es.js'],
  ['turndown/LICENSE', 'LICENSE.turndown.txt'],
  ['turndown-plugin-gfm/lib/turndown-plugin-gfm.browser.es.js', 'turndown-plugin-gfm.browser.es.js'],
  ['turndown-plugin-gfm/LICENSE', 'LICENSE.turndown-plugin-gfm.txt'],
  ['@mozilla/readability/Readability.js', 'Readability.js'],
  ['@mozilla/readability/LICENSE.md', 'LICENSE.readability.md'],
];

fs.mkdirSync(path.join(root, 'lib'), { recursive: true });
for (const [from, to] of files) {
  fs.copyFileSync(nm(from), lib(to));
  console.log(`lib/${to}`);
}
