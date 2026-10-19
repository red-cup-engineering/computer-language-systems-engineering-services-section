# L-space

`@red-cup-engineering/l-space` serves sites and services in many languages. It treats each published string or page as a claim, and treats the claim's renderings in each language as SignCell legs. A rendering is served only when the evidence and the geometry both admit it.

## Model

- **Signs.** A point of L-space is a sign `(token, claim)`. The token is language-tagged text (SignCell `./language`: a JSON-LD `rdf:langString` with a canonical BCP 47 tag). The claim is language-neutral: `{ claim: key, source: ni-address of the source token }`. Editing the source makes a new claim.
- **Fibers.** Each language is a fiber. A cell `(token, claim, token)` lies over its token's language (`fiberOf`). A page in one language is a section of the bundle at that fiber.
- **Time.** Witnesses tell for or against a rendering in order: a translator, a reviewer, a machine, or a type checker. A rendering's world-line is that order.
- **Coordinates.** Each rendering has coordinates `(claim, fiber, time, type)`; `point(reading, leg)` returns them.

## The four readings of a claim

`readUnit` computes each reading separately:

| Reading | What it checks | Code |
|---|---|---|
| **CHL** (Curry–Howard–Lambek) | A message is a term `Args → Text`. A rendering must inhabit the same type: the same arguments at compatible kinds, and the same rich-text tags. A type error counts as evidence against. | `messages.typeCheck` |
| **Light cone (A6)** | A rendering is current only if it renders the current source, directly or through renderings that are themselves current (pivot translation). Otherwise it lies in the causal past and is stale. | `geometry` least fixed point |
| **Chromatic-Lorentzian** | The for and against witnesses are two Boolean markings on the world-line. Metrologic's `settle` (past-closure) gives the reading at any time. `at` slices every world-line to its past cone. | `geometry.worldline` |
| **Sheaf Laplacian** | Over the fiber graph, each stalk ℝ² holds its rendering's two evidence sides (FOUR = 2 × 2). Restrictions are identities. SignGraph computes `L = δᵀδ` and the exact H⁰. | `geometry` via `signgraph/cellular-sheaf` |
| **A8 Language Cone** | The apex is the claim. Each leg is the SignCell cell in one fiber, with G-Set evidence. A pivot leg must commute with the leg it came from. | `geometry` cone |

`coincidence(reading)` checks the conjecture that these readings share:

> the cone is coherent ⟺ every required fiber has a well-typed, current, settled-true rendering ⟺ the sheaf has a global section (one component, zero energy, the source's reading)

The receipt states its hypotheses: the sheaf direction needs a connected fiber graph, and the receipt reports whether each fiber has at most one current rendering. A disagreement under those hypotheses is returned as a `counterexample`. The test suite checks the conjecture, and that settled world-lines equal SignCell's `told`, on 1,500 generated unit/time slices. **This is executable evidence over finite data, not a proof.** The Lean counterparts are Obsmetrologia's `CurryHowardLambek`, `ChromaticLorentzian` and `LawvereKernelH0`.

## Industry formats at the edges

- **Locales.** BCP 47 tags, canonicalised by CLDR. Autonyms, script direction, dates, plurals, collation and word segmentation all come from `Intl` (ICU 78 / CLDR 48, which includes Lakota). Mandarin is `zh-Hans`, and `cmn-Hans` is canonicalised to it.
- **Messages.** ARB catalogs (`locales/*.arb`), one per locale, with ICU MessageFormat strings, formatted by FormatJS `intl-messageformat`. Evidence lives in each message's `x-l-space` metadata, which ARB-aware translation management systems keep.
- **Interchange.** `toXliff` and `fromXliff` exchange XLIFF 2.0 files with translators and TMSs. Each segment's state comes from its reading: `reviewed`, `translated`, or `initial` with an `l-space:*` subState.
- **HTTP.** `requestLocale` and `localeRedirect` choose the locale by path, then the `lang` cookie, then `Accept-Language` (RFC 9110). `negotiate` matches using RFC 4647 lookup, then CLDR likely subtags, so `zh-CN` reaches `zh-Hans` and `zh-TW` does not. Alternates are announced as `hreflang` link elements, RFC 8288 `Link` headers, and sitemap `xhtml:link` entries with `x-default`.

## Policy

`policy` decides, per locale, which witnesses count. Human witnesses always count. Machine witnesses count only where the policy says `{ machine: true }`. Lowering a locale's bar to admit machine renderings is therefore a recorded policy decision, not a side effect of a script. A key that is not admitted in a locale falls back along that locale's RFC 4647 chain to the source. The resolved entry keeps the language it is really in, so the page can mark it with `lang`.

## Use

```js
import { lSpace, resolveMessages, report, tell, serializeArb, createTranslator } from "@red-cup-engineering/l-space";

const space = lSpace({ source: enArb, targets: [zhArb, lktArb] });
const zh = createTranslator(resolveMessages(space, "zh-Hans", { policy: { "zh-Hans": { machine: true } } }), { locale: "zh-Hans" });
zh.t("archive.page", { page: 2, total: 9 }); // { text: "第 2 页，共 9 页", language: "zh-Hans" }
report(space);                               // per-locale coverage, staleness, type errors, total sheaf energy
```

## Development

Until SignCell 0.13.0 is published, the local `pnpm-workspace.yaml` (gitignored) links it from `computer-data-engineering-services-section/apps/signcell`. Run `pnpm install --lockfile=false && npm test`.
