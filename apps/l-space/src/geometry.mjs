/**
 * L-space geometry: one claim read four ways.
 *
 * L-space is the total space of signs (token, claim). Its base is the set of
 * language fibers: a token in Lakota lies over `lkt`, the same claim said in
 * Mandarin lies over `zh-Hans` (SignCell `fiberOf`). Its time is causal: each
 * rendering is an event told for or against by witnesses in order. A point of
 * L-space has coordinates (claim, fiber, time, type) — `point` names them.
 *
 * A *unit* is one claim and every rendering of it: the source token that
 * fixes the claim, and target legs carrying their stored evidence. A unit
 * whose texts are not ICU messages (a Markdown page) brings its own CHL
 * obligation as `check(text) → { wellTyped, missing, extra, mismatched, tags }`. A unit is
 * read four ways, each its own computation:
 *
 *  - CHL (Curry–Howard–Lambek): each leg is a term that must inhabit the
 *    claim's type (`messages.typeCheck`). Ill-typed is evidence against.
 *  - Light cone (A6): a leg belongs to the current claim's future only if it
 *    renders the current source, directly or through a chain of renderings
 *    that are themselves current (pivot translation). Anything else lies in
 *    the causal past: stale.
 *  - Chromatic-Lorentzian: a leg's witnesses, ordered in time, are two Boolean
 *    markings (for, against) on its world-line; settling them (Metrologic
 *    `settle`, the finite past-closure) gives its reading at any time.
 *  - Sheaf Laplacian: over a graph of fibers, the stalk ℝ² at each fiber holds
 *    its leg's two evidence sides (FOUR is the product 2 × 2), restrictions
 *    are identities, and L = δᵀδ (SignGraph). Energy 0 on a connected graph is
 *    a global section: every fiber tells what the source tells.
 *
 * And the A8 Language Cone, read on SignCell cells: the apex is the claim,
 * each leg the cell (token, claim, token) in one fiber, its evidence a G-Set;
 * a pivot leg must commute with the leg it was translated from. The cone is
 * coherent when every required fiber has a leg reading `true`.
 *
 * `coincidence` states the conjecture these readings share and checks it on a
 * unit: cone coherent ⟺ every leg well typed, current and settled
 * (true, not against) ⟺ the sheaf has one component, zero energy and the
 * source's reading. Its hypotheses are explicit: the gluing direction needs a
 * connected fiber graph, and the cone/cone-of-light agreement needs at most
 * one current rendering per fiber (a sheaf, not a presheaf, of renderings).
 * When a hypothesis fails the receipt names it; when the readings disagree
 * under the hypotheses, that is a counterexample, and the receipt carries it.
 * These are executable checks on finite data, not Lean proofs.
 */
import { semanticId } from "@red-cup-engineering/semiotic-content-address";
import { cell, truthReading } from "@red-cup-engineering/signcell/cell";
import { languageOf, languageTag, textOf } from "@red-cup-engineering/signcell/language";
import { settle } from "@red-cup-engineering/metrologic/articulation/predicating/positing/settling/analysis/chromatic-lorentzian";
import { apply, cellularSheafCohomology, cochain, constantSheaf, sheafLaplacian } from "@red-cup-engineering/signgraph/cellular-sheaf";
import { signatureOf, typeCheck } from "./messages.mjs";

/** The content address of a token (or any semiotic carrier). */
export const tokenAddress = (token) => semanticId(token);

/** The claim a source token fixes for a key: language-neutral, and new whenever the source changes. */
export const claimOf = (key, sourceToken) => Object.freeze({ claim: key, source: tokenAddress(sourceToken) });

/** The witness a checker tells against an ill-typed leg. */
const typeWitness = (check) => Object.freeze({
  role: "checker", kind: "machine", by: "l-space/chl",
  note: [
    check.error,
    ...(check.notes ?? []),
    check.missing.length ? `missing ${check.missing.join(", ")}` : "",
    check.extra.length ? `extra ${check.extra.join(", ")}` : "",
    check.mismatched.length ? `mismatched ${check.mismatched.join(", ")}` : "",
    check.tags.length ? `tags ${check.tags.join(", ")}` : "",
  ].filter(Boolean).join("; "),
});

/** The default admission: human witnesses count everywhere; machine witnesses only where a locale's policy admits them. */
export function admission(policy = {}) {
  return (witness, locale) => witness?.kind !== "machine" || policy[locale]?.machine === true;
}

const inTime = (at) => (witness) => at === undefined || witness.at === undefined || String(witness.at) <= String(at);

