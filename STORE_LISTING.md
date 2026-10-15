# Chrome Web Store listing – copy & paste

Fill these into the Developer Dashboard. Field limits are noted; everything below fits.

Images: run `npm run store-assets` → `store-assets/screenshot-1.png … 3.png` (1280×800) and `store-assets/promo-small.png` (440×280). Icon 128×128: `icons/icon128.png`.

---

## Store listing tab

**Name** (from `_locales/en/messages.json`, max 75)
```
Web2MD – Copy page as Markdown
```

**Summary** (from `_locales/en/messages.json` `extDescription`, max 132)
```
Convert the current page or your selection to clean Markdown and copy it, ready to paste into an AI chat.
```

**Category**: Productivity → Tools
**Language**: English. The extension now has a Thai UI, so you can also add a **Thai** listing in the Dashboard: the Thai name and summary come from `_locales/th/messages.json` automatically; use the Thai text below as its description.

**Description**
```
Copy any web page as clean Markdown, ready to paste into ChatGPT, Claude, Gemini or any AI chat.

Copying a whole page usually drags along menus, ads, cookie banners and comments. Web2MD keeps just the article – with headings, lists, tables, code blocks and links intact – so the AI focuses on what matters and you use fewer tokens.

HOW IT WORKS
• Click the Web2MD icon (or press Alt+Shift+M)
• Or highlight text, right-click → Copy selection as Markdown
• Check the Markdown in the preview and edit it if you like
• Press Enter to copy – or Download as a .md file

FEATURES
• Main content only – finds the article with Mozilla Readability, the engine behind Firefox Reader View
• Selection mode – highlight text first to convert just that part
• Right-click menu – copy a selection as Markdown in one click
• English and Thai interface
• Reads web components and same-site embedded frames too
• Keeps headings, lists, tables, code (with language), quotes, links and images
• Hidden-text guard – skips invisible text, a trick used to slip hidden instructions to AI
• Optional title + source URL header, optional images
• Token estimate (Thai-aware) and remembered options
• Cleans up odd spacing common on Thai websites

PRIVATE BY DESIGN
• Runs entirely in your browser. Nothing is sent anywhere – no servers, analytics or tracking.
• Reads only the tab you click it on, only when you click.
• Open source: https://github.com/jodpacharapon/web2md

—

ภาษาไทย
คัดลอกหน้าเว็บเป็น Markdown สะอาด ๆ ไปวางในแชต AI ได้ทันที ตัดเมนู โฆษณา และคอมเมนต์ออกให้ เก็บหัวข้อ ตาราง โค้ด และลิงก์ครบ

• กดไอคอน หรือ Alt+Shift+M แล้วกด Enter เพื่อคัดลอก
• ไฮไลต์ข้อความก่อน เพื่อแปลงเฉพาะส่วนที่ต้องการ
• หรือไฮไลต์แล้วคลิกขวา → "คัดลอกส่วนที่เลือกเป็น Markdown" คัดลอกได้ในคลิกเดียว
• หน้าจอภาษาไทยและอังกฤษ
• ข้ามข้อความที่ซ่อนไว้ ป้องกันคำสั่งแอบแฝงถึง AI
• ทำงานในเบราว์เซอร์ทั้งหมด ไม่ส่งข้อมูลออกไปไหน
```

**Official URL / Homepage URL**: `https://github.com/jodpacharapon/web2md`
**Support URL**: `https://github.com/jodpacharapon/web2md/issues`

---

## Privacy practices tab

**Single purpose** (required)
```
Web2MD converts the content of the current web page, or the user's text selection, into Markdown so the user can copy it or save it as a .md file.
```

**Permission justifications**

`activeTab`
```
Gives temporary access to the tab the user clicks the extension (or its right-click menu item) on, so its content can be converted to Markdown. No access to any other tab.
```

`contextMenus`
```
Adds one right-click menu item, "Copy selection as Markdown", shown only when text is selected. Choosing it opens the extension's popup, which converts and copies the selection.
```

`scripting`
```
Injects the content extractor (and the bundled Readability library) into the active tab after the user clicks the extension, to read the page's article or selected text.
```

`storage`
```
Remembers the user's three on/off options (title header, main content only, keep images) between uses.
```

**Are you using remote code?** → **No, I am not using remote code**
```
All JavaScript, including third-party libraries (Turndown, Mozilla Readability), is bundled in the package.
```

**Data usage** – tick **none** of the data types. Web2MD does not collect or transmit user data.
Then tick all three certifications:
- I do not sell or transfer user data to third parties, outside of the approved use cases
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** (after the repo is public)
```
https://github.com/jodpacharapon/web2md/blob/main/PRIVACY.md
```

---

## Distribution tab

- Visibility: **Public** (or **Unlisted** for a soft launch: only people with the link can install)
- Regions: All regions
- Pricing: Free
