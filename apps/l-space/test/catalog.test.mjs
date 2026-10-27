import test from "node:test";
import assert from "node:assert/strict";
import { lSpace, parseArb, report, resolveMessages, serializeArb, tell } from "../src/catalog.mjs";
import { createTranslator } from "../src/messages.mjs";
import { fromXliff, toXliff } from "../src/xliff.mjs";
import { readSpace } from "../src/catalog.mjs";

const source = {
  "@@locale": "en",
  "nav.search": "Search",
  "@nav.search": { description: "The site search link" },
  "archive.page": "Page {page} of {total}",
  "@archive.page": { placeholders: { page: { type: "int" }, total: { type: "int" } } },
  "archive.count": "{count, plural, one {# publication} other {# publications}}",
};

const empty = (locale) => parseArb({ "@@locale": locale });
const translator = (kind = "human") => ({ role: "translator", kind, by: kind === "machine" ? "claude-opus-5-5" : "translator", at: "2026-10-19T00:00:00Z" });

test("a target catalog is told renderings bound to the current source", () => {
  const space = lSpace({ source });
  let zh = empty("zh-Hans");
  zh = tell(space, zh, "nav.search", "搜索", translator("machine"));
  zh = tell(space, zh, "archive.page", "第 {page} 页，共 {total} 页", translator());
  const written = parseArb(serializeArb(zh));
  assert.equal(written.units.get("nav.search").description, "The site search link");
  assert.match(written.units.get("nav.search").evidence.source, /^ni:\/\/\/sha-256;/u);
  assert.equal(written.units.get("archive.page").evidence.for.length, 1);
  const again = tell(space, written, "archive.page", "第 {page} 页，共 {total} 页", { role: "reviewer", kind: "human", by: "speaker", at: "2026-10-20" });
  assert.equal(again.units.get("archive.page").evidence.for.length, 2, "the same text gathers witnesses");
  const changed = tell(space, again, "archive.page", "{page}/{total}", translator());
  assert.equal(changed.units.get("archive.page").evidence.for.length, 1, "new text starts new evidence");
});

test("each locale is served what its reading admits, and fallbacks keep their language", () => {
  const base = lSpace({ source });
  let zh = empty("zh-Hans");
  zh = tell(base, zh, "nav.search", "搜索", translator("machine"));
  zh = tell(base, zh, "archive.page", "第 {page} 页", translator());
  let lkt = empty("lkt");
  lkt = tell(base, lkt, "archive.count", "{count}", translator("machine"));
  const space = lSpace({ source, targets: [zh, lkt] });

  const strict = resolveMessages(space, "zh-Hans");
  assert.deepEqual(strict.get("nav.search"), { message: "Search", language: "en", status: "fallback", reason: "unattested" });
  assert.deepEqual(strict.get("archive.page"), { message: "Page {page} of {total}", language: "en", status: "fallback", reason: "ill-typed" });

  const admitting = resolveMessages(space, "zh-Hans", { policy: { "zh-Hans": { machine: true } } });
  assert.deepEqual(admitting.get("nav.search"), { message: "搜索", language: "zh-Hans", status: "translated" });
  const { t } = createTranslator(admitting, { locale: "zh-Hans" });
  assert.deepEqual(t("archive.page", { page: 2, total: 9 }), { text: "Page 2 of 9", language: "en" });

  assert.equal(resolveMessages(space, "zh-Hans-CN", { policy: { "zh-Hans": { machine: true } } }).get("nav.search").message, "搜索", "a regional reader reaches the script fiber");
  assert.equal(resolveMessages(space, "en").get("nav.search").status, "source");
  assert.equal(resolveMessages(space, "lkt").get("archive.count").reason, "unattested");

  const account = report(space, { policy: { "zh-Hans": { machine: true } } });
  assert.equal(account.locales["zh-Hans"].translated, 1);
  assert.equal(account.locales["zh-Hans"]["ill-typed"], 1);
  assert.equal(account.locales["zh-Hans"].untranslated, 1);
  assert.equal(account.locales.lkt.unattested, 1);
  assert.equal(account.agree, true);
  assert.deepEqual(account.counterexamples, []);
  assert.ok(account.energy > 0);
});

test("a source edit makes its renderings stale until they are told again", () => {
  const before = lSpace({ source });
  const zh = tell(before, empty("zh-Hans"), "nav.search", "搜索", translator());
  const edited = lSpace({ source: { ...source, "nav.search": "Search this site" }, targets: [zh] });
  assert.equal(resolveMessages(edited, "zh-Hans").get("nav.search").reason, "stale");
});

test("XLIFF 2.0 export states each segment from its reading and imports back", () => {
  const base = lSpace({ source });
  let zh = empty("zh-Hans");
  zh = tell(base, zh, "nav.search", "搜索 & 发现 <快>", translator("machine"));
  zh = tell(base, zh, "archive.page", "第 {page} 页，共 {total} 页", translator());
  zh = tell(base, zh, "archive.page", "第 {page} 页，共 {total} 页", { role: "reviewer", kind: "human", by: "r", at: "2026-10-20" });
  const space = lSpace({ source, targets: [zh] });
  const xml = toXliff(readSpace(space, { required: ["zh-Hans"] }), { targetLocale: "zh-Hans", descriptions: new Map([["nav.search", "The site search link"]]) });
  assert.match(xml, /<xliff xmlns="urn:oasis:names:tc:xliff:document:2\.0" version="2\.0" srcLang="en" trgLang="zh-Hans">/u);
  assert.match(xml, /<segment state="initial" subState="l-space:machine">\s*<source>Search<\/source>\s*<target>搜索 &amp; 发现 &lt;快&gt;<\/target>/u);
  assert.match(xml, /<unit id="archive\.page">\s*<segment state="reviewed">/u);
  assert.match(xml, /<unit id="archive\.count">\s*<segment state="initial">\s*<source>\{count, plural/u);
  const back = fromXliff(xml);
  assert.equal(back.targetLocale, "zh-Hans");
  assert.deepEqual(back.units.map((unit) => [unit.key, unit.state, unit.target]), [
    ["nav.search", "initial", "搜索 & 发现 <快>"],
    ["archive.page", "reviewed", "第 {page} 页，共 {total} 页"],
    ["archive.count", "initial", undefined],
  ]);
  assert.throws(() => fromXliff('<xliff version="2.0" srcLang="en"><file><unit id="a"><segment><source>a</source><target><ph id="1"/></target></segment></unit></file></xliff>'), /inline markup/u);
  assert.throws(() => fromXliff('<xliff version="1.2" srcLang="en"></xliff>'), /not XLIFF 2/u);
});
