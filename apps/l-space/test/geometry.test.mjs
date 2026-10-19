import test from "node:test";
import assert from "node:assert/strict";
import { langString } from "@red-cup-engineering/signcell/language";
import { told } from "@red-cup-engineering/signcell/cell";
import { claimOf, coincidence, point, readUnit, tokenAddress, worldline } from "../src/geometry.mjs";

const human = (role, at, by = "reader") => ({ role, kind: "human", by, at });
const machine = (at) => ({ role: "translator", kind: "machine", by: "mt", at });

const source = langString("Page {page} of {total}", "en");
const SRC = tokenAddress(source);

function unitWith(legs) {
  return { key: "page.of", source: { token: source }, legs };
}

test("a claim is language-neutral and moves when its source moves", () => {
  const a = claimOf("page.of", source);
  assert.deepEqual(a, { claim: "page.of", source: SRC });
  assert.notDeepEqual(claimOf("page.of", langString("Page {page} of {total} pages", "en")), a);
});

test("a fully attested unit is coherent under all four readings", () => {
  const zh = langString("第 {page} 页，共 {total} 页", "zh-Hans");
  const lkt = langString("{page} / {total}", "lkt");
  const reading = readUnit(unitWith([
    { token: zh, evidence: { source: SRC, for: [human("translator", "2026-10-01")] } },
    { token: lkt, evidence: { source: SRC, for: [human("translator", "2026-10-02"), human("reviewer", "2026-10-03", "speaker")] } },
  ]), { required: ["zh-Hans", "lkt"] });
  assert.equal(reading.cone.disposition, "coherent");
  assert.equal(reading.sheaf.energy, 0);
  assert.equal(reading.sheaf.components, 1);
  assert.equal(reading.sheaf.globalSection, true);
  const receipt = coincidence(reading);
  assert.deepEqual([receipt.cone, receipt.pointwise, receipt.sheaf, receipt.agree], [true, true, true, true]);
  const lktLeg = reading.legs.find((leg) => leg.locale === "lkt");
  assert.deepEqual(point(reading, lktLeg), { claim: reading.claim, fiber: "lkt", time: "2026-10-03", type: reading.type, address: lktLeg.address });
});

test("CHL: an ill-typed leg is told against and never coherent", () => {
  const reading = readUnit(unitWith([
    { token: langString("第 {page} 页", "zh-Hans"), evidence: { source: SRC, for: [human("translator", "2026-10-01")] } },
  ]), { required: ["zh-Hans"] });
  const leg = reading.legs[0];
  assert.equal(leg.chl.wellTyped, false);
  assert.deepEqual(leg.chl.missing, ["total"]);
  assert.equal(leg.reading, "both", "the translator's witness for and the checker's against");
  assert.equal(reading.cone.disposition, "contradicted");
  assert.deepEqual(reading.sheaf.stalks["zh-Hans"], [1, 1]);
  assert.equal(reading.sheaf.energy, 1);
  assert.equal(coincidence(reading).agree, true);
});

test("light cone: renderings of a past source, or of a past pivot, are stale", () => {
  const oldSource = tokenAddress(langString("Page {page} of {total} (old)", "en"));
  const zhOld = langString("第 {page} 页（旧）共 {total}", "zh-Hans");
  const zhNew = langString("第 {page} 页，共 {total} 页", "zh-Hans");
  const reading = readUnit(unitWith([
    { token: zhOld, evidence: { source: oldSource, for: [human("translator", "2026-09-01")] } },
    { token: zhNew, evidence: { source: SRC, for: [human("translator", "2026-10-01")] } },
    // Lakota translated from the old Mandarin: it renders the current claim, through a past rendering.
    { token: langString("{page} – {total}", "lkt"), evidence: { source: SRC, from: tokenAddress(zhOld), for: [human("translator", "2026-10-05")] } },
  ]), { required: ["zh-Hans", "lkt"] });
  const byText = Object.fromEntries(reading.legs.map((leg) => [leg.text, leg.causal]));
  assert.deepEqual(byText["第 {page} 页（旧）共 {total}"], { current: false, reason: "renders-past-source" });
  assert.deepEqual(byText["第 {page} 页，共 {total} 页"], { current: true, reason: "renders-source" });
  assert.deepEqual(byText["{page} – {total}"], { current: false, reason: "renders-past-pivot" });
  assert.equal(reading.cone.legs["zh-Hans"].disposition, "coherent");
  assert.equal(reading.cone.legs.lkt.disposition, "open", "a pivot that does not commute is no leg of the cone");
  assert.equal(coincidence(reading).agree, true);
});

