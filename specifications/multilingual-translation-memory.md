
# Corpus-backed multilingual translation memory

Original Work ni:///sha-256;L9SxD0Nx_eL_L-6vtLynNV_tc3ebg17wJzTrHA3oip0,
Engineering fiber-language-technology-alignment.json and its 2026-10-27
continuations. The Leader explicitly requires working non-inference translation
over x402, multilingual iYappy, a Lakota 561.group homepage and bidirectional
Lakota translation from the already-provided corpus.

## Behavioral specification

Compile up to10000 RDF/EAVT rows and16MiB UTF-8 JSON as one source snapshot.
Validate e/a as original RDF IRIs (strings or explicit terms), v as an explicit
native RDF term, t as a nonempty source witness string. Index skos:prefLabel
tagged literals; retain other admitted triples without treating them as labels.
Use original RDF term admission, not a new RDF/SPARQL parser. Preserve lexical
Unicode exactly; compare language tags case-insensitively using native RDF
LANGTAG admission. Keep all concept IRIs distinct even when their labels match.

Admit exactly {text,sourceLanguage,targetLanguage}; text is nonblank and at
most4096 UTF-16 units, both tags explicit; no locale default, normalization,
inference, paid fallback or caller dataset selection. Return all matched concept
candidates with ALL source/target labels and their sorted distinct t witnesses.
Disposition: contested for conflicting preferred labels within a matched
concept/language, otherwise ambiguous for multiple matched concepts, unresolved
for no source or missing target, otherwise resolved. An unknown phrase remains
unknown. This is bidirectional exact translation memory, not arbitrary
sentence-level equivalence or a universal CHL theorem.

## Architecture and design

Data owns RDF admission/query/codecs; Language Systems owns corpus realization
and a per-source compiled lookup index; existing Networking/x402 and Market own
validation/verification/compute/settlement. iYappy and Group ARB publication consume
the same concept/form evidence. Existing Science FCA/CHL declarations remain
separate from empirical source claims. Corpus Word files stay source artifacts;
the document's explicit nonitalic-source, line-break, italic-translation
structure is an observed alignment profile, not guessed paragraph-index equality
between two different documents. The recovered translated file has5960
paragraphs and4101 profile-matching units;312 other nonempty paragraphs remain
retained source, not fabricated translations.

Use a WeakMap keyed by the original rows array to capture a validated, internally
immutable snapshot once; later mutation of that caller array does not rewrite an
already captured edition. A new array is a new capture. Index by structured
(language,text) tuple and concept IRI using Map, never property-name heuristics.
Warm calls read the compiled index and never rescan/re-hash the corpus. Return
fresh or frozen result structures that cannot mutate the cached edition. Bound
memory by source lifetime through WeakMap; no durable cache, new ledger or
global lexical identity table. Raw-corpus authority and public translation
dataset selection remain the original source-owner/merchant configuration.

Add exports admitTranslationMemoryRequest(body) and
translateFromMemory(rows,body) in src/translation-memory.mjs.
Return {method:'translation-memory',inferenceUsed:false,disposition,
sourceLanguage,targetLanguage,candidates:[{conceptIri,sourceLabels,targetLabels}]}.
Label records are {value,language,witnesses}. Sort all externally visible sets
by code-unit order, making duplicate/reordered rows semantically invariant.

## Fabrication and receiving

The existing native CIE provider supplies source; original FeltOS
captureSoftwareChangeSource/projectFabricatedSoftwareChanges/
induceVerifiedSoftwareMissionProposal bind source bytes, effects, checks and
rollback. This original fabricator already handles absent targets; do not
implement a rival generator to get new files. The original RDF0.1.6-dev.133
dependency is an exact qualified input; freeze other supplier inputs through
the original consumer composition. Qualify original/alternate/refused cases,
cache-capture mutation/new-edition behavior, independent real4101-unit receiving
and cold/warm cost observations. Then integrate native x402 and iYappy consumers,
their actual builds/deployments and independent HTTP receiving. A source merge
does not establish installation or an outside paid buyer.

Selected standards are RDF1.1, SKOS2009, BCP47, W3C Results JSON and original
x402v2. Group localization stays ARB/ICU; standard translation-memory interchange
is an independently owned format boundary, not this index's private exchange
grammar. SVG language uses the existing XML/SVG owner and explicit Horsetail
forms, with independent decoding/round-trip rather than an image-as-proof claim.
