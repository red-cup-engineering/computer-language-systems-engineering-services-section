import test from 'node:test';
import assert from 'node:assert/strict';
import {
  admitTranslationMemoryRequest,
  translateFromMemory
} from '../src/translation-memory.mjs';

const PREF = 'http://www.w3.org/2004/02/skos/core#prefLabel';

function makeRow(e, a, val, lang, witness) {
  return {
    e,
    a,
    v: { kind: 'literal', value: val, language: lang },
    t: witness
  };
}

const sampleCorpus = [
  makeRow('http://example.org/c1', PREF, 'water', 'en', 'w1'),
  makeRow('http://example.org/c1', PREF, 'mni', 'lkt', 'w2'),
  makeRow('http://example.org/c2', PREF, 'sun', 'en', 'w3'),
  makeRow('http://example.org/c2', PREF, 'wi', 'lkt', 'w4')
];

test('admitTranslationMemoryRequest validates valid body', () => {
  const req = admitTranslationMemoryRequest({
    text: 'water',
    sourceLanguage: 'EN-US',
    targetLanguage: 'LKT'
  });
  assert.deepEqual(req, {
    text: 'water',
    sourceLanguage: 'en-us',
    targetLanguage: 'lkt'
  });
});

test('admitTranslationMemoryRequest rejects invalid bodies', () => {
  assert.throws(() => admitTranslationMemoryRequest(null), TypeError);
  assert.throws(() => admitTranslationMemoryRequest({ text: 'a', sourceLanguage: 'en' }), TypeError);
  assert.throws(() => admitTranslationMemoryRequest({ text: '', sourceLanguage: 'en', targetLanguage: 'es' }), TypeError);
  assert.throws(() => admitTranslationMemoryRequest({ text: 'a', sourceLanguage: 'invalid lang!!!', targetLanguage: 'es' }));
});

test('bidirectional translation: en -> lkt and lkt -> en', () => {
  const res1 = translateFromMemory(sampleCorpus, {
    text: 'water',
    sourceLanguage: 'en',
    targetLanguage: 'lkt'
  });
  assert.equal(res1.disposition, 'resolved');
  assert.equal(res1.candidates[0].targetLabels[0].value, 'mni');
  assert.deepEqual(res1.candidates[0].targetLabels[0].witnesses, ['w2']);

  const res2 = translateFromMemory(sampleCorpus, {
    text: 'mni',
    sourceLanguage: 'lkt',
    targetLanguage: 'en'
  });
  assert.equal(res2.disposition, 'resolved');
  assert.equal(res2.candidates[0].targetLabels[0].value, 'water');
  assert.deepEqual(res2.candidates[0].targetLabels[0].witnesses, ['w1']);
});

test('handles multilingual tags: en, es, ar, zh-Hans, privateuse', () => {
  const rows = [
    makeRow('http://example.org/c3', PREF, 'hello', 'en', 'w-en'),
    makeRow('http://example.org/c3', PREF, 'hola', 'es', 'w-es'),
    makeRow('http://example.org/c3', PREF, 'مرحبا', 'ar', 'w-ar'),
    makeRow('http://example.org/c3', PREF, '你好', 'zh-Hans', 'w-zh'),
    makeRow('http://example.org/c3', PREF, 'priv', 'x-custom', 'w-priv')
  ];

  const res = translateFromMemory(rows, {
    text: 'hello',
    sourceLanguage: 'en',
    targetLanguage: 'ZH-HANS'
  });
  assert.equal(res.disposition, 'resolved');
  assert.equal(res.candidates[0].targetLabels[0].value, '你好');
});

test('exact NFC vs NFD unicode matching', () => {
  const nfcText = 'café';
  const nfdText = 'café';

  const rows = [
    makeRow('http://example.org/c4', PREF, nfcText, 'fr', 'w-nfc'),
    makeRow('http://example.org/c4', PREF, 'coffee', 'en', 'w-en')
  ];

  const resNfc = translateFromMemory(rows, {
    text: nfcText,
    sourceLanguage: 'fr',
    targetLanguage: 'en'
  });
  assert.equal(resNfc.disposition, 'resolved');

  const resNfd = translateFromMemory(rows, {
    text: nfdText,
    sourceLanguage: 'fr',
    targetLanguage: 'en'
  });
  assert.equal(resNfd.disposition, 'unresolved');
});

