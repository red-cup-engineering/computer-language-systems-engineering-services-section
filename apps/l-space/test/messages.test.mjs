import test from "node:test";
import assert from "node:assert/strict";
import { parseArb, serializeArb } from "../src/arb.mjs";
import { createTranslator, declaredSignature, formatMessage, signatureOf, typeCheck } from "../src/messages.mjs";

test("a message's type is its arguments' kinds and its tags", () => {
  assert.deepEqual(signatureOf("Page {page, number} of {total} — <b>{count, plural, one {# item} other {# items}}</b> {when, date, long} {g, select, a {x} other {y}}"), {
    arguments: { count: "number", g: "string", page: "number", total: "any", when: "date" },
    tags: ["b"],
  });
  assert.throws(() => signatureOf("broken {"), SyntaxError);
});

test("a translation must inhabit its source's type", () => {
  const type = signatureOf("Page {page} of {total}; {count, plural, one {# result} other {# results}}");
  assert.equal(typeCheck(type, "第 {page} 页，共 {total} 页；{count, plural, other {# 条结果}}").wellTyped, true);
  assert.equal(typeCheck(type, "第 {page} 页，共 {total} 页；{count} 条").wellTyped, true, "an untyped use agrees with a number");
  assert.deepEqual(typeCheck(type, "第 {page} 页").missing, ["count", "total"]);
  assert.deepEqual(typeCheck(type, "{page} {total} {count} {extra}").extra, ["extra"]);
  assert.deepEqual(typeCheck(signatureOf("{page, number} of {total}"), "{page, date} / {total}").mismatched, ["page"]);
  const tagged = signatureOf("Read <b>{title}</b>");
  assert.deepEqual(typeCheck(tagged, "阅读 {title}").tags, ["b"]);
  const broken = typeCheck(type, "{page");
  assert.equal(broken.wellTyped, false);
  assert.match(broken.error, /ICU/u);
});

test("ARB placeholder declarations are a type", () => {
  assert.deepEqual(declaredSignature({ page: { type: "int" }, title: { type: "String" }, when: { type: "DateTime" } }).arguments, { page: "number", title: "string", when: "date" });
});

test("formatting follows the locale's own plural rules", () => {
  assert.equal(formatMessage("{count, plural, one {# result} other {# results}}", "en", { count: 1 }), "1 result");
  assert.equal(formatMessage("{count, plural, other {# 条结果}}", "zh-Hans", { count: 1 }), "1 条结果");
  assert.equal(formatMessage("Read <b>{x}</b>", "en", { x: "y", b: (chunks) => `<strong>${chunks.join("")}</strong>` }), "Read <strong>y</strong>");
});

test("a translator says which language each text is really in", () => {
  const { t, text, has } = createTranslator(new Map([
    ["search", { message: "搜索", language: "zh-Hans" }],
    ["atlas", { message: "Atlas", language: "en" }],
  ]), { locale: "zh-Hans" });
  assert.deepEqual(t("search"), { text: "搜索", language: "zh-Hans" });
  assert.deepEqual(t("atlas"), { text: "Atlas", language: "en" });
  assert.equal(text("search"), "搜索");
  assert.equal(has("missing"), false);
  assert.throws(() => t("missing"), RangeError);
});

test("ARB round-trips messages, metadata, x- extensions and evidence", () => {
  const text = JSON.stringify({
    "@@locale": "zh-hans",
    "@@x-generator": "test",
    "search.label": "搜索",
    "@search.label": { description: "Search button", "x-context": "nav", "x-l-space": { source: "ni:///sha-256;abc", for: [{ role: "translator", kind: "machine", by: "m", at: "2026-10-19" }] } },
    "page.of": "第 {page} 页",
    "@page.of": { placeholders: { page: { type: "int" } } },
  });
  const catalog = parseArb(text);
  assert.equal(catalog.locale, "zh-Hans");
  assert.equal(catalog.attributes["x-generator"], "test");
  assert.equal(catalog.units.get("search.label").evidence.for[0].kind, "machine");
  assert.deepEqual(catalog.units.get("search.label").extensions, { "x-context": "nav" });
  assert.deepEqual(JSON.parse(serializeArb(catalog)), { ...JSON.parse(text), "@@locale": "zh-Hans" });
  assert.throws(() => parseArb({ a: "x" }), /@@locale/u);
  assert.throws(() => parseArb({ "@@locale": "en", a: 3 }), /ICU/u);
});
