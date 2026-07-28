#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CODE_PATTERN } from './extract-texts.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const dataDir = join(repoRoot, 'data', 'kr');

export function verifyTexts(textsDoc, curriculaDoc) {
  const errors = [];
  const validCodes = new Set();
  for (const curriculum of curriculaDoc.curricula) {
    for (const standard of curriculum.standards) validCodes.add(standard.code);
  }

  const seen = new Set();
  for (const entry of textsDoc.texts ?? []) {
    if (!validCodes.has(entry.code)) errors.push(`미지 코드: ${entry.code}`);
    if (seen.has(entry.code)) errors.push(`중복 코드: ${entry.code}`);
    seen.add(entry.code);
    if (!entry.text || !entry.text.trim()) errors.push(`빈 원문: ${entry.code}`);
    else if ([...entry.text.matchAll(CODE_PATTERN)].length > 0) {
      errors.push(`절취 오류(원문에 다른 코드 포함): ${entry.code}`);
    }
  }
  for (const code of validCodes) {
    if (!seen.has(code)) errors.push(`원문 누락: ${code}`);
  }
  return { ok: errors.length === 0, errors };
}

function main() {
  const textsRaw = readFileSync(join(dataDir, 'standard-texts.json'));
  const textsDoc = JSON.parse(textsRaw.toString('utf8'));
  const curriculaDoc = JSON.parse(readFileSync(join(dataDir, 'curriculum-standards.json'), 'utf8'));

  const { ok, errors } = verifyTexts(textsDoc, curriculaDoc);
  if (!ok) {
    console.error(`✗ 원문 검증 실패 ${errors.length}건:`);
    for (const error of errors.slice(0, 40)) console.error(`  - ${error}`);
    if (errors.length > 40) console.error(`  … 외 ${errors.length - 40}건`);
    process.exit(1);
  }

  const manifestPath = join(dataDir, 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.files['standard-texts.json'] = {
    bytes: textsRaw.byteLength,
    sha256: createHash('sha256').update(textsRaw).digest('hex'),
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.error(`✓ 원문 ${textsDoc.texts.length}건 전수 검증 통과 — manifest에 해시 기록`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
