/// <reference types="node" />
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  BEGIN_GENERATED_MARKER,
  END_GENERATED_MARKER,
  exportSeedContent,
  extractGeneratedContent,
  replaceGeneratedContent,
  stableJson,
} from './seed-content';

const here = dirname(fileURLToPath(import.meta.url));
const SEED_PATH = resolve(here, '../../../../../database/seed.sql');

describe('seed content exporter', () => {
  it('produces deterministic output across repeated calls', () => {
    const first = exportSeedContent();
    const second = exportSeedContent();
    expect(second).toBe(first);
  });

  it('stableJson sorts object keys recursively regardless of insertion order', () => {
    const a = { z: 1, a: { d: true, b: [2, 1], c: undefined }, m: -0 };
    const b = { m: 0, a: { b: [2, 1], d: true }, z: 1 };
    expect(stableJson(a)).toBe(stableJson(b));
    expect(stableJson(a)).toBe('{"a":{"b":[2,1],"d":true},"m":0,"z":1}');
  });

  it('database/seed.sql generated block matches bundled content', () => {
    const currentSeed = readFileSync(SEED_PATH, 'utf8');
    expect(currentSeed).toContain(BEGIN_GENERATED_MARKER);
    expect(currentSeed).toContain(END_GENERATED_MARKER);

    const generated = exportSeedContent();

    if (process.env.UPDATE_SEED === '1') {
      const updated = replaceGeneratedContent(currentSeed, generated);
      writeFileSync(SEED_PATH, updated, 'utf8');
      expect(extractGeneratedContent(readFileSync(SEED_PATH, 'utf8'))).toBe(generated);
      return;
    }

    const actual = extractGeneratedContent(currentSeed);
    expect(
      actual,
      'database/seed.sql is out of sync with bundled content. Run `UPDATE_SEED=1 pnpm vitest run apps/web/src/content/export` to regenerate.',
    ).toBe(generated);
  });
});
