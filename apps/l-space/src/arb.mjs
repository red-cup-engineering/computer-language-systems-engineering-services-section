/**
 * ARB (Application Resource Bundle): the message catalog format on disk.
 *
 * One JSON file per locale. `@@locale` names its BCP 47 locale; each message
 * key maps to an ICU MessageFormat string; `@key` holds that message's
 * metadata (`description`, `placeholders`, and `x-` extensions). Translation
 * evidence lives in the `x-l-space` extension of a target catalog's `@key`:
 *
 *   "@search.label": { "x-l-space": {
 *     "source": "ni:///sha-256;…",          // the source token this text renders
 *     "from": "ni:///sha-256;…",            // optional: the token it was translated from, when not the source
 *     "for": [{ "role": "translator", "kind": "human" | "machine", "by": "…", "at": "ISO 8601" }],
 *     "against": [{ "role": "reviewer", "kind": "human", "by": "…", "at": "…", "note": "…" }]
 *   } }
 *
 * Every TMS that reads ARB (Crowdin, Lokalise, Phrase, Weblate, Localizely)
 * keeps unknown `x-` attributes, so evidence survives a round trip.
 */
import { languageTag } from "@red-cup-engineering/signcell/language";

const EXTENSION = "x-l-space";

/** Read an ARB catalog (JSON text or a parsed object) into `{ locale, attributes, units }`. */
export function parseArb(input, { locale: fallbackLocale } = {}) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  if (data === null || typeof data !== "object" || Array.isArray(data)) throw new TypeError("arb: a catalog is a JSON object");
  const attributes = {};
  const units = new Map();
  for (const [name, value] of Object.entries(data)) {
    if (name.startsWith("@@")) {
      attributes[name.slice(2)] = value;
      continue;
    }
    if (name.startsWith("@")) continue;
    if (typeof value !== "string") throw new TypeError(`arb: message ${JSON.stringify(name)} must be an ICU MessageFormat string`);
    const meta = data[`@${name}`] ?? {};
    if (meta === null || typeof meta !== "object" || Array.isArray(meta)) throw new TypeError(`arb: metadata @${name} must be an object`);
    const { description, placeholders, [EXTENSION]: evidence, ...rest } = meta;
    units.set(name, Object.freeze({
      key: name,
      message: value,
      ...(typeof description === "string" ? { description } : {}),
      ...(placeholders && typeof placeholders === "object" ? { placeholders: Object.freeze({ ...placeholders }) } : {}),
      ...(evidence ? { evidence: normalizeEvidence(evidence, name) } : {}),
      ...(Object.keys(rest).length ? { extensions: Object.freeze(rest) } : {}),
    }));
  }
  const locale = attributes.locale ?? fallbackLocale;
  if (locale === undefined) throw new TypeError("arb: a catalog names its locale with @@locale");
  return Object.freeze({ locale: languageTag(locale), attributes: Object.freeze(attributes), units });
}

function normalizeEvidence(evidence, key) {
  if (typeof evidence !== "object" || Array.isArray(evidence)) throw new TypeError(`arb: @${key}.${EXTENSION} must be an object`);
  const sides = (name) => {
    const value = evidence[name] ?? [];
    if (!Array.isArray(value) || !value.every((witness) => witness && typeof witness === "object" && !Array.isArray(witness))) {
      throw new TypeError(`arb: @${key}.${EXTENSION}.${name} must be an array of witness objects`);
    }
    return Object.freeze(value.map((witness) => Object.freeze({ ...witness })));
  };
  return Object.freeze({
    ...(typeof evidence.source === "string" ? { source: evidence.source } : {}),
    ...(typeof evidence.from === "string" ? { from: evidence.from } : {}),
    for: sides("for"),
    against: sides("against"),
  });
}

/** Write a catalog back to ARB JSON: `@@` attributes first, then each message beside its metadata, keys in catalog order. */
export function serializeArb({ locale, attributes = {}, units }) {
  const out = { "@@locale": languageTag(locale) };
  for (const [name, value] of Object.entries(attributes)) if (name !== "locale") out[`@@${name}`] = value;
  for (const unit of units.values()) {
    out[unit.key] = unit.message;
    const meta = {
      ...(unit.description ? { description: unit.description } : {}),
      ...(unit.placeholders ? { placeholders: unit.placeholders } : {}),
      ...(unit.extensions ?? {}),
      ...(unit.evidence ? { [EXTENSION]: compactEvidence(unit.evidence) } : {}),
    };
    if (Object.keys(meta).length) out[`@${unit.key}`] = meta;
  }
  return `${JSON.stringify(out, null, 2)}\n`;
}

function compactEvidence(evidence) {
  return {
    ...(evidence.source ? { source: evidence.source } : {}),
    ...(evidence.from ? { from: evidence.from } : {}),
    ...(evidence.for?.length ? { for: evidence.for } : {}),
    ...(evidence.against?.length ? { against: evidence.against } : {}),
  };
}
