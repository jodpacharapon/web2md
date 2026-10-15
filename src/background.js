// Service worker: only registers and handles the right-click menu.
// It never reads pages itself; the popup does that, as when you click the icon.
import { t } from './i18n.js';
import { MENU_ID, requestAutoCopy } from './menu.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: t('contextMenuCopySelection'), contexts: ['selection'] });
});

export async function onMenuClick(info, tab) {
  if (info.menuItemId !== MENU_ID || !tab || tab.id === undefined) return;
  // Not awaited yet: openPopup has to run while Chrome still counts this as the
  // user's click, and the popup takes longer to load than this write.
  const saved = requestAutoCopy(tab.id);
  try {
    await chrome.action.openPopup({ windowId: tab.windowId });
  } catch {
    // openPopup can fail (older Chrome, window not focused): open the same
    // page in a small window instead. The menu click granted activeTab either way.
    await saved;
    await chrome.windows.create({
      url: chrome.runtime.getURL(`popup/popup.html?tabId=${tab.id}`),
      type: 'popup',
      width: 460,
      height: 600,
    });
  }
}

chrome.contextMenus.onClicked.addListener(onMenuClick);
// Lets the end-to-end test trigger the menu (automation can't open native menus).
globalThis.web2mdOnMenuClick = onMenuClick;
