// Runs INSIDE the web page via chrome.scripting.executeScript({ func: extractPage }).
// It must stay self-contained: it cannot reference anything outside this function.
//
// Returns the HTML to convert (the user's selection if there is one, otherwise the
// main content of the page) plus basic page info. Relative links and image URLs are
// turned into absolute ones so the Markdown still works when pasted elsewhere.
export function extractPage(options) {
  const cleanup = !options || options.cleanup !== false;

  const absolutize = (root) => {
    root.querySelectorAll('a[href]').forEach((a) => {
      const raw = a.getAttribute('href') || '';
      if (raw.startsWith('#') || /^javascript:/i.test(raw)) return;
      if (a.href) a.setAttribute('href', a.href);
    });
    root.querySelectorAll('img[src]').forEach((img) => {
      if (img.src && !img.src.startsWith('data:')) img.setAttribute('src', img.src);
    });
  };

  const selection = window.getSelection();
  let html = '';
  let mode = 'page';

  if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
    const holder = document.createElement('div');
    for (let i = 0; i < selection.rangeCount; i++) {
      holder.appendChild(selection.getRangeAt(i).cloneContents());
    }
    absolutize(holder);
    html = holder.innerHTML;
    mode = 'selection';
  } else {
    const main =
      document.querySelector('article') ||
      document.querySelector('main') ||
      document.querySelector('[role="main"]');
    const root = main || document.body;
    const clone = root.cloneNode(true);

    // Things that are never useful as Markdown.
    clone
      .querySelectorAll('script, style, noscript, template, iframe, svg, canvas, [hidden], [aria-hidden="true"]')
      .forEach((n) => n.remove());

    if (cleanup) {
      // Site chrome: menus, footers, sidebars, forms, cookie banners.
      clone.querySelectorAll('nav, footer, aside, form, [role="navigation"], [role="banner"], [role="contentinfo"]').forEach((n) => n.remove());
      // A page-level <header> is site chrome; an <article>'s own header holds the title.
      if (!main) clone.querySelectorAll('header').forEach((n) => n.remove());
    }

    absolutize(clone);
    html = clone.innerHTML;
  }

  return {
    title: document.title || '',
    url: location.href,
    mode,
    html,
  };
}
