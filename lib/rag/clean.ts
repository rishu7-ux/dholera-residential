import { load } from "cheerio";

const REMOVED_SELECTORS = [
  "script",
  "style",
  "noscript",
  "svg",
  "canvas",
  "iframe",
  "nav",
  "footer",
  "form",
  "button",
  "[role='navigation']",
  "[role='dialog']",
  "[aria-hidden='true']",
  "[class*='cookie']",
  "[id*='cookie']",
  "[class*='consent']",
  "[id*='consent']",
  "[class*='newsletter']",
  "[class*='social']",
].join(",");

function normalizeText(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[\t\r ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanPlainText(value: string) {
  return normalizeText(
    value
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'"),
  );
}

export function cleanHtmlContent(html: string) {
  const $ = load(html);
  $(REMOVED_SELECTORS).remove();

  const title = normalizeText($("h1").first().text() || $("title").first().text());
  const root = $("main").first().length ? $("main").first() : $("body").first();
  const blocks: string[] = [];
  const seen = new Set<string>();

  root.find("h1, h2, h3, h4, p, li, dt, dd, address").each((_, element) => {
    const text = normalizeText($(element).text());
    const fingerprint = text.toLocaleLowerCase();
    if (text.length < 2 || seen.has(fingerprint)) return;
    seen.add(fingerprint);
    blocks.push(text);
  });

  return {
    title,
    content: blocks.join("\n\n").slice(0, 100000),
  };
}