test('homonyms produce ambiguous disposition', () => {
  const rows = [
    makeRow('http://example.org/bank1', PREF, 'bank', 'en', 'w1'),
    makeRow('http://example.org/bank1', PREF, 'financial institution', 'en-desc', 'w1b'),
    makeRow('http://example.org/bank1', PREF, 'banco', 'es', 'w2'),
    makeRow('http://example.org/bank2', PREF, 'bank', 'en', 'w3'),
    makeRow('http://example.org/bank2', PREF, 'orilla', 'es', 'w4')
  ];

  const res = translateFromMemory(rows, {
    text: 'bank',
    sourceLanguage: 'en',
    targetLanguage: 'es'
  });
  assert.equal(res.disposition, 'ambiguous');
  assert.equal(res.candidates.length, 2);
});

test('conflicting preferred labels produce contested disposition', () => {
  const rows = [
    makeRow('http://example.org/c5', PREF, 'color', 'en', 'w1'),
    makeRow('http://example.org/c5', PREF, 'colour', 'en', 'w2'),
    makeRow('http://example.org/c5', PREF, 'couleur', 'fr', 'w3')
  ];

  const res = translateFromMemory(rows, {
    text: 'color',
    sourceLanguage: 'en',
    targetLanguage: 'fr'
  });
  assert.equal(res.disposition, 'contested');
});

test('missing targets produce unresolved disposition', () => {
  const rows = [
    makeRow('http://example.org/c6', PREF, 'lone', 'en', 'w1')
  ];

  const res = translateFromMemory(rows, {
    text: 'lone',
    sourceLanguage: 'en',
    targetLanguage: 'es'
  });
  assert.equal(res.disposition, 'unresolved');
  assert.equal(res.candidates.length, 1);
  assert.equal(res.candidates[0].targetLabels.length, 0);
});

test('duplicate and reordered rows are semantically invariant and merge witnesses', () => {
  const rows1 = [
    makeRow('http://example.org/c7', PREF, 'star', 'en', 'w-b'),
    makeRow('http://example.org/c7', PREF, 'star', 'en', 'w-a'),
    makeRow('http://example.org/c7', PREF, 'estrella', 'es', 'w-es')
  ];
  const rows2 = [
    makeRow('http://example.org/c7', PREF, 'estrella', 'es', 'w-es'),
    makeRow('http://example.org/c7', PREF, 'star', 'en', 'w-a'),
    makeRow('http://example.org/c7', PREF, 'star', 'en', 'w-b')
  ];

  const res1 = translateFromMemory(rows1, { text: 'star', sourceLanguage: 'en', targetLanguage: 'es' });
  const res2 = translateFromMemory(rows2, { text: 'star', sourceLanguage: 'en', targetLanguage: 'es' });

  assert.deepEqual(res1, res2);
  assert.deepEqual(res1.candidates[0].sourceLabels[0].witnesses, ['w-a', 'w-b']);
});

test('caller array mutation does not poison compiled edition in WeakMap', () => {
  const originalRows = [
    makeRow('http://example.org/c8', PREF, 'tree', 'en', 'w1'),
    makeRow('http://example.org/c8', PREF, 'árbol', 'es', 'w2')
  ];

  const resFirst = translateFromMemory(originalRows, { text: 'tree', sourceLanguage: 'en', targetLanguage: 'es' });
  assert.equal(resFirst.candidates[0].targetLabels[0].value, 'árbol');

  // Mutate array
  originalRows.push(makeRow('http://example.org/c8', PREF, 'poison', 'es', 'w3'));

  const resWarm = translateFromMemory(originalRows, { text: 'tree', sourceLanguage: 'en', targetLanguage: 'es' });
  assert.deepEqual(resWarm, resFirst);
});

test('result object mutation does not poison cache', () => {
  const rows = [
    makeRow('http://example.org/c9', PREF, 'leaf', 'en', 'w1'),
    makeRow('http://example.org/c9', PREF, 'hoja', 'es', 'w2')
  ];

  const res = translateFromMemory(rows, { text: 'leaf', sourceLanguage: 'en', targetLanguage: 'es' });
  res.candidates[0].targetLabels[0].value = 'mutated';

  const res2 = translateFromMemory(rows, { text: 'leaf', sourceLanguage: 'en', targetLanguage: 'es' });
  assert.equal(res2.candidates[0].targetLabels[0].value, 'hoja');
});
