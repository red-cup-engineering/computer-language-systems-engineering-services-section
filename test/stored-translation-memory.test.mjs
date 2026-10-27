import test from 'node:test';
import assert from 'node:assert';
import { webcrypto } from 'node:crypto';
import { translateFromStoredMemory } from '../src/stored-translation-memory.mjs';

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

const sampleRows = [
  {
    e: 'urn:concept:1',
    a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
    v: { kind: 'literal', value: 'water', language: 'en' },
    t: 'urn:source:1'
  },
  {
    e: 'urn:concept:1',
    a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
    v: { kind: 'literal', value: 'agua', language: 'es' },
    t: 'urn:source:1'
  }
];

async function createCorpusFixture(rows) {
  const jsonStr = JSON.stringify(rows);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(jsonStr);
  const digestBuf = await crypto.subtle.digest('SHA-256', bytes);
  const sha256 = Array.from(new Uint8Array(digestBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return { bytes, sha256, jsonStr };
}

test('Successful translation in both directions without inference', async () => {
  const fixture = await createCorpusFixture(sampleRows);
  let getCount = 0;
  const bucket = {
    async get(key) {
      getCount++;
      assert.strictEqual(key, 'corpus.json');
      return {
        size: fixture.bytes.length,
        async arrayBuffer() {
          return fixture.bytes.slice().buffer;
        }
      };
    }
  };

  const config = {
    objectKey: 'corpus.json',
    bytes: fixture.bytes.length,
    sha256: fixture.sha256
  };

  const bodyEnToEs = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };
  const res1 = await translateFromStoredMemory(bodyEnToEs, bucket, config);
  assert.strictEqual(res1.disposition, 'resolved');
  assert.strictEqual(res1.inferenceUsed, false);
  assert.strictEqual(res1.candidates[0].targetLabels[0].value, 'agua');
  assert.strictEqual(getCount, 1);

  // Warm call uses cache
  const res2 = await translateFromStoredMemory(bodyEnToEs, bucket, config);
  assert.strictEqual(res2.disposition, 'resolved');
  assert.strictEqual(res2.inferenceUsed, false);
  assert.strictEqual(res2.candidates[0].targetLabels[0].value, 'agua');
  assert.strictEqual(getCount, 1);

  const bodyEsToEn = { text: 'agua', sourceLanguage: 'es', targetLanguage: 'en' };
  const res3 = await translateFromStoredMemory(bodyEsToEn, bucket, config);
  assert.strictEqual(res3.disposition, 'resolved');
  assert.strictEqual(res3.inferenceUsed, false);
  assert.strictEqual(res3.candidates[0].targetLabels[0].value, 'water');
  assert.strictEqual(getCount, 1);
});

test('Body invalid before bucket get', async () => {
  let getCount = 0;
  const bucket = {
    async get() {
      getCount++;
      return {};
    }
  };
  const config = {
    objectKey: 'corpus.json',
    bytes: 10,
    sha256: 'a'.repeat(64)
  };

  await assert.rejects(
    async () => translateFromStoredMemory({ text: 'water' }, bucket, config),
    /ValidationError|sourceLanguage|targetLanguage/
  );
  assert.strictEqual(getCount, 0);
});

test('Missing object throws error', async () => {
  const bucket = {
    async get() {
      return null;
    }
  };
  const fixture = await createCorpusFixture(sampleRows);
  const config = {
    objectKey: 'missing.json',
    bytes: fixture.bytes.length,
    sha256: fixture.sha256
  };

  const body = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };
  await assert.rejects(
    async () => translateFromStoredMemory(body, bucket, config),
    /Object not found/
  );
});

test('Size mismatch rejection', async () => {
  const fixture = await createCorpusFixture(sampleRows);
  const bucket = {
    async get() {
      return {
        size: fixture.bytes.length + 1,
        async arrayBuffer() {
          return fixture.bytes.slice().buffer;
        }
      };
    }
  };
  const config = {
    objectKey: 'corpus.json',
    bytes: fixture.bytes.length,
    sha256: fixture.sha256
  };

  const body = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };
  await assert.rejects(
    async () => translateFromStoredMemory(body, bucket, config),
    /Object size mismatch/
  );
});

test('Digest mismatch rejection', async () => {
  const fixture = await createCorpusFixture(sampleRows);
  const bucket = {
    async get() {
      return {
        size: fixture.bytes.length,
        async arrayBuffer() {
          return fixture.bytes.slice().buffer;
        }
      };
    }
  };
  const config = {
    objectKey: 'corpus.json',
    bytes: fixture.bytes.length,
    sha256: 'f'.repeat(64)
  };

  const body = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };
  await assert.rejects(
    async () => translateFromStoredMemory(body, bucket, config),
    /SHA-256 digest mismatch/
  );
});

