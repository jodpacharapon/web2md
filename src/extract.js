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
  const px = (value) => parseFloat(value);
  const FAR_OFF = -2000;

  // clip: rect(top, right, bottom, left) with no area left (".sr-only").
  const clippedAway = (clip) => {
    const m = /^rect\((.*)\)$/.exec(clip || '');
    if (!m) return false;
    const [top, right, bottom, left] = m[1].split(/[\s,]+/).map(px);
    if ([top, right, bottom, left].some(Number.isNaN)) return false;
    return right - left <= 1 || bottom - top <= 1;
  };

  // clip-path that leaves nothing: inset(50%) or more, circle(0), ellipse(0 0).
  const clipPathAway = (clipPath) =>
    /^inset\(\s*(5\d|[6-9]\d|100)(\.\d+)?%/.test(clipPath || '') ||
    /^(circle|ellipse)\(\s*0(px|%)?[\s)]/.test(clipPath || '');

  // transform that flattens the element (scale(0)) or moves it far away.
  // Chrome reports a matrix(); declared values (e.g. in tests) may still read scale(0).
  const transformedAway = (transform) => {
    if (!transform || transform === 'none') return false;
    if (/\bscale[XY]?\(\s*0[\s,)]/.test(transform)) return true;
    const m = /^matrix\((.*)\)$/.exec(transform);
    if (!m) return false;
    const [a, b, c, d, e, f] = m[1].split(',').map(px);
    return Math.abs(a * d - b * c) < 1e-6 || e < FAR_OFF || f < FAR_OFF;
  };

  const isTransparent = (color) => color === 'transparent' || /^rgba\(.*,\s*0(\.0+)?\)$/.test(color || '');

  const isHidden = (el) => {
    if (el.hidden || el.getAttribute('aria-hidden') === 'true') return true;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse') return true;
    if (cs.contentVisibility === 'hidden') return true;
    if (cs.opacity !== '' && Number(cs.opacity) < 0.05) return true;
    if (px(cs.fontSize) <= 1) return true;
    // Pushed far off-screen (a common hiding trick).
    if ((cs.position === 'absolute' || cs.position === 'fixed') && (px(cs.left) < FAR_OFF || px(cs.top) < FAR_OFF)) {
      return true;
    }
    if (px(cs.textIndent) < FAR_OFF / 2) return true;
    if (transformedAway(cs.transform)) return true;
    if (clippedAway(cs.clip) || clipPathAway(cs.clipPath)) return true;
    // A box of 1px or less that cuts off its content (".sr-only", collapsed panels).
    const clips = (overflow) => overflow === 'hidden' || overflow === 'clip';
    if (clips(cs.overflowX || cs.overflow) && px(cs.width) <= 1) return true;
    if (clips(cs.overflowY || cs.overflow) && px(cs.height) <= 1) return true;
    // Transparent text, unless it's gradient text (background-clip: text) or has a shadow.
    if (
      isTransparent(cs.color) &&
      cs.backgroundClip !== 'text' &&
      cs.webkitBackgroundClip !== 'text' &&
      (!cs.textShadow || cs.textShadow === 'none')
    ) {
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
