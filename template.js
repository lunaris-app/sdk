/// <reference path="./lunaris.d.ts" />
// A starter extension. Copy it, rename it to <id>.js, then fill in the
// selectors for your site.

const BASE = "https://example.com";

/** @param {string} path */
function page(path) {
  const res = fetch(BASE + path);
  if (res.status !== 200) throw new Error(`${path}: HTTP ${res.status}`);
  return html(res.text);
}

/** @param {string} href */
const absolute = (href) => (href.startsWith("http") ? href : BASE + href);

extension({
  info: {
    id: "example",
    name: "Example",
    lang: "en",
    kinds: ["manga"],
    version: "1.0.0",
    api: 1,
    content: "sfw",
    site: BASE,
  },

  search(query, n) {
    return page(`/search?q=${encodeURIComponent(query)}&page=${n}`)
      .select(".result")
      .map((r) => ({
        title: r.select(".title")[0]?.text() ?? "",
        url: absolute(r.select("a")[0]?.attr("href") ?? ""),
        cover: r.select("img")[0]?.attr("src"),
      }));
  },

  chapters(url) {
    return html(fetch(url).text)
      .select(".chapter a")
      .map((a) => ({ title: a.text(), url: absolute(a.attr("href")) }));
  },

  pages(url) {
    return html(fetch(url).text)
      .select(".reader img")
      .map((img) => absolute(img.attr("data-src") || img.attr("src")));
  },
});
