import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// Turndown's browser build parses HTML with the global DOMParser, so provide one.
const dom = new JSDOM('');
globalThis.window = dom.window;
globalThis.DOMParser = dom.window.DOMParser;
globalThis.document = dom.window.document;

const { htmlToMarkdown } = await import('../src/convert.js');

test('converts headings, emphasis, links and lists', () => {
  const md = htmlToMarkdown(
    '<h1>Hello</h1><p>Some <strong>bold</strong> and <em>italic</em> with a <a href="https://example.com">link</a>.</p><ul><li>one</li><li>two</li></ul>',
    { includeHeader: false },
  );
  assert.match(md, /^# Hello/);
  assert.match(md, /\*\*bold\*\*/);
  assert.match(md, /\*italic\*/);
  assert.match(md, /\[link\]\(https:\/\/example\.com\)/);
  assert.match(md, /^-\s+one$/m);
});

test('lists use a single space after the marker, including nested and numbered lists', () => {
  const md = htmlToMarkdown(
    '<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul><ol start="3"><li>three</li><li>four</li></ol>',
    { includeHeader: false },
  );
  assert.equal(md, '- one\n  - nested\n- two\n\n3. three\n4. four\n');
});

test('converts fenced code blocks', () => {
  const md = htmlToMarkdown('<pre><code>const a = 1;\nconsole.log(a);</code></pre>', { includeHeader: false });
  assert.match(md, /```\nconst a = 1;\nconsole\.log\(a\);\n```/);
});

test('converts GFM tables', () => {
  const md = htmlToMarkdown(
    '<table><thead><tr><th>Name</th><th>Age</th></tr></thead><tbody><tr><td>Ann</td><td>30</td></tr></tbody></table>',
    { includeHeader: false },
  );
  assert.match(md, /\| Name \| Age \|/);
  assert.match(md, /\| --- \| --- \|/);
  assert.match(md, /\| Ann \| 30 \|/);
});

test('adds title and source URL header', () => {
  const md = htmlToMarkdown('<p>Body text</p>', { title: 'My Page', url: 'https://example.com/a' });
  assert.equal(md, '# My Page\n\nSource: https://example.com/a\n\nBody text\n');
});

test('does not repeat the title when content already starts with an h1', () => {
  const md = htmlToMarkdown('<h1>Real Title</h1><p>Body</p>', { title: 'Real Title | Site', url: 'https://example.com' });
  assert.equal(md, '# Real Title\n\nSource: https://example.com\n\nBody\n');
});

test('drops empty anchor links but keeps image links', () => {
  const md = htmlToMarkdown(
    '<h2>Usage<a href="#usage" aria-label="Permalink"><svg></svg></a></h2><p><a href="/x"><img src="https://e.com/a.png" alt="logo"></a></p>',
    { includeHeader: false },
  );
  assert.ok(!md.includes('[]('), md);
  assert.match(md, /^## Usage$/m);
  assert.match(md, /\[!\[logo\]\(https:\/\/e\.com\/a\.png\)\]\(\/x\)/);
});

test('returns an empty string for empty input', () => {
  assert.equal(htmlToMarkdown(''), '');
});

test('strips script and style content', () => {
  const md = htmlToMarkdown('<style>p{color:red}</style><script>alert(1)</script><p>Visible</p>', { includeHeader: false });
  assert.equal(md, 'Visible\n');
});
