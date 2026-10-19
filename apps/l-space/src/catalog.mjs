/**
 * Catalogs in L-space: ARB files become units, units are read, and each
 * locale is served the renderings its reading admits.
 *
 * The source catalog fixes every claim. A target catalog contributes one leg
 * per key, with the evidence in its `x-l-space` extension. A locale is served
 * a key's target text only when that leg reads `true` under the locale's
 * policy and is current and well typed; otherwise the key falls back along the
 * locale's RFC 4647 chain and finally to the source, and the served entry
 * keeps the language it is really in.
 */
import { langString, languageTag } from "@red-cup-engineering/signcell/language";
import { parseArb, serializeArb } from "./arb.mjs";
import { admission, coincidence, readUnit, tokenAddress } from "./geometry.mjs";
import { declaredSignature, signatureOf, typeCheck } from "./messages.mjs";
import { fallbackChain } from "./locale.mjs";

/** An L-space over one source catalog and its target catalogs (parsed or ARB text). */
export function lSpace({ source, targets = [] }) {
  const sourceCatalog = typeof source === "string" || !(source?.units instanceof Map) ? parseArb(source) : source;
  const targetCatalogs = targets.map((target) => (typeof target === "string" || !(target?.units instanceof Map) ? parseArb(target) : target));
  const locales = [...new Set(targetCatalogs.map((catalog) => catalog.locale))];
  const units = [...sourceCatalog.units.values()].map((unit) => {
    const token = langString(unit.message, sourceCatalog.locale);
    const type = signatureOf(unit.message);
    if (unit.placeholders) {
      const declared = typeCheck(declaredSignature(unit.placeholders), unit.message);
      if (!declared.wellTyped) throw new TypeError(`l-space: source message ${unit.key} does not match its declared placeholders`);
    }
    return Object.freeze({
      key: unit.key,
      description: unit.description,
      source: Object.freeze({ token }),
      type,
      legs: Object.freeze(targetCatalogs.flatMap((catalog) => {
        const target = catalog.units.get(unit.key);
        return target ? [Object.freeze({ token: langString(target.message, catalog.locale), evidence: target.evidence ?? {} })] : [];
      })),
    });
  });
  return Object.freeze({ sourceLocale: sourceCatalog.locale, locales: Object.freeze(locales), units: Object.freeze(units), source: sourceCatalog, targets: Object.freeze(targetCatalogs) });
}

/** Read every unit of an L-space: required fibers default to every target locale. */
export function readSpace(space, { required = space.locales, policy, at } = {}) {
  const admit = admission(policy);
  return Object.freeze(space.units.map((unit) => readUnit(unit, { required, admit, at })));
}

/** Whether a read leg may be served: current, well typed, told for and not against. */
export const servable = (leg) => leg.causal.current && leg.chl.wellTyped && leg.reading === "true";

/**
 * The message each key resolves to in a locale: `Map(key → { message, language, status })`,
 * status being `source`, `translated`, or `fallback` (with the reason the target leg was not served).
 */
export function resolveMessages(space, locale, { policy, at, readings = readSpace(space, { required: [locale], policy, at }) } = {}) {
  const tag = languageTag(locale);
  const chain = fallbackChain(tag);
  const resolved = new Map();
  for (const reading of readings) {
    let entry;
    for (const candidate of chain) {
      if (candidate === reading.sourceLocale) {
        entry = { message: reading.source, language: reading.sourceLocale, status: "source" };
        break;
      }
      const leg = reading.legs
        .filter((item) => item.locale === candidate && servable(item))
        .sort((a, b) => (a.address === reading.cone.legs[candidate]?.address ? -1 : b.address === reading.cone.legs[candidate]?.address ? 1 : 0))[0];
      if (leg) {
        entry = { message: leg.text, language: leg.locale, status: "translated" };
        break;
      }
    }
    resolved.set(reading.key, Object.freeze(entry ?? {
      message: reading.source, language: reading.sourceLocale, status: "fallback", reason: fallbackReason(reading, tag),
    }));
  }
  return resolved;
}

function fallbackReason(reading, locale) {
  const legs = reading.legs.filter((leg) => leg.locale === locale);
  if (legs.length === 0) return "untranslated";
  if (!legs.some((leg) => leg.causal.current)) return "stale";
  if (!legs.some((leg) => leg.chl.wellTyped)) return "ill-typed";
  if (legs.some((leg) => leg.reading === "both" || leg.reading === "false")) return "contested";
  return "unattested";
}

/** A per-locale account of an L-space: how many keys are served translated, and why the rest fall back; plus the sheaf's total energy. */
export function report(space, { policy, at } = {}) {
  const readings = readSpace(space, { policy, at });
  const locales = Object.fromEntries(space.locales.map((locale) => {
    const resolved = resolveMessages(space, locale, { policy, at, readings: readSpace(space, { required: [locale], policy, at }) });
    const counts = { translated: 0, untranslated: 0, stale: 0, "ill-typed": 0, contested: 0, unattested: 0 };
    for (const entry of resolved.values()) counts[entry.status === "translated" ? "translated" : entry.reason] += 1;
    return [locale, Object.freeze({ ...counts, total: resolved.size, coverage: resolved.size ? counts.translated / resolved.size : 1 })];
  }));
  const receipts = readings.map(coincidence);
  return Object.freeze({
    sourceLocale: space.sourceLocale,
    locales: Object.freeze(locales),
    coherent: readings.filter((reading) => reading.cone.disposition === "coherent").length,
    units: readings.length,
    energy: readings.reduce((sum, reading) => sum + reading.sheaf.energy, 0),
    counterexamples: Object.freeze(receipts.filter((receipt) => receipt.counterexample).map((receipt) => receipt.key)),
    agree: receipts.every((receipt) => receipt.agree || !receipt.hypotheses.connected),
  });
}

/**
 * Record a rendering in a target catalog: the message, and a witness for it,
 * bound to the current source token (and, for a pivot, to the token it was
 * translated from). Returns a new parsed catalog; `serializeArb` writes it.
 */
export function tell(space, catalog, key, message, witness, { from, side = "for" } = {}) {
  const unit = space.units.find((item) => item.key === key);
  if (!unit) throw new RangeError(`l-space: no source key ${JSON.stringify(key)}`);
  const source = tokenAddress(unit.source.token);
  const prior = catalog.units.get(key);
  const sameText = prior && prior.message.normalize("NFC") === message.normalize("NFC") && prior.evidence?.source === source && prior.evidence?.from === from;
  const evidence = {
    source,
    ...(from ? { from } : {}),
    for: sameText ? [...prior.evidence.for] : [],
    against: sameText ? [...prior.evidence.against] : [],
  };
  evidence[side === "against" ? "against" : "for"].push(Object.freeze({ ...witness }));
  const units = new Map(catalog.units);
  units.set(key, Object.freeze({ ...(prior ?? {}), key, message, ...(unit.description && !prior?.description ? { description: unit.description } : {}), evidence: Object.freeze(evidence) }));
  return Object.freeze({ ...catalog, units });
}

export { parseArb, serializeArb };
