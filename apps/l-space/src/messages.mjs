/**
 * Messages: ICU MessageFormat strings, their types, and their formatting.
 *
 * Curry–Howard–Lambek reading of a message: a message is a term of type
 * Args → Text, where Args is the record of its arguments and each argument's
 * kind (number, date, string, or untyped) is fixed by how the message uses it.
 * A translation is a second term that must inhabit the same type: the same
 * argument names, each used at a compatible kind, and the same rich-text
 * tags. `typeCheck` discharges that obligation, and a failure is evidence
 * against the translation, not a crash: an ill-typed leg is never served.
 *
 * Plural and select keys are not part of the type. Plural categories belong to
 * the target language (CLDR: Lakota and Mandarin have only `other`), and every
 * select has `other`, so any well-formed target is total.
 */
import { parse, TYPE } from "@formatjs/icu-messageformat-parser";
import { IntlMessageFormat } from "intl-messageformat";
import { languageTag } from "@red-cup-engineering/signcell/language";

const KIND = Object.freeze({
  [TYPE.argument]: "any",
  [TYPE.number]: "number",
  [TYPE.plural]: "number",
  [TYPE.date]: "date",
  [TYPE.time]: "date",
  [TYPE.select]: "string",
});

/** The type of an ICU message: `{ arguments: { name: kind }, tags: [name] }`. Throws a SyntaxError on an unparsable message. */
export function signatureOf(message) {
  let ast;
  try {
    ast = parse(message);
  } catch (error) {
    throw new SyntaxError(`messages: not ICU MessageFormat (${error.message}): ${JSON.stringify(message)}`);
  }
  const argumentsOf = {};
  const tags = new Set();
  const visit = (elements) => {
    for (const element of elements) {
      if (element.type === TYPE.tag) {
        tags.add(element.value);
        visit(element.children);
        continue;
      }
      const kind = KIND[element.type];
      if (kind !== undefined) argumentsOf[element.value] = joinKind(argumentsOf[element.value], kind);
      if (element.options) for (const option of Object.values(element.options)) visit(option.value);
    }
  };
  visit(ast);
  return Object.freeze({
    arguments: Object.freeze(Object.fromEntries(Object.entries(argumentsOf).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))),
    tags: Object.freeze([...tags].sort()),
  });
}

// "any" is an untyped use: it agrees with every kind and takes the other's.
function joinKind(left, right) {
  if (left === undefined || left === "any") return right;
  if (right === "any" || left === right) return left;
  return "conflict";
}

const compatible = (left, right) => left === "any" || right === "any" || left === right;

/** The type ARB placeholder declarations give a message (String, int, num, double, DateTime). */
export function declaredSignature(placeholders = {}) {
  const kindOf = (type) => ({ String: "string", int: "number", num: "number", double: "number", DateTime: "date" }[type] ?? "any");
  return Object.freeze({
    arguments: Object.freeze(Object.fromEntries(Object.entries(placeholders).sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, spec]) => [name, kindOf(spec?.type)]))),
    tags: Object.freeze([]),
  });
}

/**
 * Whether a target message inhabits a source type. Returns the proof
 * obligation's outcome: `wellTyped`, and when it fails, which arguments are
 * missing, extra or used at an incompatible kind, which tags differ, or the
 * parse error.
 */
export function typeCheck(type, targetMessage) {
  let target;
  try {
    target = signatureOf(targetMessage);
  } catch (error) {
    return Object.freeze({ wellTyped: false, missing: [], extra: [], mismatched: [], tags: [], error: error.message });
  }
  const sourceNames = Object.keys(type.arguments);
  const targetNames = Object.keys(target.arguments);
  const missing = sourceNames.filter((name) => !(name in target.arguments));
  const extra = targetNames.filter((name) => !(name in type.arguments));
  const mismatched = sourceNames.filter((name) => name in target.arguments
    && (target.arguments[name] === "conflict" || type.arguments[name] === "conflict" || !compatible(type.arguments[name], target.arguments[name])));
  const tagSet = new Set(type.tags);
  const tags = [...new Set([...type.tags.filter((tag) => !target.tags.includes(tag)), ...target.tags.filter((tag) => !tagSet.has(tag))])].sort();
  return Object.freeze({
    wellTyped: missing.length === 0 && extra.length === 0 && mismatched.length === 0 && tags.length === 0,
    missing: Object.freeze(missing), extra: Object.freeze(extra), mismatched: Object.freeze(mismatched), tags: Object.freeze(tags),
  });
}

const compiled = new Map();

/** Format one ICU message for a locale. Rich-text tags are given as functions of their rendered children. */
export function formatMessage(message, locale, values = {}) {
  const tag = languageTag(locale);
  const key = `${tag}\u0000${message}`;
  let format = compiled.get(key);
  if (format === undefined) {
    format = new IntlMessageFormat(message, tag);
    compiled.set(key, format);
  }
  const result = format.format(values);
  return Array.isArray(result) ? result.join("") : String(result);
}

/**
 * A translator over resolved messages: `t(key, values)` returns `{ text, language }`,
 * the language being the one the text is actually in — a key served from a
 * fallback locale says so, so a page can mark it with `lang`. `resolved` maps
 * each key to `{ message, language }` (see `catalog.resolveMessages`).
 */
export function createTranslator(resolved, { locale } = {}) {
  const tag = locale === undefined ? undefined : languageTag(locale);
  const translate = (key, values = {}) => {
    const entry = resolved.get(key);
    if (entry === undefined) throw new RangeError(`messages: no message ${JSON.stringify(key)}`);
    return Object.freeze({ text: formatMessage(entry.message, entry.language, values), language: entry.language });
  };
  return Object.freeze({
    locale: tag,
    t: translate,
    text: (key, values) => translate(key, values).text,
    has: (key) => resolved.has(key),
  });
}
