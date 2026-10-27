import { admitTranslationMemoryRequest, translateFromMemory } from './translation-memory.mjs';

const cacheRegistry = new WeakMap();

function toHex(buffer) {
  const bytes = new Uint8Array(buffer);
  const hexChars = new Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    hexChars[i] = bytes[i].toString(16).padStart(2, '0');
  }
  return hexChars.join('');
}

function validateConfiguration(configuration) {
  if (!configuration || typeof configuration !== 'object') {
    throw new Error('Invalid configuration');
  }
  const { objectKey, bytes, sha256 } = configuration;
  const keys = Object.keys(configuration);
  if (keys.length !== 3 || keys.includes('objectKey') !== true || keys.includes('bytes') !== true || keys.includes('sha256') !== true) {
    throw new Error('Invalid configuration keys');
  }
  if (typeof objectKey !== 'string' || objectKey.length === 0 || objectKey.length > 512) {
    throw new Error('Invalid objectKey');
  }
  if (objectKey.includes('..') || objectKey.startsWith('/')) {
    throw new Error('Invalid objectKey path');
  }
  
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > 16777216) {
    throw new Error('Invalid bytes size');
  }
  
  if (typeof sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error('Invalid sha256 checksum');
  }

  return {
    objectKey: String(objectKey),
    bytes: Number(bytes),
    sha256: String(sha256)
  };
}

function getStorageCache(bucket) {
  let bucketCache = cacheRegistry.get(bucket);
  if (!bucketCache) {
    bucketCache = new Map();
    cacheRegistry.set(bucket, bucketCache);
  }
  return bucketCache;
}

export async function translateFromStoredMemory(body, bucket, configuration) {
  const request = admitTranslationMemoryRequest(body);
  
  if (!bucket || typeof bucket !== 'object' || typeof bucket.get !== 'function') {
    throw new Error('Invalid bucket port');
  }

  const safeConfig = validateConfiguration(configuration);
  const cacheKey = JSON.stringify([safeConfig.objectKey, safeConfig.bytes, safeConfig.sha256]);
  const bucketCache = getStorageCache(bucket);

  let editionPromise = bucketCache.get(cacheKey);

  if (editionPromise) {
    bucketCache.delete(cacheKey);
    bucketCache.set(cacheKey, editionPromise);
  } else {
    if (bucketCache.size >= 8) {
      const oldestKey = bucketCache.keys().next().value;
      bucketCache.delete(oldestKey);
    }

    editionPromise = (async () => {
      const obj = await bucket.get(safeConfig.objectKey);
      if (!obj || typeof obj !== 'object') {
        throw new Error('Object not found');
      }
      if (obj.size !== safeConfig.bytes) {
        throw new Error('Object size mismatch');
      }
      if (typeof obj.arrayBuffer !== 'function') {
        throw new Error('Invalid object body');
      }

      const buf = await obj.arrayBuffer();
      if (!(buf instanceof ArrayBuffer) || buf.byteLength !== safeConfig.bytes) {
        throw new Error('Invalid arrayBuffer read');
      }

      const digestBuf = await crypto.subtle.digest('SHA-256', buf);
      const computedSha256 = toHex(digestBuf);
      if (computedSha256 !== safeConfig.sha256) {
        throw new Error('SHA-256 digest mismatch');
      }

      const decoder = new TextDecoder('utf-8', { fatal: true });
      const jsonString = decoder.decode(buf);
      
      let rows;
      try {
        rows = JSON.parse(jsonString);
      } catch (e) {
        throw new Error('Malformed JSON corpus');
      }

      if (!Array.isArray(rows)) {
        throw new Error('Corpus rows must be an array');
      }

      translateFromMemory(rows, request);

      return rows;
    })();

    bucketCache.set(cacheKey, editionPromise);

    editionPromise.catch(() => {
      if (bucketCache.get(cacheKey) === editionPromise) {
        bucketCache.delete(cacheKey);
      }
    });
  }

  const rows = await editionPromise;
  return translateFromMemory(rows, request);
}
