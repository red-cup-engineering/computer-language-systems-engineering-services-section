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

The root archive contains its own public modules, compiler, lexical data and
receiving tests, not independent applications assembled in this repository.
The `apps/` directory contains the Horsetail and Panini submodules and the
separately manifested L-space application; none is a root export, executable
or internally imported module. Their source and submodule links remain intact.
L-space remains inline and its proper repository ownership and independent
package receiving remain unresolved. Excluding it from this root archive is
not an ownership transfer, retirement or qualification of that application.

The existing carrier-module assay and module-request parser were applied to
the published payload and original tests. That is static module-request
evidence, not proof that every runtime path or installation is qualified.
Publication-owner PR128 (carrier assay 0.19.1-dev.8) distinguishes declared
native receiving-test roots from public/runtime roots. Its packed-carrier
assay admits this root payload with zero violations; unsupported test-script
globs remain explicit analysis limits, not fully analyzed invocations. The
tagging test and its English development supplier remain unchanged. Language-
specific science remains with its existing owners.

The source lock remains unchanged and is not evidence of a native frozen
installation for the revised manifest. Source and packed receiving tests,
actual consumer checks, registry issuance and native resolver qualification
are distinct stages.


## Primary corpus-memory receiving

`test:memory` runs the original pure and stored translation-memory contracts
through the public `/translation-memory` and `/stored-translation-memory`
package exports. Both suites ship as `receivingTests` and are included in
`test:consumer`, so the exact packed carrier can run its own primary checks.
The stored-memory tests use only in-memory bucket ports and digest fixtures;
no live corpus read, inference, payment or storage write occurs.

Pure translation memory preserves exact lexical Unicode and recorded witness
identity, including the intentional distinction between NFC and NFD strings.
It does not supply normalized substring search. Stored receiving verifies
bounded bytes, digest, UTF-8 and JSON, rejects invalid requests before reading,
and tests coalesced reads, rejected-edition eviction and the eight-edition LRU.
Passing these suites is source/packed functional evidence, not a frozen
registry installation, live merchant receipt or deployment.

## Complete external edition receiving

`SECTION_DATA_ROOT=/path/to/operations-data pnpm run test:edition` receives the
existing 4101-unit English–Lakota edition through the public memory export.
The external owner supplies `course/corpus-edition.json` and
`course/corpus-practice-full.json`; no corpus is copied into this Code package.
The test verifies the edition's bytes, digest, content-addressed URL and counts,
then compares every source occurrence in both directions against an independent
record/label/witness/disposition projection. It emits cold and warm kernel timing
observations without a hardware-dependent performance threshold.

The program ships in `receivingTests` with an explicit `testRequires.env`
requirement for `SECTION_DATA_ROOT`. The shared JSNode receiving runner reports
`requires` when the binding is absent; that is not full-edition qualification.
Direct `test:edition` fails without it, never falling back to the preview.
Existing `test:consumer` remains the portable fixture suite. A complete bound
shared receiving profile includes this edition check as well as those programs.
Historical full-corpus XML receiving is separate evidence; this program checks
current bidirectional retrieval, not corpus licensing, translation correctness,
registry installation, live storage/inference, merchant settlement or deployment.

The digest check establishes consistency with the supplied edition manifest, not
its provenance or authority. The qualification caller must select the Operations
source revision independently. This receiving run uses the original
`causeway-services/iyappy.561.group` revision
`7cfba58826a08fd22b14863d36cb7ae2e542feb3`; the diagnostic records the actual
observed corpus digest `a10e477bcff17670d7c7a0320e98c5ed9a8ce3a998e4d0601d70c6d813bfe5cd`.
Another externally bound edition is a different receiving observation, not proof
that it is the original authoritative corpus.
