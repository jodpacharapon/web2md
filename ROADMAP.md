# Roadmap

Priorities for getting Web2MD from a working prototype to a public Chrome Web Store release.

- **P0** – needed before publishing
- **P1** – should ship in the first public versions
- **P2** – nice to have, later

## Done in v0.2.0

| Item | Why it mattered |
| --- | --- |
| Main-content extraction with Mozilla Readability (Firefox Reader View), with fallback | Biggest quality win: removes menus, comments and "related posts" on sites without an `<article>` tag, such as many Thai sites |
| Skip hidden text (`display:none`, off-screen, zero opacity/size, `hidden`, `aria-hidden`) | Hidden text is a prompt-injection channel when the Markdown is pasted into an AI |
| Unsafe links (`javascript:`, `data:`, `vbscript:`) become plain text; in-page `#anchors` dropped | Safer and cleaner output |
| Lazy-loaded images (`data-src`) resolved, `data:` images dropped | Real images instead of placeholders; no huge base64 blobs |
| "Keep images" option | Fewer tokens when the AI doesn't need images |
| Options remembered (`chrome.storage.sync`) | Users don't re-tick boxes every time |
| Keyboard shortcut **Alt+Shift+M**, then **Enter** to copy (Ctrl/⌘+Enter while editing) | Two keys from page to clipboard |
| Download as `.md` | Save pages for later or for tools that take files |
| Token estimate that accounts for Thai | Thai uses more tokens per character than English |
| Removed the `clipboardWrite` permission | One less install warning; copying works without it |
| Size guard for huge pages | Popup no longer risks freezing |
| `npm run build` with automatic release checks | Can't accidentally ship tests, host permissions, remote code or network calls |

## P0 – before publishing

| Item | Owner | Notes |
| --- | --- | --- |
| Try it on the sites you actually use (Blockdit, Pantip, news, docs) | You | Send any page where the output is poor; the extractor can be tuned |
| Store listing assets | You (+ Claude can draft) | 1280×800 screenshots, 440×280 promo tile, description in Thai and English |
| Host the privacy policy at a public URL | You | `PRIVACY.md` is ready; GitHub's file URL works once the repo is public |
| Choose a license | You | MIT is the usual choice for small open-source tools |
| Single-purpose description for the Store review | Claude can draft | "Converts the current web page to Markdown for pasting into AI tools" |

## P1 – first public versions

| Item | Why |
| --- | --- |
| Thai / English UI (`_locales`) | Most early users are likely Thai; Chrome picks the language automatically |
| Right-click menu "Copy selection as Markdown" | Fastest path for partial copies; needs the `contextMenus` permission (no install warning) |
| GitHub Actions CI (unit + e2e + build on every push) | Catches regressions before you test by hand |
| Site-specific tweaks found during P0 testing | E.g. Blockdit, Pantip comment threads |
| Content from iframes and shadow DOM | Some sites render articles inside these |

## P2 – later

| Item | Why |
| --- | --- |
| Prompt templates ("Summarise this:", "Translate to Thai:") prepended on copy | Saves typing in the AI chat |
| YAML front matter option (title, url, date) | For note apps like Obsidian |
| Firefox and Edge builds | Edge works with the Chrome build already; Firefox needs small manifest changes |
| Automated Store publishing from GitHub Actions | After the first manual upload |
| Split very long pages into chunks that fit an AI's context window | Useful for long docs |
