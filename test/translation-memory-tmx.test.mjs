import { renderTranslationMemoryTmx } from '../src/translation-memory-tmx.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';

const r = (value, language = 'en', witness = 'urn:w', e = 'urn:concept:one', a = 'http://www.w3.org/2004/02/skos/core#prefLabel') => ({
  e,
  a,
  v: { kind: 'literal', value, language },
  t: witness
});

test('positive first input, standard XML and tuv count', () => {
  const xml = renderTranslationMemoryTmx([r('water'), r('mní', 'lkt')]);
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<tmx version="1.4"'));
  const tuvCount = xml.split('<tuv ').length - 1;
  assert.equal(tuvCount, 2);
});

test('dedup, properties sorting, and concept sorting', () => {
  const xml = renderTranslationMemoryTmx([
    r('same', 'EN', 'urn:b'),
    r('same', 'en', 'urn:a'),
    r('same', 'en', 'urn:a')
  ]);
  assert.equal(xml.split('<tuv ').length - 1, 1);
  assert.equal(xml.split('<prop ').length - 1, 2);
  assert.ok(xml.indexOf('urn:a') < xml.indexOf('urn:b'));
});

test('competing alpha beta and stable reverse', () => {
  const rows1 = [
    r('a', 'en', 'w1', 'urn:c1', 'http://www.w3.org/2004/02/skos/core#prefLabel'),
    r('b', 'en', 'w2', 'urn:c1', 'http://www.w3.org/2004/02/skos/core#prefLabel'),
    r('c', 'en', 'w3', 'urn:c2', 'http://www.w3.org/2004/02/skos/core#prefLabel')
  ];
  const xml1 = renderTranslationMemoryTmx(rows1);
  const xml2 = renderTranslationMemoryTmx([...rows1].reverse());
  assert.equal(xml1, xml2);
  assert.equal(xml1.split('<tuv ').length - 1, 3);
});

test('invalid predicate ignored and invalid row refused', () => {
  const xml = renderTranslationMemoryTmx([
    r('val1', 'en', 'urn:w', 'urn:c1', 'urn:other#prefLabel')
  ]);
  assert.equal(xml.split('<tuv ').length - 1, 0);
  assert.throws(() => renderTranslationMemoryTmx([r('bad', 'en', 'urn:w', null)]));
});

test('empty rows valid empty body', () => {
  const xml = renderTranslationMemoryTmx([]);
  assert.ok(xml.includes('<body></body>') || xml.includes('<body>\n</body>') || xml.includes('<body>'));
  assert.notEqual(xml, '');
});

test('unicode and special characters', () => {
  const xml = renderTranslationMemoryTmx([r('café\r\t\n <&"', 'en')]);
  assert.ok(xml.includes('&#13;&#9;&#10;'));
  assert.ok(xml.includes('&lt;&amp;&quot;'));
});

test('big output throws RangeError', () => {
  assert.throws(() => {
    renderTranslationMemoryTmx([r('&'.repeat(3400000))]);
  }, RangeError);
});