/** A unit's legs with what each needs: locale, address, claim, and its admitted, time-sliced witnesses. */
function prepare(unit, { admit, at }) {
  const sourceLocale = languageOf(unit.source.token);
  if (sourceLocale === undefined) throw new TypeError("l-space: a unit's source token must be language-tagged text");
  const type = unit.type ?? (unit.check ? null : signatureOf(textOf(unit.source.token)));
  const check = unit.check ?? ((text) => typeCheck(type, text));
  const claim = claimOf(unit.key, unit.source.token);
  const sourceAddress = claim.source;
  const legs = (unit.legs ?? []).map((leg) => {
    const locale = languageOf(leg.token);
    if (locale === undefined) throw new TypeError(`l-space: leg of ${unit.key} is not language-tagged text`);
    const evidence = leg.evidence ?? {};
    const keep = (witness) => admit(witness, locale) && inTime(at)(witness);
    return Object.freeze({
      locale, token: leg.token, address: tokenAddress(leg.token),
      claim: Object.freeze({ claim: unit.key, source: evidence.source ?? null }),
      from: evidence.from,
      for: Object.freeze((evidence.for ?? []).filter(keep)),
      against: Object.freeze((evidence.against ?? []).filter(keep)),
    });
  });
  return { sourceLocale, type, check, claim, sourceAddress, legs };
}

// — CHL —

/** Each leg's typing: does its text inhabit the claim's type? */
function chlReading(prepared) {
  return new Map(prepared.legs.map((leg) => [leg.address, prepared.check(textOf(leg.token))]));
}

// — light cone (A6) —

/** The legs in the current claim's causal future: least fixed point of "renders the source, or renders a current leg". */
function causalReading(prepared) {
  const current = new Set([prepared.sourceAddress]);
  const rendersCurrentClaim = (leg) => leg.claim.source === prepared.sourceAddress;
  let grew = true;
  while (grew) {
    grew = false;
    for (const leg of prepared.legs) {
      if (current.has(leg.address) || !rendersCurrentClaim(leg)) continue;
      if (leg.from === undefined || current.has(leg.from)) {
        current.add(leg.address);
        grew = true;
      }
    }
  }
  return new Map(prepared.legs.map((leg) => {
    if (current.has(leg.address)) return [leg.address, Object.freeze({ current: true, reason: leg.from === undefined || leg.from === prepared.sourceAddress ? "renders-source" : "renders-current-pivot" })];
    const reason = !rendersCurrentClaim(leg) ? "renders-past-source" : prepared.legs.some((other) => other.address === leg.from) ? "renders-past-pivot" : "renders-unknown-token";
    return [leg.address, Object.freeze({ current: false, reason })];
  }));
}

// — chromatic-Lorentzian —

const eventOrder = (left, right) => {
  const a = left.witness.at === undefined ? "" : String(left.witness.at);
  const b = right.witness.at === undefined ? "" : String(right.witness.at);
  return a < b ? -1 : a > b ? 1 : left.ordinal - right.ordinal;
};

/** A leg's world-line: its witnesses in time order, the for/against markings, and their settled readings. */
export function worldline(leg) {
  const events = [
    ...leg.for.map((witness, index) => ({ side: "for", witness, ordinal: index })),
    ...leg.against.map((witness, index) => ({ side: "against", witness, ordinal: leg.for.length + index })),
  ].sort(eventOrder);
  const forMarks = events.map((event) => event.side === "for");
  const againstMarks = events.map((event) => event.side === "against");
  const settledFor = events.length ? settle(forMarks) : [];
  const settledAgainst = events.length ? settle(againstMarks) : [];
  return Object.freeze({
    events: Object.freeze(events.map(({ side, witness }) => Object.freeze({ side, at: witness.at ?? null }))),
    readings: Object.freeze(events.map((_, index) => Object.freeze([settledFor[index], settledAgainst[index]]))),
    final: Object.freeze([settledFor.at(-1) ?? false, settledAgainst.at(-1) ?? false]),
  });
}

function chromaticReading(prepared) {
  return new Map(prepared.legs.map((leg) => [leg.address, worldline(leg)]));
}

// — A8 cone over SignCell cells —

const RANK = Object.freeze({ true: 0, neither: 1, both: 2, false: 3 });
const DISPOSITION = Object.freeze({ true: "coherent", neither: "unproven", both: "contradicted", false: "contradicted" });
const WORST = ["contradicted", "open", "unproven", "coherent"];

