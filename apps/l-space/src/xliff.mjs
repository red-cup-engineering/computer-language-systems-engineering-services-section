/**
 * XLIFF 2.0 (OASIS): the interchange format for translators and translation
 * management systems.
 *
 * Export writes one file per target locale: each unit's source, its current
 * target (when there is one), its description as a note, and a segment state
 * read from the unit's L-space reading — `reviewed` when a human reviewer told
 * for it, `translated` when a human translator did, `initial` otherwise, with
 * an `l-space:` subState naming why (machine, stale, contested, ill-typed).
 * Import reads the targets and states a TMS returns, so they can be told back
 * into a catalog as witnesses. ICU MessageFormat stays plain text in both
 * directions; no inline codes are written or accepted.
 */
import { languageTag } from "@red-cup-engineering/signcell/language";

const XLIFF_NS = "urn:oasis:names:tc:xliff:document:2.0";

const escapeXml = (text) => String(text).replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;").replace(/"/gu, "&quot;");

/** The segment state and subState of one target leg. */
export function segmentState(leg) {
  if (!leg) return { state: "initial" };
  if (!leg.causal.current) return { state: "initial", subState: "l-space:stale" };
  if (!leg.chl.wellTyped) return { state: "initial", subState: "l-space:ill-typed" };
  if (leg.cell.against.length) return { state: "initial", subState: "l-space:contested" };
  const humans = leg.cell.for.filter((witness) => witness.kind !== "machine");
  if (humans.some((witness) => witness.role === "reviewer")) return { state: "reviewed" };
  if (humans.length) return { state: "translated" };
  return { state: "initial", subState: "l-space:machine" };
}

/** An XLIFF 2.0 document for one target locale from read units (see `catalog.readSpace`). */
export function toXliff(readings, { targetLocale, fileId = "messages", descriptions = new Map() } = {}) {
  const target = languageTag(targetLocale);
  const source = readings[0]?.sourceLocale ?? "und";
  const units = readings.map((reading) => {
    const legAddress = reading.cone.legs[target]?.address;
    const leg = reading.legs.find((item) => item.address === legAddress)
      ?? reading.legs.filter((item) => item.locale === target).at(-1);
    const { state, subState } = segmentState(leg);
    const description = descriptions.get(reading.key);
    return `    <unit id="${escapeXml(reading.key)}">${description ? `\n      <notes><note category="description">${escapeXml(description)}</note></notes>` : ""}
      <segment state="${state}"${subState ? ` subState="${subState}"` : ""}>
        <source>${escapeXml(reading.source)}</source>${leg ? `\n        <target>${escapeXml(leg.text)}</target>` : ""}
      </segment>
    </unit>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<xliff xmlns="${XLIFF_NS}" version="2.0" srcLang="${escapeXml(source)}" trgLang="${escapeXml(target)}">
  <file id="${escapeXml(fileId)}">
${units.join("\n")}
  </file>
</xliff>
`;
}

const ENTITIES = Object.freeze({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" });

function decodeText(raw, where) {
  const text = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, (_, cdata) => cdata.replace(/[&<>]/gu, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]));
  if (/<[^>]*>/u.test(text)) throw new TypeError(`xliff: ${where} carries inline markup; ICU messages are exchanged as plain text`);
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole, name) => {
    if (name[0] === "#") return String.fromCodePoint(name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1)));
    if (!(name in ENTITIES)) throw new TypeError(`xliff: unknown entity ${whole} in ${where}`);
    return ENTITIES[name];
  });
}

function attributes(text) {
  const out = {};
  for (const match of text.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) out[match[1]] = decodeText(match[2] ?? match[3], "an attribute");
  return out;
}

/** The units of an XLIFF 2.0 document: `{ sourceLocale, targetLocale, units: [{ key, source, target?, state, subState? }] }`. */
export function fromXliff(xml) {
  const root = /<xliff\b([^>]*)>/u.exec(xml);
  if (!root) throw new TypeError("xliff: not an XLIFF document");
  const rootAttributes = attributes(root[1]);
  if (rootAttributes.version !== "2.0" && rootAttributes.version !== "2.1") throw new TypeError(`xliff: version ${rootAttributes.version} is not XLIFF 2.x`);
  const units = [];
  for (const unit of xml.matchAll(/<unit\b([^>]*)>([\s\S]*?)<\/unit>/gu)) {
    const { id } = attributes(unit[1]);
    const segments = [...unit[2].matchAll(/<segment\b([^>]*)>([\s\S]*?)<\/segment>/gu)];
    if (segments.length !== 1) throw new TypeError(`xliff: unit ${id} must have exactly one segment`);
    const segmentAttributes = attributes(segments[0][1]);
    const source = /<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/u.exec(segments[0][2]);
    const target = /<target(?:\s[^>]*)?>([\s\S]*?)<\/target>/u.exec(segments[0][2]);
    units.push(Object.freeze({
      key: id,
      source: source ? decodeText(source[1], `unit ${id} source`) : "",
      ...(target ? { target: decodeText(target[1], `unit ${id} target`) } : {}),
      state: segmentAttributes.state ?? "initial",
      ...(segmentAttributes.subState ? { subState: segmentAttributes.subState } : {}),
    }));
  }
  return Object.freeze({
    sourceLocale: languageTag(rootAttributes.srcLang),
    targetLocale: rootAttributes.trgLang ? languageTag(rootAttributes.trgLang) : undefined,
    units: Object.freeze(units),
  });
}

/** The witness role an imported segment state stands for: reviewed and final are reviews, translated is a translation. */
export const roleOfState = (state) => (state === "reviewed" || state === "final" ? "reviewer" : state === "translated" ? "translator" : undefined);
