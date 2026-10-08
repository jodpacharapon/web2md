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
  assert.match(md, /\[link\]\(https:\/\/example\.com\/\)/);
  assert.match(md, /^-\s+one$/m);
});

test('lists use a single space after the marker, including nested and numbered lists', () => {
  const md = htmlToMarkdown(
    '<ul><li>one<ul><li>nested</li></ul></li><li>two</li></ul><ol start="3"><li>three</li><li>four</li></ol>',
    { includeHeader: false },
  );
  assert.equal(md, '- one\n  - nested\n- two\n\n3. three\n4. four\n');
});

test('cleans up &nbsp;, double spaces and <br> trailing spaces, but not code', () => {
  const md = htmlToMarkdown(
    '<div>เสนอว่า&nbsp;&nbsp;ขอให้ซื้อ<br>ราคา 1,000 บาท<br><br>โอนให้&nbsp; 800 บาท</div>' +
      '<p>ย่อหน้า&nbsp;&nbsp;&nbsp;ถัดไป <code>a  b</code></p><pre><code>keep    this</code></pre>' +
      '<ul><li>one<ul><li>nested</li></ul></li></ul>',
    { includeHeader: false },
  );
  assert.equal(
    md,
    'เสนอว่า ขอให้ซื้อ\nราคา 1,000 บาท\n\nโอนให้ 800 บาท\n\nย่อหน้า ถัดไป `a b`\n\n```\nkeep    this\n```\n\n- one\n  - nested\n',
  );
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
    { includeHeader: false, baseUrl: 'https://e.com/' },
  );
  assert.ok(!md.includes('[]('), md);
  assert.match(md, /^## Usage$/m);
  assert.match(md, /\[!\[logo\]\(https:\/\/e\.com\/a\.png\)\]\(https:\/\/e\.com\/x\)/);
});

test('returns an empty string for empty input', () => {
  assert.equal(htmlToMarkdown(''), '');
});

test('strips script and style content', () => {
  const md = htmlToMarkdown('<style>p{color:red}</style><script>alert(1)</script><p>Visible</p>', { includeHeader: false });
  assert.equal(md, 'Visible\n');
});

const { safeUrl, estimateTokens, fileNameFor } = await import('../src/convert.js');

test('relative links and images are resolved against the page', () => {
  const md = htmlToMarkdown('<p><a href="../about">About</a> <img src="img/a.png" alt="A"></p>', {
    includeHeader: false,
    baseUrl: 'https://example.com/blog/post',
  });
  assert.equal(md, '[About](https://example.com/about) ![A](https://example.com/blog/img/a.png)\n');
});

test('unsafe link schemes become plain text', () => {
  const md = htmlToMarkdown(
    '<p><a href="javascript:alert(1)">click</a> <a href="JaVaScRiPt:evil()">x</a> <a href="data:text/html,hi">d</a> <a href="vbscript:x">v</a></p>',
    { includeHeader: false, baseUrl: 'https://example.com/' },
  );
  assert.equal(md, 'click x d v\n');
});

test('in-page #anchors become plain text', () => {
  assert.equal(htmlToMarkdown('<p><a href="#intro">Intro</a></p>', { includeHeader: false }), 'Intro\n');
});

test('data: images and images without a usable src are dropped; lazy data-src is used', () => {
  const md = htmlToMarkdown(
    '<p><img src="data:image/png;base64,AAAA" alt="tiny"><img alt="nosrc"><img src="data:image/gif;base64,R0" data-src="/real.jpg" alt="lazy"></p>',
    { includeHeader: false, baseUrl: 'https://example.com/' },
  );
  assert.equal(md, '![lazy](https://example.com/real.jpg)\n');
});

test('includeImages: false removes images, and links that only wrapped an image', () => {
  const md = htmlToMarkdown('<p>Text <img src="/a.png" alt="a"> <a href="/x"><img src="/b.png"></a></p>', {
    includeHeader: false,
    includeImages: false,
    baseUrl: 'https://example.com/',
  });
  assert.equal(md, 'Text\n');
});

test('URLs with parentheses and spaces do not break Markdown', () => {
  assert.equal(safeUrl('/wiki/Foo_(bar) baz', 'https://example.com/'), 'https://example.com/wiki/Foo_%28bar%29%20baz');
});

test('a link whose text is its URL becomes <url>', () => {
  const md = htmlToMarkdown('<p><a href="https://example.com/x">https://example.com/x</a></p>', { includeHeader: false });
  assert.equal(md, '<https://example.com/x>\n');
});

test('HTML in the page is never executed by the converter', async () => {
  globalThis.__pwned = false;
  htmlToMarkdown('<img src="x" onerror="globalThis.__pwned = true"><script>globalThis.__pwned = true</script>', {
    includeHeader: false,
  });
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(globalThis.__pwned, false);
});

test('estimateTokens counts Thai more heavily than English', () => {
  assert.equal(estimateTokens('abcdefgh'), 2);
  assert.ok(estimateTokens('ภาษาไทยภาษาไทย') > estimateTokens('abcdefghijklmn'));
});

test('fileNameFor keeps Thai, strips characters Windows does not allow', () => {
  assert.equal(fileNameFor('[ลงทุนแมน] จ่าย 1,000: รับ 800?'), '[ลงทุนแมน] จ่าย 1,000 รับ 800.md');
  assert.equal(fileNameFor(''), 'page.md');
  assert.equal(fileNameFor('a/b\\c'), 'a b c.md');
});

test('numbered headings are not escaped, but numbered paragraphs still are', () => {
  const md = htmlToMarkdown('<h2>1. Send only what you need</h2><p>2. Not a list item</p>', { includeHeader: false });
  assert.equal(md, '## 1. Send only what you need\n\n2\\. Not a list item\n');
});
