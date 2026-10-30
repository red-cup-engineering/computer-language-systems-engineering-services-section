# @red-cup-engineering/computer-language-systems-engineering-services-section

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Computer language systems engineering: grammars, parsers, and language tooling, including Panini.


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
