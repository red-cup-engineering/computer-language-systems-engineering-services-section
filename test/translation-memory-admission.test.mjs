import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { admitTranslationMemoryEdition, translateFromMemory } from '@red-cup-engineering/computer-language-systems-engineering-services-section/translation-memory';
import { translateFromStoredMemory } from '@red-cup-engineering/computer-language-systems-engineering-services-section/stored-translation-memory';

const PREF_LABEL = 'http://www.w3.org/2004/02/skos/core#prefLabel';

function row(language, value, t = 'fixture-witness') {
  return {
    e: 'https://example.invalid/concepts/cat',
    a: PREF_LABEL,
    v: { kind: 'literal', value, language },
    t,
  };
}

test('edition admission is independent of any lookup language or text', () => {
  const rows = [row('FR', 'chat'), row('ja', 'ねこ')];
  const found = admitTranslationMemoryEdition(rows);
  assert.deepEqual(found, {
    kind: 'translation-memory-edition',
    rowCount: 2,
    conceptCount: 1,
    languageTags: ['fr', 'ja'],
  });
  assert.ok(Object.isFrozen(found) && Object.isFrozen(found.languageTags));
  assert.strictEqual(admitTranslationMemoryEdition(rows), found);
  const lookup = translateFromMemory(rows, { sourceLanguage: 'FR', targetLanguage: 'ja', text: 'chat' });
  assert.equal(lookup.disposition, 'resolved');
  assert.equal(lookup.inferenceUsed, false);
  assert.deepEqual(lookup.candidates[0].targetLabels,
    [{ value: 'ねこ', language: 'ja', witnesses: ['fixture-witness'] }]);
  assert.equal(translateFromMemory(rows, { sourceLanguage: 'en', targetLanguage: 'lkt', text: 'unknown' }).disposition,
    'unresolved');
});

test('edition admission retains the existing row and witness rules', () => {
  assert.throws(() => admitTranslationMemoryEdition([row('fr', 'chat', '')]), /witness/u);
  assert.throws(() => admitTranslationMemoryEdition([row('not a tag', 'chat')]), /RDF term|language/u);
  assert.throws(() => admitTranslationMemoryEdition(null), /rows must be/u);
});

test('the stored-memory consumer uses the same admission with the actual edition bytes', async () => {
  const raw = new TextEncoder().encode(JSON.stringify([row('fr', 'chat'), row('ja', 'ねこ')]));
  const config = { objectKey: 'recorded/edition.json', bytes: raw.byteLength,
    sha256: createHash('sha256').update(raw).digest('hex') };
  let gets = 0;
  const bucket = { async get(key) {
    assert.equal(key, config.objectKey);
    gets++;
    return { size: raw.byteLength, async arrayBuffer() { return raw.buffer.slice(0); } };
  } };
  const forward = await translateFromStoredMemory({ sourceLanguage: 'fr', targetLanguage: 'ja', text: 'chat' }, bucket, config);
  const reverse = await translateFromStoredMemory({ sourceLanguage: 'ja', targetLanguage: 'fr', text: 'ねこ' }, bucket, config);
  assert.equal(gets, 1);
  assert.equal(forward.disposition, 'resolved');
  assert.deepEqual(reverse.candidates[0].targetLabels,
    [{ value: 'chat', language: 'fr', witnesses: ['fixture-witness'] }]);
});
