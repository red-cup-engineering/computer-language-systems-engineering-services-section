/**
 * Locales: the base points of L-space's language fibers, and how a request
 * picks one.
 *
 * A locale is named by a canonical BCP 47 tag (SignCell `languageTag`). Its
 * other faces are read from CLDR through `Intl` rather than kept in tables:
 * its autonym (what a reader of that language calls it), its script's base
 * direction, its URL path segment, its `hreflang` value and its Open Graph
 * `og:locale`. Negotiation reads an HTTP `Accept-Language` field (RFC 9110
 * §12.5.4) against the locales a site serves, by exact tag, then RFC 4647
 * lookup, then CLDR likely subtags (so `zh-CN` reaches `zh-Hans`, `zh-TW`
 * does not, and `en-GB` reaches `en`).
 */
import { baseDirection, languageTag } from "@red-cup-engineering/signcell/language";

/** The faces of one locale. `names` may override the CLDR autonym (e.g. a community's preferred spelling). */
export function locale(tag, { names = {} } = {}) {
  const canonical = languageTag(tag);
  const maximal = new Intl.Locale(canonical).maximize();
  return Object.freeze({
    tag: canonical,
    path: canonical.toLowerCase(),
    hreflang: canonical,
    direction: baseDirection(canonical),
    script: maximal.script,
    autonym: names[canonical] ?? autonym(canonical),
    ogLocale: `${maximal.language}_${maximal.region ?? "001"}`,
  });
}

/** What readers of a language call it, from CLDR; the tag itself when CLDR has no name. */
export function autonym(tag) {
  const canonical = languageTag(tag);
  try {
    const name = new Intl.DisplayNames([canonical], { type: "language", fallback: "none" }).of(canonical);
    return name ?? canonical;
  } catch {
    return canonical;
  }
}

/** A locale's name as shown to readers of another locale. */
export function localeName(tag, inLocale) {
  const canonical = languageTag(tag);
  try {
    return new Intl.DisplayNames([languageTag(inLocale)], { type: "language", fallback: "none" }).of(canonical) ?? autonym(canonical);
  } catch {
    return autonym(canonical);
  }
}

/** The RFC 4647 lookup chain of a tag: itself, then each truncation, dropping singleton-led tails. */
export function fallbackChain(tag) {
  const parts = languageTag(tag).split("-");
  const chain = [];
  while (parts.length > 0) {
    chain.push(parts.join("-"));
    parts.pop();
    while (parts.length > 1 && parts.at(-1).length === 1) parts.pop();
  }
  return Object.freeze(chain);
}

/** The ranges of an Accept-Language field, most preferred first (q > 0, stable within equal q). */
export function parseAcceptLanguage(field) {
  if (typeof field !== "string" || field.trim() === "") return Object.freeze([]);
  const ranges = [];
  field.split(",").forEach((part, index) => {
    const [rangeText, ...parameters] = part.trim().split(";").map((piece) => piece.trim());
    if (!rangeText) return;
    let q = 1;
    for (const parameter of parameters) {
      const match = /^q=([01](?:\.\d{0,3})?)$/iu.exec(parameter);
      if (match) q = Math.min(1, Number(match[1]));
    }
    if (q <= 0) return;
    if (rangeText === "*") return void ranges.push({ range: "*", q, index });
    try {
      ranges.push({ range: languageTag(rangeText), q, index });
    } catch {
      // An ill-formed range is ignored, as a user agent's typo should not refuse the request.
    }
  });
  return Object.freeze(ranges.sort((a, b) => b.q - a.q || a.index - b.index).map(({ range, q }) => Object.freeze({ range, q })));
}

const maximized = (tag) => {
  const value = new Intl.Locale(tag).maximize();
  return { language: value.language, script: value.script, region: value.region };
};

/**
 * The served locale that best answers a list of ranges (or an Accept-Language
 * field). Each range, in preference order, is tried by exact tag, by RFC 4647
 * lookup, then by CLDR likely subtags (same language and script). A wildcard
 * or no match yields the default.
 */
export function negotiate(ranges, available, { defaultLocale = available[0] } = {}) {
  const served = available.map(languageTag);
  const byLower = new Map(served.map((tag) => [tag.toLowerCase(), tag]));
  const preferred = typeof ranges === "string" || ranges === undefined || ranges === null ? parseAcceptLanguage(ranges ?? "") : ranges;
  for (const { range } of preferred) {
    if (range === "*") break;
    for (const candidate of fallbackChain(range)) {
      const hit = byLower.get(candidate.toLowerCase());
      if (hit) return hit;
    }
    const wanted = maximized(range);
    const sameScript = served.filter((tag) => {
      const have = maximized(tag);
      return have.language === wanted.language && have.script === wanted.script;
    });
    if (sameScript.length > 0) return sameScript.find((tag) => maximized(tag).region === wanted.region) ?? sameScript[0];
  }
  return defaultLocale === undefined ? undefined : languageTag(defaultLocale);
}

/** A date (ISO `YYYY-MM-DD` or a Date) as readers of a locale write it, read in UTC so a calendar date never shifts. */
export function formatDate(value, tag, options = { dateStyle: "long" }) {
  const date = value instanceof Date ? value : new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(languageTag(tag), { ...options, timeZone: "UTC" }).format(date);
}

/** A number as readers of a locale write it. */
export const formatNumber = (value, tag, options) => new Intl.NumberFormat(languageTag(tag), options).format(value);

/** Words of a text as a locale segments them (CLDR/ICU word boundaries: dictionary segmentation for Han script). */
export function words(text, tag) {
  const segmenter = new Intl.Segmenter(languageTag(tag), { granularity: "word" });
  return Object.freeze([...segmenter.segment(String(text))].filter((segment) => segment.isWordLike).map((segment) => segment.segment));
}

/** A collator for sorting a locale's strings as its readers expect. */
export const collator = (tag, options) => new Intl.Collator(languageTag(tag), options);