test("light cone: a pivot through a current rendering is current and commutes", () => {
  const zh = langString("第 {page} 页，共 {total} 页", "zh-Hans");
  const reading = readUnit(unitWith([
    { token: zh, evidence: { source: SRC, for: [human("translator", "2026-10-01")] } },
    { token: langString("{page} – {total}", "lkt"), evidence: { source: SRC, from: tokenAddress(zh), for: [human("translator", "2026-10-05")] } },
  ]), { required: ["zh-Hans", "lkt"] });
  assert.equal(reading.legs.find((leg) => leg.locale === "lkt").causal.reason, "renders-current-pivot");
  assert.equal(reading.cone.disposition, "coherent");
  assert.deepEqual(reading.sheaf.edges, [["en", "zh-Hans"], ["zh-Hans", "lkt"]], "the fiber graph follows translation provenance");
});

test("policy: a machine rendering counts only where the locale admits machine witnesses", () => {
  const unit = unitWith([
    { token: langString("第 {page} 页，共 {total} 页", "zh-Hans"), evidence: { source: SRC, for: [machine("2026-10-19")] } },
  ]);
  assert.equal(readUnit(unit, { required: ["zh-Hans"] }).cone.disposition, "unproven");
  assert.equal(readUnit(unit, { required: ["zh-Hans"], policy: { "zh-Hans": { machine: true } } }).cone.disposition, "coherent");
});

test("chromatic-Lorentzian: settled world-line readings are the leg's evidence in its past light cone", () => {
  const leg = { for: [human("translator", "2026-10-01"), human("reviewer", "2026-10-03")], against: [human("reviewer", "2026-10-02", "other")] };
  const line = worldline(leg);
  assert.deepEqual(line.events.map((event) => event.side), ["for", "against", "for"]);
  assert.deepEqual(line.readings, [[true, false], [true, true], [true, true]], "once told, a side stays told: settling is past-closure");
  assert.deepEqual(line.final, [true, true]);
  const unit = unitWith([{ token: langString("第 {page} 页，共 {total} 页", "zh-Hans"), evidence: { source: SRC, ...leg } }]);
  assert.equal(readUnit(unit, { required: ["zh-Hans"], at: "2026-10-01" }).cone.disposition, "coherent", "before the objection");
  assert.equal(readUnit(unit, { required: ["zh-Hans"], at: "2026-10-02" }).cone.disposition, "contradicted", "after it");
});

test("the sheaf sees disconnection: gluing needs a connected fiber graph", () => {
  const unit = unitWith([]);
  const reading = readUnit(unit, { required: ["zh-Hans", "lkt"], graph: [["en", "zh-Hans"]] });
  assert.equal(reading.sheaf.components, 2);
  assert.equal(reading.sheaf.globalSection, false);
  const receipt = coincidence(reading);
  assert.equal(receipt.hypotheses.connected, false);
  assert.equal(receipt.cone, false);
});

// Property: on generated units, the cone, the pointwise readings and the sheaf agree wherever the hypotheses hold,
// the settled world-line equals SignCell's told(), and every time slice agrees too.
function rng(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return state / 2 ** 32;
  };
}

test("coincidence holds on generated units and at every time slice", () => {
  const random = rng(561);
  const pick = (items) => items[Math.floor(random() * items.length)];
  const texts = ["第 {page} 页，共 {total} 页", "{page}/{total}", "第 {page} 页", "{page} {total} {x}", "{page, date} {total}"];
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  const oldSource = tokenAddress(langString("old", "en"));
  let checked = 0;
  for (let n = 0; n < 300; n += 1) {
    const legs = [];
    for (const locale of ["zh-Hans", "lkt", "de"]) {
      const count = Math.floor(random() * 3);
      for (let k = 0; k < count; k += 1) {
        const witnesses = (side) => Array.from({ length: Math.floor(random() * 3) }, () => (random() < 0.3 ? machine(pick(days)) : human(side === "for" ? "translator" : "reviewer", pick(days), pick(["a", "b"]))));
        const token = langString(`${pick(texts)}${k ? ` ${k}` : ""}`, locale);
        const priorLeg = legs.length && random() < 0.3 ? pick(legs) : undefined;
        legs.push({
          token,
          evidence: {
            source: random() < 0.8 ? SRC : oldSource,
            ...(priorLeg ? { from: tokenAddress(priorLeg.token) } : {}),
            for: witnesses("for"),
            against: random() < 0.3 ? witnesses("against") : [],
          },
        });
      }
    }
    const policy = { de: { machine: true } };
    for (const at of [undefined, ...days]) {
      const reading = readUnit(unitWith(legs), { required: ["zh-Hans", "lkt", "de"], policy, at });
      const receipt = coincidence(reading);
      assert.equal(receipt.counterexample, false, `counterexample at ${at}: ${JSON.stringify(receipt)}`);
      assert.equal(receipt.agree, true);
      for (const leg of reading.legs) {
        const [forTold, againstTold] = told(leg.cell);
        assert.equal(leg.chromatic.final[0], forTold, "settled for-marks are the G-Set's for side");
        assert.equal(leg.chromatic.final[1] || !leg.chl.wellTyped, againstTold, "settled against-marks, with type errors, are its against side");
      }
      checked += 1;
    }
  }
  assert.equal(checked, 1500);
});
