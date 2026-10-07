# Web2MD – Copy page as Markdown

A Chrome extension that turns the page you're reading (or just the text you've selected) into clean Markdown and copies it to your clipboard, ready to paste into an AI chat.

> **ภาษาไทย:** Extension สำหรับ Chrome ที่แปลงหน้าเว็บ (หรือเฉพาะข้อความที่ไฮไลต์) เป็น Markdown แล้วคัดลอกไปวางให้ AI อ่านได้ทันที

## Features

- Converts the whole page, or only your selection when you've highlighted text
- Previews the Markdown in the popup so you can edit it before copying
- Removes menus, sidebars, footers and scripts so the result is mostly content
- Keeps headings, lists, links, code blocks and tables (GitHub-flavoured Markdown)
- Turns relative links and image URLs into absolute ones
- Optional title + source URL header for extra context
- Shows a rough character / token estimate
- Runs entirely in your browser: no servers, no tracking, nothing leaves your machine

## Install for development

1. `npm install` (only needed for tests and updating libraries)
2. Open `chrome://extensions`, turn on **Developer mode**
3. Click **Load unpacked** and choose this folder
4. Open any web page and click the Web2MD icon

## Project layout

```
manifest.json      Manifest V3 definition
popup/             Popup UI (HTML, CSS, JS)
src/extract.js     Runs inside the page: picks selection/main content, strips noise
src/convert.js     HTML → Markdown (Turndown + GFM plugin)
lib/               Vendored Turndown libraries (MV3 forbids remotely hosted code)
icons/             Extension icons
tests/             Unit tests (npm test)
```

## Permissions

| Permission | Why |
| --- | --- |
| `activeTab` | Read the current page only after you click the extension |
| `scripting` | Run the extractor in that page |
| `clipboardWrite` | Copy the Markdown for you |

## Tests

```
npm test
```

## Updating bundled libraries

```
npm install turndown@latest turndown-plugin-gfm@latest
npm run vendor
```

## Publishing to the Chrome Web Store

1. Bump `version` in `manifest.json`
2. Zip the extension files (exclude `node_modules`, `tests`, `.git`):
   `zip -r web2md.zip manifest.json popup src lib icons`
3. Upload the zip in the Chrome Web Store Developer Dashboard, fill in the listing, privacy practices and screenshots, then submit for review

## Third-party code

Bundled under the MIT license: [Turndown](https://github.com/mixmark-io/turndown) and [turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm).

## License

Not chosen yet. Add a `LICENSE` file before making the project open source.
