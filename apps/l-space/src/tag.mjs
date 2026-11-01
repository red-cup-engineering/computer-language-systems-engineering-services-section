/**
 * BCP 47 tags at the edge: canonical form and script direction, from Intl
 * alone, so the HTTP and locale modules carry no content-addressing stack into
 * a Worker. SignCell's `./language` canonicalizes by the same primitive
 * (Intl.getCanonicalLocales); the test suite holds the two to one answer.
 */

/** The canonical BCP 47 form of a language tag. Throws a TypeError on a tag that is not well formed. */
export function languageTag(tag) {
  if (typeof tag !== "string" || tag.trim() === "") throw new TypeError("l-space: a language tag is a non-empty BCP 47 string");
  try {
    return Intl.getCanonicalLocales(tag.trim())[0];
  } catch {
    throw new TypeError(`l-space: ${JSON.stringify(tag)} is not a well-formed BCP 47 language tag`);
  }
}

/** The base direction of a language's script, from CLDR; ltr when CLDR does not say. */
export function scriptDirection(tag) {
  const locale = new Intl.Locale(languageTag(tag));
  const info = typeof locale.getTextInfo === "function" ? locale.getTextInfo() : locale.textInfo;
  return info?.direction === "rtl" ? "rtl" : "ltr";
}
