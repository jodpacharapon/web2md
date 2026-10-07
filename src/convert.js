import TurndownService from '../lib/turndown.browser.es.js';
import { gfm } from '../lib/turndown-plugin-gfm.browser.es.js';

function createService() {
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
  service.remove(['style', 'script', 'noscript']);
  return service;
}

/**
 * Convert an HTML string to Markdown.
 *
 * @param {string} html
 * @param {{ title?: string, url?: string, includeHeader?: boolean }} [opts]
 *   includeHeader: put the page title and source URL at the top (handy context for an AI).
 */
export function htmlToMarkdown(html, opts = {}) {
  const { title = '', url = '', includeHeader = true } = opts;
  let md = createService().turndown(html || '');

  // Collapse runs of blank lines left over from stripped markup.
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  if (includeHeader && (title || url)) {
    const lines = [];
    // Don't repeat the title if the page content already starts with a top-level heading.
    if (title && !/^#\s/.test(md)) lines.push(`# ${title}`);
    if (url) lines.push(`Source: ${url}`);
    if (lines.length) md = `${lines.join('\n\n')}\n\n${md}`;
  }

  return md ? `${md}\n` : '';
}
