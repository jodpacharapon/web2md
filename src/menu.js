// The right-click menu "Copy selection as Markdown".
//
// Clicking it opens the normal popup (so the user can still see what was
// copied) and asks the popup to copy straight away. The request goes through
// chrome.storage.session: in memory only, cleared when Chrome closes.

export const MENU_ID = 'web2md-copy-selection';
const KEY = 'autoCopy';
// A request older than this is stale (e.g. the popup never opened).
const MAX_AGE_MS = 15_000;

function sessionArea() {
  return globalThis.chrome && chrome.storage && chrome.storage.session ? chrome.storage.session : null;
}

export async function requestAutoCopy(tabId) {
  const area = sessionArea();
  if (area) await area.set({ [KEY]: { tabId, at: Date.now() } });
}

/** True (once) if the menu asked to copy this tab's selection just now. */
export async function takeAutoCopyRequest(tabId) {
  const area = sessionArea();
  if (!area) return false;
  try {
    const { [KEY]: request } = await area.get(KEY);
    if (!request) return false;
    await area.remove(KEY);
    return request.tabId === tabId && Date.now() - request.at < MAX_AGE_MS;
  } catch {
    return false;
  }
}
