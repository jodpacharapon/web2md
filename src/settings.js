// User options, remembered between popup openings with chrome.storage.sync
// (synced across the user's Chrome profiles, never sent anywhere else).

export const DEFAULT_SETTINGS = Object.freeze({
  includeHeader: true, // "# Title" + "Source: url" on top
  cleanup: true, // keep only the main content
  includeImages: true, // keep ![alt](src)
});

function storage() {
  return globalThis.chrome && chrome.storage && chrome.storage.sync ? chrome.storage.sync : null;
}

export async function loadSettings() {
  const area = storage();
  if (!area) return { ...DEFAULT_SETTINGS };
  try {
    const saved = await area.get(Object.keys(DEFAULT_SETTINGS));
    const merged = { ...DEFAULT_SETTINGS };
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof saved[key] === 'boolean') merged[key] = saved[key];
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  const area = storage();
  if (!area) return;
  const clean = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) clean[key] = Boolean(settings[key]);
  try {
    await area.set(clean);
  } catch {
    // Storage full or unavailable: the popup still works with in-memory settings.
  }
}
