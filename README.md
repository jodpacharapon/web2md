# Web2MD – Copy page as Markdown

A Chrome extension that turns the page you're reading (or just the text you've selected) into clean Markdown and copies it to your clipboard, ready to paste into an AI chat.

> **ภาษาไทย:** Extension สำหรับ Chrome ที่แปลงหน้าเว็บ (หรือเฉพาะข้อความที่ไฮไลต์) เป็น Markdown แล้วคัดลอกไปวางให้ AI อ่านได้ทันที ทำงานในเบราว์เซอร์ทั้งหมด ไม่ส่งข้อมูลออกไปไหน

## Features

- **Main content only**: finds the article with Mozilla Readability (the engine behind Firefox Reader View), dropping menus, ads, comments and footers
- **Selection mode**: highlight text first to convert only that part
- **Preview and edit** the Markdown before copying, or **download** it as a `.md` file
- Keeps headings, lists, links, code blocks (with language), tables and quotes
- Absolute links and images; lazy-loaded images resolved; options to drop images or the title/URL header
- **Skips hidden text**, so invisible prompt-injection tricks on a page don't end up in your AI chat
- Cleans up odd spacing from `&nbsp;` and line breaks (common on Thai sites)
- Token estimate, options remembered between uses
- Shortcut: **Alt+Shift+M** opens it, **Enter** copies
- Private: no network requests, no tracking ([privacy policy](PRIVACY.md))

## Install for development

1. Open `chrome://extensions`, turn on **Developer mode**
2. Click **Load unpacked** and choose this folder
3. Open any web page and click the Web2MD icon (or press Alt+Shift+M)

After pulling changes, click the reload icon on the Web2MD card in `chrome://extensions`.

## Project layout

```
manifest.json        Manifest V3 definition
popup/               Popup UI (HTML, CSS, JS)
src/extract.js       Runs inside the page: selection / Readability / fallback, skips hidden text
src/convert.js       HTML → Markdown (Turndown + GFM), safe links/images, whitespace clean-up
src/settings.js      Remembered options (chrome.storage.sync)
lib/                 Bundled third-party libraries + licenses (MV3 forbids remote code)
icons/               Extension icons
scripts/vendor.mjs   Copies libraries from node_modules into lib/
scripts/build.mjs    Release checks + Chrome Web Store zip
tests/               Unit tests; tests/e2e/ runs the real extension in Chromium
```

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the current page only after you click the extension |
| `scripting` | Run the extractor in that page |
| `storage` | Remember your options |

See [SECURITY.md](SECURITY.md) for the full security review.

## Development

```
npm install                       # dev tools only; the extension itself needs no build step
npm test                          # unit tests (Node + jsdom)
npx playwright install chromium   # first time only
npm run test:e2e                  # real extension in Chromium; screenshots in tests/e2e/screenshots/
npm run test:e2e -- https://example.com/some-article   # also try real pages
npm run build                     # release checks + dist/web2md-<version>.zip
```

The e2e test can't click the toolbar icon, so it loads a temporary copy with host permissions added. The shipped extension only uses `activeTab`.

Updating bundled libraries:

```
npm install turndown@latest turndown-plugin-gfm@latest @mozilla/readability@latest
npm run vendor
```

## Publishing to the Chrome Web Store

1. Bump `version` in `manifest.json` (and `package.json`)
2. Run the checks in [SECURITY.md](SECURITY.md#before-every-release), then `npm run build`
3. Upload `dist/web2md-<version>.zip` in the Chrome Web Store Developer Dashboard, fill in the listing, privacy practices (link to `PRIVACY.md`) and screenshots, then submit for review

What's next: [ROADMAP.md](ROADMAP.md).

## Third-party code

Bundled: [Turndown](https://github.com/mixmark-io/turndown) (MIT), [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) (MIT), [Mozilla Readability](https://github.com/mozilla/readability) (Apache-2.0). License texts are in `lib/`.

## License

Not chosen yet. Add a `LICENSE` file before making the project open source.
