import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTranslationMemoryTmx } from '../src/translation-memory-tmx.mjs';
import { translateFromMemory } from '../src/translation-memory.mjs';

const row = (value = 'water', language = 'en', e = 'urn:c', t = 'source') => ({
  e,
  a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
  v: {
    kind: 'literal',
    value,
    language
  },
  t
});

test('TMX throws if rows are mutated after translateFromMemory cache', () => {
  const rows = [
    row('water', 'en', 'urn:c', 'source'),
    row('mní', 'lkt', 'urn:c', 'target')
  ];
  translateFromMemory(rows, {
    text: 'water',
    sourceLanguage: 'en',
    targetLanguage: 'lkt'
  });
  rows[0].e = null;
  assert.throws(() => {
    renderTranslationMemoryTmx(rows);
  });
});

test('TMX throws if witness is mutated to empty after export', () => {
  const rows = [
    row('water', 'en', 'urn:c', 'source'),
    row('mní', 'lkt', 'urn:c', 'target')
  ];
  const firstExport = renderTranslationMemoryTmx(rows);
  assert.ok(firstExport);
  rows[0].t = '';
  assert.throws(() => {
    renderTranslationMemoryTmx(rows);
  });
});

test('Reject each XML invalid character in literal, subject IRI, witness', () => {
  const invalidChars = ['\u0000', '\u0001', '\ud800', '\udfff', '\ufffe', '\uffff'];
  for (const char of invalidChars) {
    assert.throws(() => {
      renderTranslationMemoryTmx([row('water' + char, 'en', 'urn:c', 'source'), row('mní', 'lkt', 'urn:c', 'target')]);
    }, `Literal with ${JSON.stringify(char)} should throw`);

    assert.throws(() => {
      renderTranslationMemoryTmx([row('water', 'en', 'urn:c' + char, 'source'), row('mní', 'lkt', 'urn:c', 'target')]);
    }, `Subject with ${JSON.stringify(char)} should throw`);

    assert.throws(() => {
      renderTranslationMemoryTmx([row('water', 'en', 'urn:c', 'source' + char), row('mní', 'lkt', 'urn:c', 'target')]);
    }, `Witness with ${JSON.stringify(char)} should throw`);
  }
});

test('Accept supplementary and combining characters without XML escaping', () => {
  const text = '𐐷 🐦 mní e\u0301';
  const rows = [
    row(text, 'en', 'urn:c', 'source'),
    row('target', 'lkt', 'urn:c', 'target')
  ];
  const xml = renderTranslationMemoryTmx(rows);
  assert.ok(xml.includes(text));
});

test('Preserve NFC vs NFD as distinct TUVs', () => {
  const nfc = 'é';
  const nfd = 'e\u0301';
  assert.notEqual(nfc, nfd);
  const rows = [
    row(nfc, 'en', 'urn:c', 'source'),
    row(nfd, 'en', 'urn:c', 'target')
  ];
  const xml = renderTranslationMemoryTmx(rows);
  assert.ok(xml.includes(nfc));
  assert.ok(xml.includes(nfd));
});

test('Explicit IRI terms for subject and predicate accepted', () => {
  const r = (val, lang, subj, pred, t) => ({
    e: { kind: 'iri', value: subj },
    a: { kind: 'iri', value: pred },
    v: { kind: 'literal', value: val, language: lang },
    t
  });
  const rows = [
    r('water', 'en', 'urn:c', 'http://www.w3.org/2004/02/skos/core#prefLabel', 'source'),
    r('mní', 'lkt', 'urn:c', 'http://www.w3.org/2004/02/skos/core#prefLabel', 'target')
  ];
  const xml = renderTranslationMemoryTmx(rows);
  assert.ok(xml);
});

test('Invalid irrelevant predicate row v:null must throw', () => {
  const rows = [
    {
      e: 'urn:c',
      a: 'http://example.org/invalid',
      v: null,
      t: 'source'
    },
    row('mní', 'lkt', 'urn:c', 'target')
  ];
  assert.throws(() => {
    renderTranslationMemoryTmx(rows);
  });
});

test('Non-array inputs reject undefined, null, object, string', () => {
  const badInputs = [undefined, null, {}, 'x'];
  for (const input of badInputs) {
    assert.throws(() => {
      renderTranslationMemoryTmx(input);
    });
  }
});
