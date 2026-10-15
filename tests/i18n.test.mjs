import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const LOCALES = fs.readdirSync(path.join(root, '_locales'));
const messages = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(read(`_locales/${l}/messages.json`))]));

test('English and Thai are both present', () => {
  assert.deepEqual(LOCALES.sort(), ['en', 'th']);
  assert.equal(JSON.parse(read('manifest.json')).default_locale, 'en');
});

test('every language has the same keys and placeholders', () => {
  const placeholders = (m) => Object.keys(m.placeholders || {}).sort().join(',');
  for (const locale of LOCALES) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), Object.keys(messages.en).sort(), locale);
    for (const [key, m] of Object.entries(messages.en)) {
      assert.equal(placeholders(messages[locale][key]), placeholders(m), `${locale}: ${key}`);
      for (const name of Object.keys(m.placeholders || {})) {
        assert.ok(messages[locale][key].message.includes(`$${name.toUpperCase()}$`), `${locale}: ${key} doesn't use $${name}$`);
      }
    }
  }
});

test('every key used in the code exists, and every key is used', () => {
  const sources = ['manifest.json', 'popup/popup.html', 'popup/popup.js', 'src/background.js'].map(read).join('\n');
  const used = new Set([
    ...[...sources.matchAll(/__MSG_(\w+)__/g)].map((m) => m[1]),
    ...[...sources.matchAll(/\bt\('(\w+)'/g)].map((m) => m[1]),
    ...[...sources.matchAll(/data-i18n(?:-[a-z-]+)?="(\w+)"/g)].map((m) => m[1]),
    // MODE_LABELS maps extraction modes to message keys.
    ...[...read('popup/popup.js').matchAll(/: '(mode\w+)'/g)].map((m) => m[1]),
  ]);
  for (const key of used) assert.ok(messages.en[key], `missing message "${key}"`);
  for (const key of Object.keys(messages.en)) assert.ok(used.has(key), `unused message "${key}"`);
});

test('store limits: name ≤ 75 characters, description ≤ 132', () => {
  for (const locale of LOCALES) {
    assert.ok([...messages[locale].extName.message].length <= 75, `${locale} name`);
    assert.ok([...messages[locale].extDescription.message].length <= 132, `${locale} description`);
  }
});
