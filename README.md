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
regressions. Run `npm run test:tag-native` in a checkout with the original
English-language-algebra Git submodule and exact installed communicating
dependencies to test genuine articulation→settlement→tagging end-to-end.
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
