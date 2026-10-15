import { extractPage } from '../src/extract.js';
import { htmlToMarkdown, estimateTokens, fileNameFor } from '../src/convert.js';
import { loadSettings, saveSettings } from '../src/settings.js';
import { t, localize } from '../src/i18n.js';
import { takeAutoCopyRequest } from '../src/menu.js';

const MODE_LABELS = { selection: 'modeSelection', article: 'modeArticle', page: 'modePage' };
// Beyond this the conversion can freeze the popup for a long time (and the
// result is too big for an AI chat anyway).
const MAX_HTML_CHARS = 3_000_000;

const $ = (id) => document.getElementById(id);
const ui = {
  output: $('output'),
  copy: $('copy'),
  download: $('download'),
  mode: $('mode'),
  stats: $('stats'),
  message: $('message'),
  notice: $('notice'),
  options: {
    includeHeader: $('opt-includeHeader'),
    cleanup: $('opt-cleanup'),
    includeImages: $('opt-includeImages'),
  },
};

const state = {
  settings: null,
  page: null, // result of extractPage()
};

// --- UI helpers ---------------------------------------------------------------

function showMessage(text, { error = false } = {}) {
  ui.message.textContent = text;
  ui.message.classList.toggle('error', error);
  ui.message.hidden = !text;
  // Don't leave "Converting…" showing next to an error.
  ui.output.placeholder = error ? '' : t('converting');
}

function setBusy(busy) {
  ui.copy.disabled = busy;
  ui.download.disabled = busy;
  if (busy) ui.output.value = '';
}

// --- Page access --------------------------------------------------------------

async function targetTab() {
  // `?tabId=123` opens the popup as a normal page for a given tab (used by the
  // end-to-end tests). It grants nothing: Chrome still requires activeTab or a
  // host permission for that tab, and web pages can't open this URL.
  const forcedTabId = Number(new URLSearchParams(location.search).get('tabId'));
  if (forcedTabId) return chrome.tabs.get(forcedTabId);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function extractFrom(tabId, settings) {
  const target = { tabId };
  if (settings.cleanup) {
    await chrome.scripting.executeScript({ target, files: ['lib/Readability.js'] });
  }
  const [injection] = await chrome.scripting.executeScript({
    target,
    func: extractPage,
    args: [{ cleanup: settings.cleanup }],
  });
  return injection.result;
}

// --- Main flow ----------------------------------------------------------------

function render() {
  const { page, settings } = state;
  if (!page) return;

  const markdown = htmlToMarkdown(page.html, {
    title: page.title,
    url: page.url,
    baseUrl: page.baseUrl,
    includeHeader: settings.includeHeader,
    includeImages: settings.includeImages,
  });
  ui.output.value = markdown;

  const chars = markdown.length;
  ui.stats.textContent = chars
    ? t('stats', [chars.toLocaleString(), estimateTokens(markdown).toLocaleString()])
    : '';
  ui.copy.disabled = chars === 0;
  ui.download.disabled = chars === 0;

  if (!chars) {
    showMessage(t('errorNoContent'), { error: true });
  } else {
    ui.copy.focus(); // so Enter copies straight away
  }

  ui.notice.hidden = !page.hiddenRemoved;
  ui.notice.textContent = page.hiddenRemoved ? t('skippedHidden', [page.hiddenRemoved.toLocaleString()]) : '';
}

async function extract() {
  showMessage('');
  setBusy(true);
  state.page = null;

  const tab = await targetTab().catch(() => null);
  if (!tab || tab.id === undefined) {
    showMessage(t('errorNoTab'), { error: true });
    return;
  }

  try {
    state.page = await extractFrom(tab.id, state.settings);
  } catch {
    showMessage(t('errorUnreadable'), { error: true });
    return;
  }

  ui.mode.hidden = false;
  ui.mode.textContent = MODE_LABELS[state.page.mode] ? t(MODE_LABELS[state.page.mode]) : '';

  if (typeof state.page.html !== 'string' || state.page.html.length > MAX_HTML_CHARS) {
    state.page = null;
    showMessage(t('errorTooLarge'), { error: true });
    return;
  }
  render();
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback if the async clipboard API is refused (e.g. the popup isn't focused yet).
    ui.output.select();
    return document.execCommand('copy');
  }
}

async function copy() {
  if (ui.copy.disabled) return;
  if (await writeClipboard(ui.output.value)) {
    showMessage(t('copied'));
  } else {
    showMessage(t('copyFailed'), { error: true });
    ui.copy.focus();
  }
}

function download() {
  if (ui.download.disabled) return;
  const blob = new Blob([ui.output.value], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = fileNameFor(state.page && state.page.title);
  link.hidden = true;
  // Chrome only honours the `download` name for links that are in the document.
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  showMessage(t('saved', [link.download]));
}

async function onOptionChange(key) {
  state.settings[key] = ui.options[key].checked;
  await saveSettings(state.settings);
  // Clean-up changes what we extract; the other options only change rendering.
  if (key === 'cleanup') await extract();
  else render();
}

async function init() {
  localize();
  state.settings = await loadSettings();
  for (const [key, input] of Object.entries(ui.options)) {
    input.checked = state.settings[key];
    input.addEventListener('change', () => onOptionChange(key));
  }
  ui.copy.addEventListener('click', copy);
  ui.download.addEventListener('click', download);
  // Ctrl/Cmd+Enter copies even while editing the text.
  ui.output.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      copy();
    }
  });
  // Opened from the right-click menu: copy as soon as the Markdown is ready.
  const tab = await targetTab().catch(() => null);
  const autoCopy = !!tab && (await takeAutoCopyRequest(tab.id));
  await extract();
  if (autoCopy && !ui.copy.disabled) await copy();
}

init();
