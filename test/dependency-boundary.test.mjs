import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('language tooling does not install or require the inference-engine backend', () => {
  const inference = '@red-cup-engineering/computer-inference-engine';
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    assert.equal(Object.hasOwn(manifest[field] ?? {}, inference), false, `${field} must not own the inference backend`);
  }
  assert.ok(manifest.dependencies['@red-cup-engineering/communicating'], 'tagging still consumes communicating');
});
