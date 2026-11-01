---
name: lunaris-extension
description: Write, fix or update a Lunaris extension, the single JavaScript file that teaches the Lunaris reader app to search one manga, manhwa, manhua or light novel site and list its chapters and pages. Use when the user wants a Lunaris extension or source for a site, a repo index.json, or help with lunaris-ext.
---

# Writing a Lunaris extension

A Lunaris extension is one JavaScript file that calls `extension({ info, search, chapters, pages })`
once. Lunaris runs it in a sandbox (goja), not Node or a browser.

## Sources of truth

Read these before writing code, and follow them over anything below if they differ:

- The SDK guide: `README.md` in the SDK folder, or
  https://raw.githubusercontent.com/lunaris-app/sdk/main/README.md
- The exact API: `lunaris.d.ts`, same place
  (https://raw.githubusercontent.com/lunaris-app/sdk/main/lunaris.d.ts)
- A starting point: `template.js`
  (https://raw.githubusercontent.com/lunaris-app/sdk/main/template.js)

## Mistakes models make here

- **`fetch` is synchronous.** `fetch(url, { method, headers, body })` returns `{ status, text }`
  directly. Never write `await`, `async`, `.then`, `.json()` or `res.ok`. Parse JSON with
  `JSON.parse(res.text)`, and check `res.status` yourself (it doesn't throw on 404 or 500).
- **No DOM, Node or timers.** No `document`, `window`, `require`, `import`, `setTimeout`,
  `Buffer` or npm packages. Parse HTML with `html(text)`, whose nodes have `select(css)`,
  `text()`, `attr(name)` and `html()` (API 2 adds `querySelector`, `querySelectorAll`,
  `getAttribute`).
- **Return absolute URLs** for titles, chapters, pages and covers.
- **Chapters newest first.**
- **Throw on failure** with a short message. Never return placeholder or made-up data.
- **One page of search results per call.** Use the `page` argument; return `[]` when there
  are no more.
- **Don't fake the browser.** Don't set `User-Agent`, `Cookie`, `Origin` or `Referer`, and
  never try to get past Cloudflare or a captcha. Lunaris solves Cloudflare itself; for other
  human checks use `render(url, { verify: true })` and let the user pass it.
- **Keep `info.api` at 1** unless the script uses `render` or the DOM-style node names (then 2).
- **`info.id`** is lowercase letters, digits and dashes, the file is named `<id>.js`, and the
  id never changes. Raise `info.version` on every release.

## Workflow

1. **Study the site first.** Find its search, title and chapter URLs. Look for a JSON API
   (the site's own XHR calls, or an official API like MangaDex's) and prefer it over HTML
   scraping. If you can, fetch real pages with `curl` to get the actual selectors instead of
   guessing them. Use `render` only when there's no API and the content is built by the
   site's JavaScript.
2. **Start from `template.js`**, with `lunaris.d.ts` and `jsconfig.json` next to it, and keep
   the `/// <reference path="./lunaris.d.ts" />` line.
3. **Type-check:** `bunx tsc -p jsconfig.json` (or `npx tsc -p jsconfig.json`).
4. **Run every function** with `lunaris-ext` (from the SDK's Releases page) and check the
   output is real, absolute and in order. Arguments are JSON:

   ```sh
   lunaris-ext run my-site.js search '"one piece"' 1
   lunaris-ext run my-site.js chapters '"<a title url from search>"'
   lunaris-ext run my-site.js pages '"<a chapter url from chapters>"'
   ```

   `render` doesn't work in `lunaris-ext`; say so and ask the user to try those parts in the
   app.
5. **Publish:** put the script at `<repo>/<id>/<id>.js` and run `lunaris-ext index <repo>` to
   write `index.json`. Run it again after every change.

## Novels

Add `"novel"` to `info.kinds`, implement `text(url)` returning the chapter's HTML as the site
has it, and have `pages` return `[]`. Lunaris strips everything but basic text tags.

## Optional details

`details(url)` may return `description` (plain text, paragraphs split by `"\n"`), `tags`,
`status` (lowercase), `author`, `artist`, `altTitles`, `rating` (out of 10) and `bookmarks`.
Search results may also carry `kind` and `author`.
