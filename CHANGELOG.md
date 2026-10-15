# Changelog

## 0.3.0

- **Thai and English UI**, picked automatically from your Chrome language
- **Right-click menu**: highlight text, right-click, **Copy selection as Markdown**, and it's on your clipboard (still no clipboard permission needed)
- Reads content inside **same-origin iframes and web components** (shadow DOM), including a selection made inside an iframe
- **Stronger hidden-text guard**: also skips `.sr-only`-style clipping, 1px boxes, text pushed off-screen with `text-indent` or `translate`, `scale(0)`, transparent text, tiny fonts, near-zero opacity and `content-visibility: hidden` (gradient text is kept)
- Copy now says so when it fails, instead of always showing "Copied!"
- New permission: `contextMenus` (no install warning)
- Development: GitHub Actions CI runs unit tests, e2e tests in Chromium and the release build on every push; tagging `vX.Y.Z` publishes a GitHub Release with the Store zip

## 0.2.0

- Main-content extraction with Mozilla Readability, hidden-text guard, safe links, lazy images, remembered options, Alt+Shift+M shortcut, Download as `.md`, Thai-aware token estimate, release checks