/** The cone: per fiber, the leg cells whose predicate is the apex claim, their readings, the leg chosen, and the cone's disposition. */
function coneReading(prepared, required) {
  const cells = new Map(prepared.legs.map((leg) => {
    const check = prepared.check(textOf(leg.token));
    return [leg.address, cell(leg.token, leg.claim, leg.token, {
      for: leg.for,
      against: check.wellTyped ? leg.against : [...leg.against, typeWitness(check)],
    })];
  }));
  const apex = (leg) => leg.claim.source === prepared.claim.source && leg.claim.claim === prepared.claim.claim;
  const chosen = new Map([[prepared.sourceLocale, { address: prepared.sourceAddress, reading: "true", source: true }]]);
  // Pivot legs commute only with the leg chosen in the fiber they came from, so fibers are chosen in dependency order.
  const pending = new Set(required.filter((locale) => locale !== prepared.sourceLocale));
  const fiberOfAddress = new Map(prepared.legs.map((leg) => [leg.address, leg.locale]));
  fiberOfAddress.set(prepared.sourceAddress, prepared.sourceLocale);
  const commutes = (leg) => {
    if (leg.from === undefined || leg.from === prepared.sourceAddress) return true;
    const pivotFiber = fiberOfAddress.get(leg.from);
    return pivotFiber !== undefined && chosen.get(pivotFiber)?.address === leg.from;
  };
  const ready = (locale) => prepared.legs.filter((leg) => leg.locale === locale && apex(leg))
    .every((leg) => leg.from === undefined || leg.from === prepared.sourceAddress || !pending.has(fiberOfAddress.get(leg.from)) || fiberOfAddress.get(leg.from) === locale);
  while (pending.size > 0) {
    const next = [...pending].find(ready) ?? [...pending][0];
    pending.delete(next);
    const candidates = prepared.legs
      .filter((leg) => leg.locale === next && apex(leg) && commutes(leg))
      .map((leg) => ({ address: leg.address, reading: truthReading(cells.get(leg.address)), at: lastAt(leg) }))
      .sort((a, b) => RANK[a.reading] - RANK[b.reading] || (a.at < b.at ? 1 : a.at > b.at ? -1 : 0) || (a.address < b.address ? -1 : 1));
    if (candidates.length) chosen.set(next, { ...candidates[0], alternatives: candidates.length - 1 });
  }
  const legs = Object.fromEntries(required.map((locale) => {
    const leg = chosen.get(locale);
    return [locale, Object.freeze(leg ? { ...leg, disposition: DISPOSITION[leg.reading] } : { disposition: "open" })];
  }));
  const disposition = WORST.find((name) => Object.values(legs).some((leg) => leg.disposition === name)) ?? "coherent";
  return Object.freeze({ apex: prepared.claim, legs: Object.freeze(legs), disposition, cells });
}

const lastAt = (leg) => [...leg.for, ...leg.against].map((witness) => String(witness.at ?? "")).sort().at(-1) ?? "";

// — sheaf Laplacian —

/** The stalk ℝ² of a fiber: the two evidence sides of its chosen current leg, a type error counting against. */
function stalks(prepared, required, chosen, chl, causal, chromatic) {
  return required.map((locale) => {
    if (locale === prepared.sourceLocale) return { vertex: locale, value: [1, 0] };
    const leg = chosen(locale);
    if (!leg || !causal.get(leg.address)?.current) return { vertex: locale, value: [0, 0] };
    const [told, denied] = chromatic.get(leg.address).final;
    return { vertex: locale, value: [told ? 1 : 0, denied || !chl.get(leg.address).wellTyped ? 1 : 0] };
  });
}

/** The fiber graph: each fiber joined to the fiber its chosen leg was translated from (else the source), plus any declared edges. */
function fiberGraph(prepared, required, chosen, declared) {
  const fiberOfAddress = new Map(prepared.legs.map((leg) => [leg.address, leg.locale]));
  const edges = [];
  const seen = new Set();
  const add = (from, to) => {
    const key = [from, to].sort().join("\u0000");
    if (from === to || seen.has(key) || !required.includes(from) || !required.includes(to)) return;
    seen.add(key);
    edges.push([from, to]);
  };
  if (declared) for (const [from, to] of declared) add(languageTag(from), languageTag(to));
  else for (const locale of required) {
    if (locale === prepared.sourceLocale) continue;
    const leg = chosen(locale);
    const parent = leg?.from && fiberOfAddress.has(leg.from) ? fiberOfAddress.get(leg.from) : prepared.sourceLocale;
    add(parent, locale);
  }
  return edges;
}

