import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

function load(html, url = 'https://example.com/blog/post') {
  const dom = new JSDOM(html, { url });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.location = dom.window.location;
  return dom;
}

const { extractPage } = await import('../src/extract.js');

test('uses <article>, strips nav/footer/scripts and absolutizes links', () => {
  load(`<!doctype html><title>Post</title><body>
    <nav>MENU</nav>
    <article><h1>Title</h1><p>Hello <a href="/about">about</a></p><script>x()</script>
      <img src="img/a.png"><footer>ARTICLE FOOTER</footer></article>
    <footer>SITE FOOTER</footer></body>`);
  const r = extractPage({ cleanup: true });
  assert.equal(r.mode, 'page');
  assert.equal(r.title, 'Post');
  assert.equal(r.url, 'https://example.com/blog/post');
  assert.match(r.html, /<h1>Title<\/h1>/);
  assert.match(r.html, /href="https:\/\/example\.com\/about"/);
  assert.match(r.html, /src="https:\/\/example\.com\/blog\/img\/a\.png"/);
  for (const noise of ['MENU', 'SITE FOOTER', 'ARTICLE FOOTER', 'x()']) {
    assert.ok(!r.html.includes(noise), `should not contain ${noise}`);
  }
});

test('keeps menus when cleanup is off', () => {
  load('<body><main><nav>MENU</nav><p>Body</p></main></body>');
  const r = extractPage({ cleanup: false });
  assert.ok(r.html.includes('MENU'));
});

test('falls back to <body> and drops the page-level header', () => {
  load('<body><header>SITE HEADER</header><p>Body text</p></body>');
  const r = extractPage({ cleanup: true });
  assert.ok(!r.html.includes('SITE HEADER'));
  assert.ok(r.html.includes('Body text'));
});

test('returns only the selection when text is selected', () => {
  const dom = load('<body><article><p id="a">First</p><p id="b">Second</p></article></body>');
  const range = dom.window.document.createRange();
  range.selectNodeContents(dom.window.document.getElementById('b'));
  const sel = dom.window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  const r = extractPage({ cleanup: true });
  assert.equal(r.mode, 'selection');
  assert.ok(r.html.includes('Second'));
  assert.ok(!r.html.includes('First'));
});
