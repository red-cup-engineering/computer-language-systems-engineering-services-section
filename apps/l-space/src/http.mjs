/**
 * L-space at the HTTP edge: how one resource's renderings in several
 * languages are announced and chosen.
 *
 * Alternates are announced the three standard ways: HTML
 * `<link rel="alternate" hreflang>`, the RFC 8288 `Link` header, and sitemap
 * `xhtml:link` entries, each with an `x-default`. Choice follows the reader:
 * an explicit locale in the path always wins; at the root, a stored choice
 * (a `lang` cookie) wins over `Accept-Language`; a response that depends on
 * either says so in `Vary`.
 */
import { languageTag } from "./tag.mjs";
import { negotiate } from "./locale.mjs";

const escapeHtml = (text) => String(text).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

/** Alternates as `{ hreflang, href }`, canonical tags, sorted, with `x-default` last. */
export function alternates(entries, { xDefault } = {}) {
  const out = entries.map(({ locale, href }) => ({ hreflang: languageTag(locale), href: String(href) }))
    .sort((a, b) => (a.hreflang < b.hreflang ? -1 : 1));
  if (xDefault !== undefined) out.push({ hreflang: "x-default", href: String(xDefault) });
  return Object.freeze(out.map(Object.freeze));
}

/** HTML `<link rel="alternate">` elements for a page's alternates. */
export const alternateLinkTags = (list) => list.map(({ hreflang, href }) => `<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${escapeHtml(href)}">`).join("");

/** The RFC 8288 `Link` header value for a page's alternates. */
export const linkHeader = (list) => list.map(({ hreflang, href }) => `<${encodeURI(href)}>; rel="alternate"; hreflang="${hreflang}"`).join(", ");

const escapeXml = (text) => String(text).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");

/** A sitemap whose entries carry their language alternates: `[{ loc, lastmod?, alternates? }]`. */
export function sitemapXml(entries) {
  const urls = entries.map((entry) => `<url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ""}${(entry.alternates ?? []).map(({ hreflang, href }) => `<xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`).join("")}</url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`;
}

/** The path prefix a locale is served under: none for the default locale, else `/<lowercased tag>`. */
export const localePrefix = (locale, defaultLocale) => (languageTag(locale) === languageTag(defaultLocale) ? "" : `/${languageTag(locale).toLowerCase()}`);

/** The locale a path names by its first segment, if it names one of the served locales. */
export function localeOfPath(pathname, locales) {
  const first = pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  return locales.map(languageTag).find((tag) => tag.toLowerCase() === first);
}

function cookieValue(header, name) {
  for (const part of String(header ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

/**
 * The locale a request is for, and why: `{ locale, by: "path" | "cookie" | "accept-language" | "default", vary }`.
 * `vary` lists the request fields the choice depended on.
 */
export function requestLocale(request, { locales, defaultLocale = locales[0], cookie = "lang" }) {
  const url = new URL(request.url);
  const fromPath = localeOfPath(url.pathname, locales);
  if (fromPath) return Object.freeze({ locale: fromPath, by: "path", vary: [] });
  const stored = cookieValue(request.headers.get("cookie"), cookie);
  if (stored) {
    try {
      const chosen = locales.map(languageTag).find((tag) => tag === languageTag(stored));
      if (chosen) return Object.freeze({ locale: chosen, by: "cookie", vary: ["Cookie"] });
    } catch { /* an ill-formed stored choice is ignored */ }
  }
  const header = request.headers.get("accept-language");
  if (header) {
    const locale = negotiate(header, locales, { defaultLocale });
    return Object.freeze({ locale, by: locale === languageTag(defaultLocale) ? "default" : "accept-language", vary: ["Accept-Language", "Cookie"] });
  }
  return Object.freeze({ locale: languageTag(defaultLocale), by: "default", vary: ["Accept-Language", "Cookie"] });
}

/**
 * A redirect for a request at a locale-free path whose reader prefers another
 * served locale, or null. Only GET/HEAD are redirected; crawlers (which send
 * no Accept-Language) keep the default; the response varies on what decided it.
 */
export function localeRedirect(request, { locales, defaultLocale = locales[0], cookie = "lang", paths = (pathname) => pathname === "/" } = {}) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  if (!paths(url.pathname) || localeOfPath(url.pathname, locales)) return null;
  const choice = requestLocale(request, { locales, defaultLocale, cookie });
  if (choice.locale === languageTag(defaultLocale)) return null;
  const target = new URL(`${localePrefix(choice.locale, defaultLocale)}${url.pathname}${url.search}`, url);
  return new Response(null, { status: 302, headers: { location: target.href, vary: choice.vary.join(", "), "cache-control": "private, no-store" } });
}

/** Response headers for a resource in one locale. */
export const languageHeaders = (locale, list = []) => ({
  "content-language": languageTag(locale),
  ...(list.length ? { link: linkHeader(list) } : {}),
});