test('Invalid UTF-8 and invalid JSON and non-array rejection', async () => {
  const invalidUtf8Bytes = new Uint8Array([0xff, 0xfe, 0xfd]);
  const digestBuf = await crypto.subtle.digest('SHA-256', invalidUtf8Bytes);
  const sha256 = Array.from(new Uint8Array(digestBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  const bucketUtf8 = {
    async get() {
      return {
        size: invalidUtf8Bytes.length,
        async arrayBuffer() { return invalidUtf8Bytes.buffer; }
      };
    }
  };
  const configUtf8 = { objectKey: 'utf8.json', bytes: invalidUtf8Bytes.length, sha256 };
  const body = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };

  await assert.rejects(
    async () => translateFromStoredMemory(body, bucketUtf8, configUtf8),
    /encoding|decode|URI|Error/
  );

  // Invalid JSON
  const fixtureJson = await createCorpusFixture(sampleRows);
  const badJsonBytes = new TextEncoder().encode('{ invalid json');
  const badDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', badJsonBytes))).map(b => b.toString(16).padStart(2, '0')).join('');
  const bucketJson = {
    async get() {
      return { size: badJsonBytes.length, async arrayBuffer() { return badJsonBytes.buffer; } };
    }
  };
  const configJson = { objectKey: 'bad.json', bytes: badJsonBytes.length, sha256: badDigest };

  await assert.rejects(
    async () => translateFromStoredMemory(body, bucketJson, configJson),
    /Malformed JSON corpus/
  );

  // Non-array JSON
  const nonArrayBytes = new TextEncoder().encode('{"not": "an array"}');
  const nonArrayDigest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', nonArrayBytes))).map(b => b.toString(16).padStart(2, '0')).join('');
  const bucketNonArray = {
    async get() {
      return { size: nonArrayBytes.length, async arrayBuffer() { return nonArrayBytes.buffer; } };
    }
  };
  const configNonArray = { objectKey: 'nonarray.json', bytes: nonArrayBytes.length, sha256: nonArrayDigest };

  await assert.rejects(
    async () => translateFromStoredMemory(body, bucketNonArray, configNonArray),
    /Corpus rows must be an array/
  );
});

test('Concurrent coalescing of reads', async () => {
  const fixture = await createCorpusFixture(sampleRows);
  let getCount = 0;
  const bucket = {
    async get() {
      getCount++;
      await new Promise(r => setTimeout(r, 20));
      return {
        size: fixture.bytes.length,
        async arrayBuffer() { return fixture.bytes.slice().buffer; }
      };
    }
  };
  const config = { objectKey: 'conc.json', bytes: fixture.bytes.length, sha256: fixture.sha256 };
  const body = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };

  const [r1, r2, r3] = await Promise.all([
    translateFromStoredMemory(body, bucket, config),
    translateFromStoredMemory(body, bucket, config),
    translateFromStoredMemory(body, bucket, config)
  ]);

  assert.strictEqual(r1.disposition, 'resolved');
  assert.strictEqual(r1.inferenceUsed, false);
  assert.strictEqual(r1.candidates[0].targetLabels[0].value, 'agua');
  assert.strictEqual(r2.disposition, 'resolved');
  assert.strictEqual(r2.inferenceUsed, false);
  assert.strictEqual(r2.candidates[0].targetLabels[0].value, 'agua');
  assert.strictEqual(r3.disposition, 'resolved');
  assert.strictEqual(r3.inferenceUsed, false);
  assert.strictEqual(r3.candidates[0].targetLabels[0].value, 'agua');
  assert.strictEqual(getCount, 1);
});

test('Corrupt failure evicted and retried', async () => {
  const fixture = await createCorpusFixture(sampleRows);
  let attempts = 0;
  const bucket = {
    async get() {
      attempts++;
      if (attempts === 1) {
        // Return corrupt content that mismatches sha256
        const badBytes = fixture.bytes.slice(); badBytes[0] ^= 0xFF;
        return {
          size: badBytes.length,
          async arrayBuffer() { return badBytes.buffer; }
        };
      }
      return {
        size: fixture.bytes.length,
        async arrayBuffer() { return fixture.bytes.slice().buffer; }
      };
    }
  };
  const config = { objectKey: 'retry.json', bytes: fixture.bytes.length, sha256: fixture.sha256 };
  const body = { text: 'water', sourceLanguage: 'en', targetLanguage: 'es' };

  await assert.rejects(
    async () => translateFromStoredMemory(body, bucket, config),
    /SHA-256 digest mismatch/
  );

  // Retry should succeed and perform a new get
  const res = await translateFromStoredMemory(body, bucket, config);
  assert.strictEqual(res.disposition, 'resolved');
  assert.strictEqual(res.inferenceUsed, false);
  assert.strictEqual(res.candidates[0].targetLabels[0].value, 'agua');
  assert.strictEqual(attempts, 2);
});

