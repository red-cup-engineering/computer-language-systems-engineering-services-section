import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import test from 'node:test';
import { translateFromMemory } from '@red-cup-engineering/computer-language-systems-engineering-services-section/translation-memory';

const PREF = 'http://www.w3.org/2004/02/skos/core#prefLabel';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const textOf = value => typeof value === 'string' ? value : value.value;

// Independent source projection: never derive expected evidence from kernel output.
function oracle(rows) {
  const concepts = new Map(), requests = [];
  for (const row of rows) {
    assert.equal(textOf(row.a), PREF);
    assert.equal(row.v.kind, 'literal');
    assert.ok(['en', 'lkt'].includes(row.v.language));
    assert.equal(typeof row.t, 'string'); assert.ok(row.t.length);
    const concept = textOf(row.e);
    if (!concepts.has(concept)) concepts.set(concept, []);
    concepts.get(concept).push(row);
    requests.push({text: row.v.value, sourceLanguage: row.v.language,
      targetLanguage: row.v.language === 'en' ? 'lkt' : 'en'});
  }
  const labels = (records, language) => {
    const values = new Map();
    for (const row of records.filter(row => row.v.language === language)) {
      if (!values.has(row.v.value)) values.set(row.v.value, new Set());
      values.get(row.v.value).add(row.t);
    }
    return [...values].sort(([a], [b]) => compare(a, b)).map(([value, witnesses]) =>
      ({value, language, witnesses: [...witnesses].sort(compare)}));
  };
  const lookup = new Map();
  for (const [concept, records] of concepts) for (const row of records) {
    const key = JSON.stringify([row.v.language, row.v.value]);
    if (!lookup.has(key)) lookup.set(key, new Set());
    lookup.get(key).add(concept);
  }
  const expected = request => {
    const ids = [...lookup.get(JSON.stringify([request.sourceLanguage, request.text])) ?? []].sort(compare);
    const candidates = ids.map(conceptIri => ({conceptIri,
      sourceLabels: labels(concepts.get(conceptIri), request.sourceLanguage),
      targetLabels: labels(concepts.get(conceptIri), request.targetLanguage)}));
    const disposition = candidates.some(c => c.sourceLabels.length > 1 || c.targetLabels.length > 1) ? 'contested'
      : candidates.length > 1 ? 'ambiguous'
      : !candidates.length || candidates.some(c => !c.sourceLabels.length || !c.targetLabels.length) ? 'unresolved' : 'resolved';
    return {method:'translation-memory', inferenceUsed:false, disposition,
      sourceLanguage:request.sourceLanguage, targetLanguage:request.targetLanguage, candidates};
  };
  return {concepts, requests, expected};
}

test('externally bound complete corpus edition receives exact bidirectional evidence', t => {
  assert.ok(process.env.SECTION_DATA_ROOT?.trim(), 'SECTION_DATA_ROOT is required; no preview or generated fallback');
  const root = resolve(process.env.SECTION_DATA_ROOT);
  const edition = JSON.parse(readFileSync(join(root, 'course/corpus-edition.json'), 'utf8'));
  assert.deepEqual(Object.keys(edition).sort(), ['bytes','integrity','pairCount','rowCount','url']);
  const bytes = readFileSync(join(root, 'course/corpus-practice-full.json'));
  const digest = createHash('sha256').update(bytes).digest();
  assert.equal(edition.bytes, bytes.length);
  assert.equal(edition.integrity, `sha256-${digest.toString('base64')}`);
  assert.equal(edition.url, `/data/iyappy-corpus-${digest.toString('hex')}.json`);
  assert.ok(bytes.length <= 16777216);
  const rows = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  assert.equal(edition.pairCount, 4101, 'this receiver qualifies the existing 4101-unit edition');
  assert.equal(edition.rowCount, 8202); assert.equal(rows.length, edition.rowCount);
  const {concepts, requests, expected} = oracle(rows);
  assert.equal(concepts.size, edition.pairCount);
  for (const records of concepts.values()) {
    assert.equal(records.length, 2);
    assert.deepEqual(records.map(row => row.v.language).sort(), ['en', 'lkt']);
  }
  const original = JSON.stringify(rows);
  const coldStart = performance.now();
  const cold = translateFromMemory(rows, requests[0]);
  const coldMilliseconds = performance.now() - coldStart;
  assert.deepEqual(cold, expected(requests[0]));
  let warmMilliseconds = 0;
  const dispositions = {};
  for (const request of requests) {
    const start = performance.now();
    const result = translateFromMemory(rows, request);
    warmMilliseconds += performance.now() - start;
    assert.equal(typeof result?.then, 'undefined');
    assert.deepEqual(result, expected(request));
    dispositions[result.disposition] = (dispositions[result.disposition] ?? 0) + 1;
  }
  assert.equal(JSON.stringify(rows), original, 'source records and witnesses are unchanged');
  const first = requests[0], wanted = expected(first);
  cold.candidates.length = 0;
  assert.deepEqual(translateFromMemory(rows, first), wanted, 'result mutation cannot change captured edition');
  rows[0].v.value = 'changed after capture'; rows[0].t = 'changed witness after capture';
  assert.deepEqual(translateFromMemory(rows, first), wanted, 'caller mutation cannot rewrite captured edition');
  t.diagnostic(JSON.stringify({kind:'translation-memory-edition-receiving.v1',
    sourceSha256:digest.toString('hex'), sourceBytes:bytes.length, concepts:concepts.size,
    checkedOccurrences:requests.length, directions:['en-lkt','lkt-en'], dispositions,
    coldMilliseconds, warmLookupMilliseconds:warmMilliseconds,
    warmLookupCount:requests.length, timingScope:'kernel calls only; oracle/assertions excluded; no speed threshold'}));
});
