import { extractPage } from '../src/extract.js';
import { htmlToMarkdown } from '../src/convert.js';

const $ = (id) => document.getElementById(id);
const output = $('output');
const copyButton = $('copy');
const modeBadge = $('mode');
const stats = $('stats');
const message = $('message');
const optHeader = $('opt-header');
const optCleanup = $('opt-cleanup');

let page = null; // { title, url, mode, html } from the last extraction

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('error', isError);
  message.hidden = !text;
}

function render() {
  if (!page) return;
  output.value = htmlToMarkdown(page.html, {
    title: page.title,
    url: page.url,
    includeHeader: optHeader.checked,
  });
  const chars = output.value.length;
  stats.textContent = chars ? `${chars.toLocaleString()} chars · ~${Math.ceil(chars / 4).toLocaleString()} tokens` : '';
  copyButton.disabled = chars === 0;
  if (!chars) showMessage('No readable content found on this page.', true);
}

async function extract() {
  showMessage('');
  copyButton.disabled = true;
  output.value = '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.id === undefined) {
    showMessage('Could not find the active tab.', true);
    return;
  }

  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPage,
      args: [{ cleanup: optCleanup.checked }],
    });
    page = result.result;
  } catch (err) {
    // chrome:// pages, the Chrome Web Store, PDFs viewers etc. can't be scripted.
    showMessage("Chrome doesn't allow extensions to read this page (e.g. chrome:// pages or the Web Store).", true);
    return;
  }

  modeBadge.hidden = false;
  modeBadge.textContent = page.mode === 'selection' ? 'Selection only' : 'Whole page';
  render();
}

async function copy() {
  try {
    await navigator.clipboard.writeText(output.value);
  } catch {
    // Fallback if the async clipboard API is refused.
    output.select();
    document.execCommand('copy');
  }
  showMessage('Copied! Paste it into your AI chat.');
}

copyButton.addEventListener('click', copy);
optHeader.addEventListener('change', render);
optCleanup.addEventListener('change', extract);

extract();