test('Changing immutable config SHA creates new edition', async () => {
  const fixture1 = await createCorpusFixture(sampleRows);
  const fixture2 = await createCorpusFixture([
    {
      e: 'urn:concept:2',
      a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
      v: { kind: 'literal', value: 'fire', language: 'en' },
      t: 'urn:source:2'
    },
    {
      e: 'urn:concept:2',
      a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
      v: { kind: 'literal', value: 'fuego', language: 'es' },
      t: 'urn:source:2'
    }
  ]);

  let activeSha = fixture1.sha256;
  let activeBytes = fixture1.bytes;
  const bucket = {
    async get() {
      const currentFixture = activeSha === fixture1.sha256 ? fixture1 : fixture2;
      return {
        size: currentFixture.bytes.length,
        async arrayBuffer() { return currentFixture.bytes.slice().buffer; }
      };
    }
  };

  const config1 = { objectKey: 'imm.json', bytes: fixture1.bytes.length, sha256: fixture1.sha256 };
  const config2 = { objectKey: 'imm.json', bytes: fixture2.bytes.length, sha256: fixture2.sha256 };

  const res1 = await translateFromStoredMemory({ text: 'water', sourceLanguage: 'en', targetLanguage: 'es' }, bucket, config1);
  assert.strictEqual(res1.disposition, 'resolved');
  assert.strictEqual(res1.inferenceUsed, false);
  assert.strictEqual(res1.candidates[0].targetLabels[0].value, 'agua');

  activeSha = fixture2.sha256;
  activeBytes = fixture2.bytes;

  const res2 = await translateFromStoredMemory({ text: 'fire', sourceLanguage: 'en', targetLanguage: 'es' }, bucket, config2);
  assert.strictEqual(res2.disposition, 'resolved');
  assert.strictEqual(res2.inferenceUsed, false);
  assert.strictEqual(res2.candidates[0].targetLabels[0].value, 'fuego');
});

test('Max 8 cache LRU eviction', async () => {
  const fixtures = [];
  for (let i = 0; i < 9; i++) {
    fixtures.push(await createCorpusFixture([
      {
        e: `urn:concept:${i}`,
        a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
        v: { kind: 'literal', value: `word${i}`, language: 'en' },
        t: 'urn:source:1'
      },
      {
        e: `urn:concept:${i}`,
        a: 'http://www.w3.org/2004/02/skos/core#prefLabel',
        v: { kind: 'literal', value: `palabra${i}`, language: 'es' },
        t: 'urn:source:1'
      }
    ]));
  }

  let getCount = 0;
  const bucket = {
    async get(key) {
      getCount++;
      const idx = parseInt(key.replace('file', '').replace('.json', ''), 10);
      const f = fixtures[idx];
      return {
        size: f.bytes.length,
        async arrayBuffer() { return f.bytes.slice().buffer; }
      };
    }
  };

  // Load 8 items (0 to 7)
  for (let i = 0; i < 8; i++) {
    const cfg = { objectKey: `file${i}.json`, bytes: fixtures[i].bytes.length, sha256: fixtures[i].sha256 };
    await translateFromStoredMemory({ text: `word${i}`, sourceLanguage: 'en', targetLanguage: 'es' }, bucket, cfg);
  }
  assert.strictEqual(getCount, 8);

  // Access item 0 to refresh its LRU position
  const cfg0 = { objectKey: 'file0.json', bytes: fixtures[0].bytes.length, sha256: fixtures[0].sha256 };
  await translateFromStoredMemory({ text: 'word0', sourceLanguage: 'en', targetLanguage: 'es' }, bucket, cfg0);
  assert.strictEqual(getCount, 8);

  // Load item 8, which should evict item 1 (since 0 was refreshed)
  const cfg8 = { objectKey: 'file8.json', bytes: fixtures[8].bytes.length, sha256: fixtures[8].sha256 };
  await translateFromStoredMemory({ text: 'word8', sourceLanguage: 'en', targetLanguage: 'es' }, bucket, cfg8);
  assert.strictEqual(getCount, 9);

  // Item 0 should be cached (getCount stays 9)
  await translateFromStoredMemory({ text: 'word0', sourceLanguage: 'en', targetLanguage: 'es' }, bucket, cfg0);
  assert.strictEqual(getCount, 9);

  // Item 1 should have been evicted, so loading it triggers a new get (getCount becomes 10)
  const cfg1 = { objectKey: 'file1.json', bytes: fixtures[1].bytes.length, sha256: fixtures[1].sha256 };
  await translateFromStoredMemory({ text: 'word1', sourceLanguage: 'en', targetLanguage: 'es' }, bucket, cfg1);
  assert.strictEqual(getCount, 10);
});
