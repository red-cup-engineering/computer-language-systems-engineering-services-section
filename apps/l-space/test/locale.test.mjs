import test from "node:test";
import assert from "node:assert/strict";
import { autonym, fallbackChain, formatDate, locale, localeName, negotiate, parseAcceptLanguage, words } from "../src/locale.mjs";

test("a locale's faces come from CLDR", () => {
  const zh = locale("cmn-Hans");
  assert.equal(zh.tag, "zh-Hans");
  assert.equal(zh.path, "zh-hans");
  assert.equal(zh.hreflang, "zh-Hans");
  assert.equal(zh.direction, "ltr");
  assert.equal(zh.script, "Hans");
  assert.equal(zh.ogLocale, "zh_CN");
  assert.equal(locale("ar").direction, "rtl");
  assert.equal(locale("lkt").ogLocale, "lkt_US");
  assert.equal(autonym("en"), "English");
  assert.equal(autonym("zh-Hans"), "简体中文");
  assert.match(autonym("lkt"), /^Lak/u);
  assert.equal(locale("lkt", { names: { lkt: "Lakȟótiyapi" } }).autonym, "Lakȟótiyapi");
  assert.equal(localeName("lkt", "en"), "Lakota");
});

test("RFC 4647 lookup chains drop singleton-led tails", () => {
  assert.deepEqual(fallbackChain("zh-Hans-CN"), ["zh-Hans-CN", "zh-Hans", "zh"]);
  assert.deepEqual(fallbackChain("zh-Hant-CN-x-private1-private2"), ["zh-Hant-CN-x-private1-private2", "zh-Hant-CN-x-private1", "zh-Hant-CN", "zh-Hant", "zh"]);
  assert.deepEqual(fallbackChain("en-a-bbb-x-a-ccc"), ["en-a-bbb-x-a-ccc", "en-a-bbb", "en"]);
  assert.deepEqual(fallbackChain("lkt"), ["lkt"]);
});

test("Accept-Language ranges are read by q, refusals and typos ignored", () => {
  assert.deepEqual(parseAcceptLanguage("fr;q=0.2, zh-CN, en;q=0.8, de;q=0, @@"), [
    { range: "zh-CN", q: 1 }, { range: "en", q: 0.8 }, { range: "fr", q: 0.2 },
  ]);
  assert.deepEqual(parseAcceptLanguage(""), []);
});

test("negotiation reaches a served locale by tag, lookup, then CLDR likely subtags", () => {
  const served = ["en", "lkt", "zh-Hans"];
  assert.equal(negotiate("zh-CN,zh;q=0.9", served), "zh-Hans");
  assert.equal(negotiate("zh", served), "zh-Hans");
  assert.equal(negotiate("zh-TW", served), "en", "Traditional Chinese is not served by Simplified");
  assert.equal(negotiate("en-GB", served), "en");
  assert.equal(negotiate("lkt-US, en;q=0.5", served), "lkt");
  assert.equal(negotiate("fr, de", served), "en");
  assert.equal(negotiate("*", served, { defaultLocale: "zh-Hans" }), "zh-Hans");
  assert.equal(negotiate(undefined, served), "en");
});

test("dates are written in the reader's locale and never shift a calendar day", () => {
  assert.equal(formatDate("2026-10-12", "en"), "October 12, 2026");
  assert.equal(formatDate("2026-10-12", "zh-Hans"), "2026年10月12日");
  assert.match(formatDate("2026-10-12", "lkt"), /12, 2026$/u);
  assert.equal(formatDate("not a date", "en"), "not a date");
});

test("words are segmented as each language's readers segment them", () => {
  assert.deepEqual(words("语言科学研究", "zh-Hans"), ["语言", "科学", "研究"]);
  assert.deepEqual(words("Lakȟótiyapi wóglaka", "lkt"), ["Lakȟótiyapi", "wóglaka"]);
});
