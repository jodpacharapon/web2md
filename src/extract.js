// Runs INSIDE the web page via chrome.scripting.executeScript({ func: extractPage }).
// It must stay self-contained: it cannot use imports or anything outside this
// function. `lib/Readability.js` is injected first, so `globalThis.Readability`
// is available when the user asked for clean-up.
//
// Returns the HTML to convert plus page info:
//   { title, url, baseUrl, mode: 'selection' | 'article' | 'page', html, hiddenRemoved }
export function extractPage(options = {}) {
  const cleanup = options.cleanup !== false;
  const HIDDEN_ATTR = 'data-web2md-hidden';

  // --- 1. Find text the reader can't see -----------------------------------
  // Hidden text is a prompt-injection channel ("ignore previous instructions…"
  // in a display:none div), so we drop it before anything is converted. We tag
  // the live elements, clone, then remove the tags again in `finally`.
  const isHidden = (el) => {
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return true;
    if (cs.opacity !== '' && Number(cs.opacity) === 0) return true;
    if (parseFloat(cs.fontSize) === 0) return true;
    // Pushed far off-screen (a common hiding trick).
    if ((cs.position === 'absolute' || cs.position === 'fixed') && (parseFloat(cs.left) < -2000 || parseFloat(cs.top) < -2000)) {
      return true;
    }
    return false;
  };

  const tagged = [];
  const tagHidden = () => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(el) {
        // Don't look inside things we drop anyway, or inside hidden subtrees.
        if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|SVG)$/i.test(el.nodeName)) return NodeFilter.FILTER_REJECT;
        if (isHidden(el)) {
          el.setAttribute(HIDDEN_ATTR, '');
          tagged.push(el);
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    while (walker.nextNode());
  };

  const NOISE = 'script, style, noscript, template, iframe, object, embed, svg, canvas, button, input, select, textarea';
  const CHROME = 'nav, footer, aside, form, dialog, [role="navigation"], [role="banner"], [role="contentinfo"], [role="dialog"], [role="alert"]';
  const strip = (root, selector) => root.querySelectorAll(selector).forEach((n) => n.remove());

  try {
    if (document.body) tagHidden();

    // The page title often ends in " | Site name". Prefer the visible <h1>
    // when the page title contains it (true for most articles).
    const pageTitle = (document.title || '').trim();
    const h1 = document.querySelector(`h1:not([${HIDDEN_ATTR}])`);
    const h1Text = h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : '';
    const bestTitle = h1Text && pageTitle.includes(h1Text) ? h1Text : pageTitle;

    const result = {
      title: bestTitle,
      url: location.href,
      baseUrl: document.baseURI,
      mode: 'page',
      html: '',
      hiddenRemoved: tagged.length,
    };

    // --- 2. The user's selection wins --------------------------------------
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      const holder = document.createElement('div');
      for (let i = 0; i < selection.rangeCount; i++) {
        holder.appendChild(selection.getRangeAt(i).cloneContents());
      }
      strip(holder, `[${HIDDEN_ATTR}], ${NOISE}`);
      result.mode = 'selection';
      result.html = holder.innerHTML;
      return result;
    }

    // --- 3. Main article via Readability (Firefox Reader View) -------------
    if (cleanup && typeof globalThis.Readability === 'function') {
      const doc = document.cloneNode(true);
      strip(doc, `[${HIDDEN_ATTR}]`);
      try {
        // keepClasses: code blocks carry their language in class="language-js".
        const article = new globalThis.Readability(doc, { keepClasses: true }).parse();
        const text = article && article.textContent ? article.textContent.trim() : '';
        if (text.length >= 200) {
          result.mode = 'article';
          if (bestTitle === pageTitle && article.title) result.title = article.title.trim();
          result.html = article.content;
          return result;
        }
      } catch (err) {
        // Fall through to the simple heuristic below.
      }
    }

    // --- 4. Fallback: <article>/<main>/<body> minus site chrome ------------
    const main = document.querySelector('article') || document.querySelector('main') || document.querySelector('[role="main"]');
    const root = (main || document.body).cloneNode(true);
    strip(root, `[${HIDDEN_ATTR}], ${NOISE}`);
    if (cleanup) {
      strip(root, CHROME);
      // A page-level <header> is site chrome; an <article>'s own header holds the title.
      if (!main) strip(root, 'header');
    }
    result.html = root.innerHTML;
    return result;
  } finally {
    tagged.forEach((el) => el.removeAttribute(HIDDEN_ATTR));
  }
}
