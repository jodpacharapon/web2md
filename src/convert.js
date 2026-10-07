import TurndownService from '../lib/turndown.browser.es.js';
import { gfm } from '../lib/turndown-plugin-gfm.browser.es.js';

const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'ftp:']);

/**
 * Resolve a URL against the page and keep it only if it's safe to paste.
 * Returns '' for javascript:, data:, vbscript:, etc. In-page "#anchors" are
 * dropped too: they mean nothing once the text leaves the page.
 */
export function safeUrl(raw, baseUrl) {
  const value = (raw || '').trim();
  if (!value || value.startsWith('#')) return '';
  let url;
  try {
    url = new URL(value, baseUrl || undefined);
  } catch {
    return '';
  }
  if (!SAFE_PROTOCOLS.has(url.protocol)) return '';
  // Parentheses and spaces would break Markdown link syntax.
  return url.href.replace(/\(/g, '%28').replace(/\)/g, '%29').replace(/ /g, '%20');
}

function createService({ baseUrl, includeImages }) {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
    hr: '---',
  });
  // GitHub-flavoured Markdown: tables, strikethrough, task lists.
  service.use(gfm);
  // Drop elements whose contents are never meaningful text.
  service.remove(['style', 'script', 'noscript', 'template']);

  // Links: absolute URLs only, unsafe schemes reduced to plain text, links
  // with no visible text (heading "#" permalink icons) removed entirely.
  service.addRule('link', {
    filter: (node) => node.nodeName === 'A' && node.getAttribute('href') !== null,
    replacement(content, node) {
      const text = content.trim();
      const hasImage = !!node.querySelector('img');
      if (!text) return '';
      const href = safeUrl(node.getAttribute('href'), baseUrl);
      if (!href) return content;
      // A link whose text is its own URL reads better as a bare autolink-ish URL.
      if (!hasImage && (text === href || text === node.getAttribute('href'))) return `<${href}>`;
      return `[${text}](${href})`;
    },
  });

  // Images: optional, absolute, and lazy-loading aware (data-src etc).
  service.addRule('image', {
    filter: 'img',
    replacement(_content, node) {
      if (!includeImages) return '';
      const candidates = [
        node.getAttribute('src'),
        node.getAttribute('data-src'),
        node.getAttribute('data-lazy-src'),
        node.getAttribute('data-original'),
      ];
      const src = candidates.map((c) => safeUrl(c, baseUrl)).find(Boolean);
      if (!src) return '';
      const alt = (node.getAttribute('alt') || '').replace(/[\[\]\n]+/g, ' ').trim();
      return `![${alt}](${src})`;
    },
  });

  // Turndown pads list markers to 4 columns ("-   item"). Use a single space
  // ("- item"), which is what people write and costs fewer tokens.
  service.addRule('listItem', {
    filter: 'li',
    replacement(content, node, options) {
      const parent = node.parentNode;
      let prefix = `${options.bulletListMarker} `;
      if (parent.nodeName === 'OL') {
        const start = Number(parent.getAttribute('start')) || 1;
        const index = Array.prototype.indexOf.call(parent.children, node);
        prefix = `${start + index}. `;
      }
      const indent = ' '.repeat(prefix.length);
      const body = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n/gm, `\n${indent}`);
      const trailing = node.nextSibling && !/\n$/.test(body) ? '\n' : '';
      return prefix + body + trailing;
    },
  });

  return service;
}

/**
 * Remove the odd spacing web pages leave behind, without touching code:
 * - non-breaking spaces (&nbsp;, common on Thai sites) become normal spaces
 * - runs of spaces inside a line collapse to one (list indentation is kept)
 * - trailing spaces go (Turndown writes <br> as "two spaces + newline")
 * - 3+ newlines collapse to one blank line
 */
export function tidyWhitespace(md) {
  // Odd-indexed parts are fenced code blocks or `inline code`; leave them as-is.
  const parts = md.split(/(```[\s\S]*?```|`[^`\n]*`)/);
  for (let i = 0; i < parts.length; i += 2) {
    parts[i] = parts[i]
      .replace(/ /g, ' ')
      .replace(/(\S) {2,}/g, '$1 ')
      // Only strip spaces before a newline: a segment can end right before inline code.
      .replace(/[ \t]+(?=\n)/g, '');
  }
  return parts.join('').replace(/\n{3,}/g, '\n\n').trim();
}

/** Put "# Title" and "Source: url" at the top, without repeating an existing H1. */
function addHeader(md, title, url) {
  const source = url ? `Source: ${url}` : '';
  const leadingH1 = md.match(/^# .*(\n|$)/);
  if (leadingH1) {
    const rest = md.slice(leadingH1[0].length).replace(/^\n+/, '');
    return [leadingH1[0].trim(), source, rest].filter(Boolean).join('\n\n');
  }
  return [title && `# ${title}`, source, md].filter(Boolean).join('\n\n');
}

/**
 * Convert an HTML string to Markdown.
 *
 * @param {string} html
 * @param {object} [opts]
 * @param {string} [opts.title]          page title, used for the header
 * @param {string} [opts.url]            page URL, used for the header
 * @param {string} [opts.baseUrl]        base for resolving relative links (defaults to url)
 * @param {boolean} [opts.includeHeader] put "# Title" and "Source: url" on top (default true)
 * @param {boolean} [opts.includeImages] keep images as ![alt](src) (default true)
 */
export function htmlToMarkdown(html, opts = {}) {
  const { title = '', url = '', baseUrl = url, includeHeader = true, includeImages = true } = opts;
  let md = createService({ baseUrl, includeImages }).turndown(html || '');
  md = tidyWhitespace(md);
  if (!md) return '';
  if (includeHeader && (title || url)) md = addHeader(md, title, url);
  return `${md}\n`;
}

/** Rough token estimate. Thai and other non-Latin scripts use more tokens per character. */
export function estimateTokens(text) {
  const nonLatin = (text.match(/[^\x00-\x7F]/g) || []).length;
  const latin = text.length - nonLatin;
  return Math.ceil(latin / 4 + nonLatin / 1.5);
}

/** A safe file name for "Download .md" (keeps Thai and other letters). */
export function fileNameFor(title) {
  const base = (title || 'page')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim();
  return `${base || 'page'}.md`;
}
