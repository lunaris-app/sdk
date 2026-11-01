# Lunaris extension SDK

Everything you need to write an extension for [Lunaris](https://github.com/lunaris-app/release),
the desktop reader for manga, manhwa, manhua and light novels.

| File            | What it is                                              |
| --------------- | ------------------------------------------------------- |
| `template.js`   | A starter extension to copy                             |
| `lunaris.d.ts`  | Types for the extension API, for autocomplete and checks |
| `jsconfig.json` | Switches type checking on for scripts in the folder     |

## The lunaris-ext tool

`lunaris-ext` runs one function of your script and prints the result, and builds a repo's
`index.json`. Download it for your system from the
[Releases page](https://github.com/lunaris-app/sdk/releases/latest), put it on your `PATH`,
and on macOS or Linux make it executable (`chmod +x lunaris-ext`).

It has no browser, so `render` doesn't work in it and a Cloudflare check is reported
rather than solved. Try those parts in the app.

## Writing an extension

An extension is one JavaScript file that teaches Lunaris to read one site: how to search
it, list a title's chapters, and list a chapter's pages. Lunaris downloads the file from a
repo and runs it in a sandbox, so there is nothing to compile or sign.

### Quick start

1. Copy `template.js`, `lunaris.d.ts` and `jsconfig.json` into a folder of your own, and
   name the script after its id: `my-site.js`.
2. Fill in `info` and the CSS selectors for your site.
3. Try each function with [`lunaris-ext`](#the-lunaris-ext-tool):

   ```sh
   lunaris-ext run my-site.js search '"one piece"' 1
   lunaris-ext run my-site.js chapters '"https://my-site.com/title/123"'
   lunaris-ext run my-site.js pages '"https://my-site.com/chapter/456"'
   ```

   It prints what the function returns as JSON, or the error with its line number.
   Arguments are JSON, so wrap strings in double quotes inside single quotes.

4. Publish it (see [Publishing a repo](#publishing-a-repo)).

For editor checks (autocomplete and type errors), keep `/// <reference path="./lunaris.d.ts" />`
at the top of the script. The `jsconfig.json` next to it switches type checking on in
VS Code; `bunx tsc -p jsconfig.json` runs the same check from the terminal.

### The shape of an extension

A script calls `extension()` exactly once:

```js
/// <reference path="./lunaris.d.ts" />
const BASE = "https://my-site.com";

extension({
  info: {
    id: "my-site", // lowercase letters, digits, dashes; never change it
    name: "My Site",
    lang: "en", // or "ja", …, "multi"
    kinds: ["manga"], // any of manga, manhwa, manhua, novel
    version: "1.0.0", // raise on every release
    api: 1, // the host API you wrote it for
    content: "sfw", // "sfw", "mixed" (some adult titles) or "nsfw" (mostly adult)
    site: "https://my-site.com", // optional: its icon becomes the extension's icon
  },

  search(query, page) {
    /* return [{ title, url, cover? }] */
  },
  chapters(url) {
    /* return [{ title, url }], newest first */
  },
  pages(url) {
    /* return ["https://…/1.jpg", …] in reading order */
  },
});
```

| Function              | Gets                                | Returns                                             |
| --------------------- | ----------------------------------- | --------------------------------------------------- |
| `search(query, page)` | the user's text; `page` starts at 1 | titles: `{ title, url, cover? }`; `[]` when no more |
| `chapters(url)`       | a title's `url` from `search`       | chapters: `{ title, url }`, newest first            |
| `pages(url)`          | a chapter's `url` from `chapters`   | image URLs, in reading order                        |
| `details(url)`        | a title's `url` from `search`       | optional; see below                                 |
| `text(url)`           | a chapter's `url` from `chapters`   | novels only: the chapter as HTML                    |

Search results may also carry `kind` and `author`. `details(url)` is optional: Lunaris
calls it when a title is first opened and when the user refreshes it, never during
background update checks. It returns any of `description` (plain text, paragraphs split by
`"\n"`), `tags`, `status` (lowercase, such as `"ongoing"`), `author`, `artist`, `altTitles`,
`rating` (out of 10) and `bookmarks` (followers on the source).

Extensions with `"novel"` in `info.kinds` implement `text(url)` instead of returning pages
(`pages` can return `[]`). Return the chapter's HTML as the site has it: Lunaris keeps only
basic text tags (paragraphs, line breaks, emphasis, headings, lists, quotes) and drops
every attribute, image, link and script before showing or saving it.

Return absolute URLs. Lunaris passes the `url` you returned straight back to the next
function, and loads images and covers from the URLs as given.

### What a script can use

Only these, on top of plain JavaScript (ES2022: arrow functions, template strings,
destructuring, `?.`, `??`, `JSON`, `RegExp`, …):

- `fetch(url, { method, headers, body })` returns `{ status, text }`. It **blocks** until the
  response arrives, so there is no `await` and no `.then`. It throws on network errors but
  not on error statuses: check `status` yourself.
- `html(text)` parses HTML and returns a node:
  - `select(css)`: the descendants that match, as an array of nodes
  - `text()`: the text content, trimmed
  - `attr(name)`: an attribute, or `""` when it's missing
  - `html()`: the inner HTML
  - `querySelector(css)`, `querySelectorAll(css)` and `getAttribute(name)`: the DOM's
    names for the same thing, returning `null` when nothing matches, so code written for
    node-html-parser ports over (API 2)
- `render(url, { waitFor })` loads the page in a hidden browser window, runs the site's own
  JavaScript, and returns the resulting HTML as a string for `html()` (API 2). `waitFor` is
  a CSS selector to wait for when the site adds content after the page loads. It blocks
  like `fetch`, takes seconds rather than milliseconds, and throws if the page isn't ready
  within 30 seconds. It only works in the app, not in `lunaris-ext`.

  With `script`, a JavaScript expression, `render` runs it inside the loaded page (awaiting
  a promise) and returns its result instead of the HTML: a string as is, anything else as
  JSON. Use it when the content needs a click, or only arrives through the site's own API
  calls: the JSON responses the page gets (from any host) are in `window.__lunaris.responses`
  (`{ url, text }`), and `lunaris:response` fires on `window` for each. The script runs in
  the site's page, not your extension, so pass any helper in as source:
  ``render(url, { script: `(${fn})(${JSON.stringify(arg)})` })``. Timers fire only about
  once a second in the hidden window, so wait on that event or a `MutationObserver` rather
  than polling.

  With `verify: true`, the page may need the user: a "verify you're human" box, or a site
  that hands out a token only after one. If the page or the script hasn't finished after
  10 seconds, Lunaris shows the window, titled "Verify to continue: <site>", until `render`
  returns; closing it cancels. Waiting for the page then gets up to two minutes, but the
  whole call still stops at one minute. Have the script wait without a timeout of its own
  while the user acts.

There is no DOM (`document`, `window`), no `require` or `import`, no file system and no
timers. Sites whose content is built by their own JavaScript usually have a JSON API behind
it: open the browser's network tab, find that request, and `JSON.parse(fetch(api).text)`.
Reach for `render` only when there's no such API.

### Rules

- **One call at a time.** Lunaris runs one function of your extension at a time, and each
  call is stopped after one minute.
- **Throw on failure.** `throw new Error("…")` with a short reason. Lunaris shows the
  message. Don't return made-up data.
- **Be gentle.** Make as few requests as a function needs. Don't loop through every page
  of results in one call; that's what the `page` argument is for.
- **Never get past a human check for the user.** Use `render` with `verify: true` and
  let the user pass it. Whatever the site saves afterwards (cookies, `localStorage`, a
  token) stays in the window for later `render` calls and survives restarts, so let the site
  keep it rather than copying it into your script; the check then comes back only when the
  site asks again.
- **Don't pretend to be the site's own pages.** If its API only answers requests from the
  site (an `Origin` or `Referer` check), read the page's answers with `render` instead of
  forging those headers. Page images are handled for you: when an image server refuses
  Lunaris, Lunaris asks again from the hidden window, from a page on the chapter's site,
  and keeps doing so for that server.
- **Cloudflare is handled for you.** When a site shows a Cloudflare check, Lunaris solves it
  in its own browser window (asking the user if it must) and retries your request. Don't set
  `User-Agent` or `Cookie: cf_clearance` yourself.
- **Prefer official APIs** when a site has one (MangaDex has). They're faster, and they
  don't break when the site's layout changes.
- **Respect the site's terms.** If they forbid scraping, say so in your repo's README.

### Publishing a repo

A repo is any static file host (GitHub Pages, a raw GitHub folder, your own server) with a
folder per site, each script named after its extension's id, and an `index.json` at the top:

```
my-repo/
  index.json
  my-site/
    my-site.js
    my-site-novels.js
  other-site/
    other-site.js
```

```sh
lunaris-ext index ./my-repo
```

This checks every extension, refuses a script not named after its extension's id, then
writes `index.json` with each one's info, path and SHA-256 checksum. (A small repo can also
keep its scripts loose next to `index.json`.) Run it again after every change; Lunaris refuses a
script whose checksum, id or version doesn't match the index. Users add the URL of
`index.json` in Lunaris to see your extensions.

### Updating an extension

Raise `version`, rebuild `index.json`, and upload both. Lunaris offers the update when the
index lists a version different from the installed one. Keep `id` the same forever.

### Host API versions

`info.api` is the host API your script was written for. Lunaris refuses scripts that need a
newer API than it has, so users get "update Lunaris" instead of a broken extension. The
current API is **2** (it added `render` and the DOM names on nodes); set `api: 2` only if
you use them, so older versions of Lunaris can still run your script. New functions will
come with a new API number; this guide and `lunaris.d.ts` always describe the newest.
