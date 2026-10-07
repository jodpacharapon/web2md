# Security

## Reporting a problem

Please open a GitHub issue, or for anything sensitive contact the maintainer privately through GitHub before posting details publicly.

## Security review (v0.2.0)

Reviewed before the first public release. Most checks run automatically in `npm run build` and the test suites.

### Permissions – minimal

| Permission | Install warning | Why |
| --- | --- | --- |
| `activeTab` | none | Read only the tab you clicked the icon on, only at that moment |
| `scripting` | none (with activeTab only) | Run the extractor in that tab |
| `storage` | none | Remember the three options |

No host permissions, no `tabs`, no `clipboardWrite` (removed: copying from the popup works without it), no content scripts, no background worker, no `web_accessible_resources`, no `externally_connectable`. `npm run build` refuses to package anything else.

### No data leaves the browser

There are no network calls in the extension code (`fetch`, XHR, WebSocket, `sendBeacon`, remote `import`). `npm run build` fails if one is added. All libraries are bundled in `lib/` (Manifest V3 forbids remote code).

### Untrusted page content

The page is hostile input. How it's handled:

| Risk | Mitigation | Tested in |
| --- | --- | --- |
| Script in the page running in the popup | Page HTML is parsed with `DOMParser` (inert: no scripts, no event handlers, no image loads). The popup never uses `innerHTML`; output goes into a `<textarea>` as text | `convert.test.mjs` "never executed" |
| Strict CSP for extension pages | `script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`. Build check rejects `unsafe-*`, inline scripts and inline handlers | `npm run build` |
| **Prompt injection via hidden text** (e.g. `display:none` "ignore previous instructions…") pasted into an AI | Elements that aren't visible are removed before conversion: `display:none`, `visibility:hidden`, opacity 0, font-size 0, far off-screen, `hidden`, `aria-hidden`. The popup tells the user how many were skipped | `extract.test.mjs`, e2e |
| Visible prompt-injection text | Cannot be detected reliably; it is visible to the user too. Users should review before pasting (the popup shows the full text) | – |
| `javascript:` / `data:` / `vbscript:` links | Turned into plain text; only `http`, `https`, `mailto`, `ftp` links are kept | `convert.test.mjs` |
| Huge base64 `data:` images | Dropped | `convert.test.mjs` |
| Page leaves markers behind | Temporary `data-web2md-hidden` attributes are removed in a `finally` block | `extract.test.mjs`, e2e |
| Very large pages freezing the popup | HTML over 3M characters is refused with a message to select part of the page | – |
| Markdown-breaking URLs | `(`, `)` and spaces are percent-encoded | `convert.test.mjs` |
| Unsafe file names on Download | Characters not allowed on Windows/macOS are stripped | `convert.test.mjs` |

### The `?tabId=` popup parameter

Used by the end-to-end tests to open the popup for a specific tab. It grants nothing: Chrome still requires `activeTab` (from a user click) for `scripting.executeScript`, and web pages cannot open or frame extension pages because there are no `web_accessible_resources`.

### Supply chain

- Third-party code: Turndown (MIT), turndown-plugin-gfm (MIT), Mozilla Readability (Apache-2.0). Copied into `lib/` by `npm run vendor`, licenses included.
- Dev dependencies only (`jsdom`, `playwright`) are never shipped. `npm audit`: 0 vulnerabilities at review time.
- When updating libraries: `npm install <pkg>@latest`, `npm run vendor`, read the diff in `lib/`, run all tests.

### Before every release

```
npm test
npm run test:e2e
npm audit
npm run build
```
