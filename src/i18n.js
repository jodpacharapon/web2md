// UI text from _locales/<lang>/messages.json. Chrome picks the language from the
// browser settings; English is the fallback (default_locale in manifest.json).

/** The translated message, or the key itself if it's missing (easy to spot). */
export function t(key, substitutions) {
  const i18n = globalThis.chrome && chrome.i18n;
  const message = i18n ? i18n.getMessage(key, substitutions) : '';
  return message || key;
}

/**
 * Fill in elements marked with data-i18n (text), data-i18n-title,
 * data-i18n-placeholder and data-i18n-aria-label.
 */
export function localize(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const attr of ['title', 'placeholder', 'aria-label']) {
    for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) {
      el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
    }
  }
  const lang = globalThis.chrome && chrome.i18n && chrome.i18n.getUILanguage();
  if (lang) document.documentElement.lang = lang;
}