function sheafReading(prepared, required, values, edges) {
  const sheaf = constantSheaf(required, edges, 2);
  const x = cochain(sheaf, values);
  const Lx = apply(sheafLaplacian(sheaf), x);
  const energy = x.reduce((sum, value, index) => sum + value * Lx[index], 0);
  const cohomology = cellularSheafCohomology(sheaf);
  const source = values.find((entry) => entry.vertex === prepared.sourceLocale)?.value ?? [0, 0];
  const components = cohomology.h0 / 2;
  return Object.freeze({
    vertices: Object.freeze([...required]),
    edges: Object.freeze(edges.map((edge) => Object.freeze([...edge]))),
    stalks: Object.freeze(Object.fromEntries(values.map(({ vertex, value }) => [vertex, Object.freeze([...value])]))),
    energy,
    components,
    h1: cohomology.h1 / 2,
    globalSection: components === 1 && energy === 0 && source[0] === 1 && source[1] === 0,
  });
}

/**
 * Read one unit. `required` are the fibers the claim must reach (the source
 * locale is added). `policy` decides which witnesses count per locale
 * (`{ "zh-Hans": { machine: true } }`); `at` slices every world-line at a time
 * (its past light cone); `graph` declares the fiber graph instead of deriving
 * it from translation provenance.
 */
export function readUnit(unit, { required = [], policy, admit = admission(policy), at, graph } = {}) {
  const prepared = prepare(unit, { admit, at });
  const fibers = [...new Set([prepared.sourceLocale, ...required.map(languageTag)])];
  const chl = chlReading(prepared);
  const causal = causalReading(prepared);
  const chromatic = chromaticReading(prepared);
  const cone = coneReading(prepared, fibers);
  const chosenLeg = (locale) => {
    const address = cone.legs[locale]?.address;
    return address === undefined ? undefined : prepared.legs.find((leg) => leg.address === address);
  };
  const edges = fiberGraph(prepared, fibers, chosenLeg, graph);
  const sheaf = sheafReading(prepared, fibers, stalks(prepared, fibers, chosenLeg, chl, causal, chromatic), edges);
  const legs = Object.freeze(prepared.legs.map((leg) => Object.freeze({
    locale: leg.locale,
    address: leg.address,
    text: textOf(leg.token),
    chl: chl.get(leg.address),
    causal: causal.get(leg.address),
    chromatic: chromatic.get(leg.address),
    cell: cone.cells.get(leg.address),
    reading: truthReading(cone.cells.get(leg.address)),
  })));
  return Object.freeze({
    key: unit.key,
    claim: prepared.claim,
    type: prepared.type,
    sourceLocale: prepared.sourceLocale,
    source: textOf(unit.source.token),
    fibers: Object.freeze(fibers),
    legs,
    cone: Object.freeze({ apex: cone.apex, legs: cone.legs, disposition: cone.disposition }),
    sheaf,
  });
}

/**
 * The coincidence receipt of a read unit: the cone's verdict, the pointwise
 * verdict (CHL ∧ light cone ∧ chromatic settling, per required fiber), the
 * sheaf's verdict, which hypotheses hold, and whether the readings agree.
 */
export function coincidence(reading) {
  const byAddress = new Map(reading.legs.map((leg) => [leg.address, leg]));
  const pointwise = reading.fibers.every((locale) => {
    if (locale === reading.sourceLocale) return true;
    const leg = byAddress.get(reading.cone.legs[locale]?.address);
    return Boolean(leg && leg.chl.wellTyped && leg.causal.current && leg.chromatic.final[0] && !leg.chromatic.final[1]);
  });
  const cone = reading.cone.disposition === "coherent";
  const sheaf = reading.sheaf.globalSection;
  const connected = reading.sheaf.components === 1;
  const currentPerFiber = new Map();
  for (const leg of reading.legs) if (leg.causal.current) currentPerFiber.set(leg.locale, (currentPerFiber.get(leg.locale) ?? 0) + 1);
  const uniqueSections = [...currentPerFiber.values()].every((count) => count <= 1);
  const hypotheses = Object.freeze({ connected, uniqueSections });
  const agree = cone === pointwise && (!connected || pointwise === sheaf) && (!sheaf || pointwise);
  return Object.freeze({
    key: reading.key,
    cone, pointwise, sheaf,
    hypotheses,
    agree,
    counterexample: !agree && connected && uniqueSections,
  });
}

/** The coordinates of a leg as a point of L-space: which claim, in which fiber, when, of what type, at which address. */
export function point(reading, leg) {
  const events = leg.chromatic.events;
  return Object.freeze({
    claim: reading.claim,
    fiber: leg.locale,
    time: events.length ? events.at(-1).at : null,
    type: reading.type,
    address: leg.address,
  });
}
