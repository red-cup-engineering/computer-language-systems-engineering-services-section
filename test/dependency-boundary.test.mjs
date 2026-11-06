import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('language tooling does not directly depend on the inference-engine backend', () => {
  const inference = '@red-cup-engineering/computer-inference-engine';
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.equal(Object.hasOwn(manifest[field] ?? {}, inference), false, `${field} must not own the inference backend`);
  }
  assert.ok(manifest.dependencies['@red-cup-engineering/communicating'], 'tagging still consumes communicating');
});

// This repository uses one root importer. Keep it consistent without rejecting
// inference snapshots still required by other, unchanged dependency owners.
test('the root lockfile importer matches the direct dependency boundary', () => {
  const lock = readFileSync(new URL('../pnpm-lock.yaml', import.meta.url), 'utf8');
  const importer = lock.split('importers:\n')[1]?.split('\npackages:')[0];
  assert.ok(importer, 'the root importer must be present');
  assert.doesNotMatch(importer, /'@red-cup-engineering\/computer-inference-engine':/);
});
