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
  // Links with no visible text (e.g. the "#" anchor icons next to headings on
  // GitHub and docs sites) would become "[](#x)" noise.
  service.addRule('emptyLink', {
    filter: (node) => node.nodeName === 'A' && !node.textContent.trim() && !node.querySelector('img'),
    replacement: () => '',
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
      content = content
        .replace(/^\n+/, '')
        .replace(/\n+$/, '\n')
        .replace(/\n/gm, `\n${indent}`);
      const trailing = node.nextSibling && !/\n$/.test(content) ? '\n' : '';
      return prefix + content + trailing;
    },
  });
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
    const source = url ? `Source: ${url}` : '';
    const leadingH1 = md.match(/^# .*(\n|$)/);
    if (leadingH1) {
      // The content already starts with its own title: keep it, put the source under it.
      const rest = md.slice(leadingH1[0].length).replace(/^\n+/, '');
      md = [leadingH1[0].trim(), source, rest].filter(Boolean).join('\n\n');
    } else {
      md = [title && `# ${title}`, source, md].filter(Boolean).join('\n\n');
    }
  }

  return md ? `${md}\n` : '';
}
