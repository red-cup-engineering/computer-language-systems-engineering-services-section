import test from "node:test";
import assert from "node:assert/strict";
import { alternateLinkTags, alternates, languageHeaders, linkHeader, localeOfPath, localePrefix, localeRedirect, requestLocale, sitemapXml } from "../src/http.mjs";

const locales = ["en", "lkt", "zh-Hans"];
const request = (path, headers = {}, method = "GET") => new Request(`https://science.561.group${path}`, { method, headers });

test("alternates are announced in HTML, Link and sitemap form with x-default", () => {
  const list = alternates([
    { locale: "zh-hans", href: "https://science.561.group/zh-hans/intro/" },
    { locale: "en", href: "https://science.561.group/intro/" },
  ], { xDefault: "https://science.561.group/intro/" });
  assert.deepEqual(list.map((entry) => entry.hreflang), ["en", "zh-Hans", "x-default"]);
  assert.equal(alternateLinkTags(list.slice(0, 1)), '<link rel="alternate" hreflang="en" href="https://science.561.group/intro/">');
  assert.equal(linkHeader(list.slice(1, 2)), '<https://science.561.group/zh-hans/intro/>; rel="alternate"; hreflang="zh-Hans"');
  const xml = sitemapXml([{ loc: "https://science.561.group/intro/", alternates: list }]);
  assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/u);
  assert.match(xml, /<xhtml:link rel="alternate" hreflang="zh-Hans" href="https:\/\/science\.561\.group\/zh-hans\/intro\/"\/>/u);
  assert.deepEqual(languageHeaders("cmn-Hans", list.slice(1, 2)), { "content-language": "zh-Hans", link: linkHeader(list.slice(1, 2)) });
});

test("the default locale is served at the root, others under their lowercased tag", () => {
  assert.equal(localePrefix("en", "en"), "");
  assert.equal(localePrefix("zh-Hans", "en"), "/zh-hans");
  assert.equal(localeOfPath("/zh-hans/intro/", locales), "zh-Hans");
  assert.equal(localeOfPath("/LKT/", locales), "lkt");
  assert.equal(localeOfPath("/intro/", locales), undefined);
});

test("a request's locale: path, then stored choice, then Accept-Language", () => {
  assert.deepEqual(requestLocale(request("/lkt/x/", { "accept-language": "zh-CN" }), { locales }), { locale: "lkt", by: "path", vary: [] });
  assert.equal(requestLocale(request("/", { cookie: "a=1; lang=zh-hans", "accept-language": "lkt" }), { locales }).by, "cookie");
  assert.equal(requestLocale(request("/", { "accept-language": "zh-CN,en;q=0.5" }), { locales }).locale, "zh-Hans");
  assert.deepEqual(requestLocale(request("/"), { locales }), { locale: "en", by: "default", vary: ["Accept-Language", "Cookie"] });
});

test("only the root of a reader preferring another locale is redirected", () => {
  const redirect = localeRedirect(request("/?ref=x", { "accept-language": "zh-CN" }), { locales });
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.get("location"), "https://science.561.group/zh-hans/?ref=x");
  assert.equal(redirect.headers.get("vary"), "Accept-Language, Cookie");
  assert.equal(localeRedirect(request("/", { "accept-language": "en-US" }), { locales }), null);
  assert.equal(localeRedirect(request("/"), { locales }), null, "a crawler with no preference keeps the default");
  assert.equal(localeRedirect(request("/intro/", { "accept-language": "zh-CN" }), { locales }), null);
  assert.equal(localeRedirect(request("/", { "accept-language": "zh-CN" }, "POST"), { locales }), null);
  assert.equal(localeRedirect(request("/", { cookie: "lang=en", "accept-language": "zh-CN" }), { locales }), null, "a stored choice of the default wins");
});
