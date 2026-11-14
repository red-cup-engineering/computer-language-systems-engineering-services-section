# @red-cup-engineering/computer-language-systems-engineering-services-section

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Computer language systems engineering: grammars, parsers, and language tooling, including Panini.

[L-space](apps/l-space/README.md) provides typed multilingual message catalogs, ARB and XLIFF interchange, and HTTP locale negotiation.

## Source-exact language reading projection

The shared `./tag` interface consumes the real communicating provider's
articulated word spans and settled sentence spans. It attaches original-document
UTF-16 half-open `sourceSpan` and parallel `wordSourceSpans` to each
`tagText` sentence **only when the native articulation and parsed words agree
exactly** on source bytes, occurrence order and boundaries. Duplicate words
and duplicate sentence strings retain distinct positions. The existing
`words`, `arcs`, `roles`, `tower` and `cohomology` projections are
unchanged.

On a mismatch, `sourceBinding: "withheld"` and a bounded
`sourceBindingReason` accompany null token spans. Consumers must **not**
replace missing coordinates with invented first-occurrence search results,
nor infer factual truth, permission or interpretation authority from syntax.
A `native-exact` binding establishes source byte correspondence only.

Run `npm run test:source-projection` for dependency-free source-binding
regressions. Run `npm run test:tag-native` with the declared development
English-language-algebra package and communicating supplier to test genuine
articulation→settlement→tagging through the public `/tag` and English `/bundle`
exports. No English Git-submodule checkout is needed. `npm run test:consumer`
runs the shipped tag, source-binding and TMX receiving tests from the archive.
Execution using source-provider mounts is not a frozen dependency install;
registry issuance and native resolver qualification remain separate.
Isolated projection tests cannot substitute for that provider-qualified
integration or downstream receiving.

## Earlier work

- Restored files at `lib/legacy/2026-08-01-bcf1ab7` (restore commit bcf1ab7), from the 561-group/bare-cedar-fog history.

## Where language tooling belongs

Start with the producer's input, result, and caller. Shared language runtimes
and interchange belong here. Language-specific standards, bundles, and parsing
adapters belong under their language owners. Science retains the models and
evidence those tools consume. Declare other producer relationships through
package dependencies or source links.

The path from Information Systems through Language Systems and Language
Engineering to English narrows the scope at each step. The implication
goes from child to parent. An English parser is language tooling and
therefore information-processing software. If it uses a language model
from Science, the checkout path records the parser's owner and the
dependency records the model's source.

See [Computer Engineering's placement and package guide](https://github.com/red-cup-engineering/computer-engineering-services-section/blob/47f194ea9b071318c49bf323508ff087b0de6e43/README.md#section-placement-and-package-boundaries).

## Natural-language standards

[Language Engineering](https://github.com/red-cup-engineering/language-engineering-services-section/blob/12c6e2dbf925058e5a3329428e7d5bab6a5ba21c/README.md)
owns the private natural-language standards and their language-specific
implementations, including PlainEng/PTGAE. Language science supplies the
definitions and evidence used by those systems.

The [language-specific corpus applications](https://github.com/red-cup-engineering/language-engineering-services-section/blob/12c6e2dbf925058e5a3329428e7d5bab6a5ba21c/README.md#language-specific-applications)
are indexed by their language owners in Language Engineering.

## Translation and episode package receiving

`npm run test:translation` exercises the public `/translation` and
`/episode-translation` exports using the original translation and episode
contract tests. Both tests ship in the package and are included in
`test:consumer`. The tests inject an in-memory `fakeAi` binding and, for
episodes, an in-memory bucket. They exercise the genuine Workers AI runner
with those bindings; they do not contact an inference provider, use real
credentials, incur model charges or write to external storage.

These receiving checks cover request admission, numbered translation and
model fallback, subtitle preservation, episode terminology and review
behavior. Passing them is not evidence of model translation quality or
live service availability. Source-graph qualification, registry issuance
and a native frozen installation remain separate gates.

### Effect-aware model fallback (0.1.7 development)

This changes failure behavior: a transport error permits trying the next
model only when the genuine provider explicitly reports both
`submissionState: "not-submitted"` and `effectAttempted: false`. Unreceived
or unclassified failures stop, as do null or unreadable results. A received,
readable result with missing numbered items or untranslated Han text still
permits semantic fallback. This preserves the language-owned distinction
introduced in commit `9425b609`, while honoring the provider's existing
submission/effect contract rather than reimplementing it.

Authorization is a private options argument: `translateNumberedBatch(request,
env, { authorize })`, `translateMandarin(body, env, moduleId, { authorize })`,
`translateMandarinToEnglish(body, env, { authorize })`, and each episode
translation function's third argument. The callback receives the genuine
provider's frozen effect before invocation. Body and environment properties
named `authorize` are not hooks or authority. Every alternative model goes
through authorization independently.

`TranslationModelError` preserves the original failure in `cause` and
exposes frozen `attempts` with `attemptScope: "numbered-batch"`. Attempt
records distinguish non-submission, uncertainty, unreadable results,
received semantic rejection and success, preserving available provider
effect evidence without storing prompts or response payloads. The successful
batch result also includes its bounded attempt records. Missing submission
facts are not invented. Exhaustion does not label the whole operation as
unsubmitted based on its last failure.

The record is scoped to the current batch, not the full request. Earlier
batches or levels may already have invoked providers. No automatic replay
of a complete request is justified, and no exactly-once persistence or
zero-charge guarantee is implied. Episode tests prove no bucket write occurs
when the first model outcome is uncertain; they do not establish transactional
or exactly-once storage. Model quality, live provider availability and a
native frozen installation remain separately unqualified.

## Direct dependency boundary

The root package declares suppliers its own published modules use. Dependencies
needed by another supplier remain that supplier's responsibility; they are not
redeclared here merely to make a hoisted development graph load. Removing
unused root declarations does not remove transitive requirements or change any
language, parsing, translation or inference behavior.

The existing carrier-module assay and module-request parser were applied to
the complete published payload, including nested L-space, and original tests.
That is static module-request evidence, not proof that every runtime path or
installation is qualified. The packed carrier still has known observations
for L-space dependencies declared only in its nested manifest and for the
assay's treatment of a shipped test's English development supplier. Those
observations remain unresolved; no nested application was removed or declared
optional to hide them. Language-specific science remains with its existing
owners.

The source lock remains unchanged and is not evidence of a native frozen
installation for the revised manifest. Source and packed receiving tests,
actual consumer checks, registry issuance and native resolver qualification
are distinct stages.
