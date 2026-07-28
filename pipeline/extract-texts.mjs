#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const cacheDir = join(repoRoot, '.cache');
const curriculaPath = join(repoRoot, 'data', 'kr', 'curriculum-standards.json');
const exceptionsPath = join(here, 'exceptions.json');
const outputPath = join(repoRoot, 'data', 'kr', 'standard-texts.json');

export const CODE_PATTERN = /\[\d[가-힣]{1,2}\d{2}-\d{2}\]/g;

const SECTION_CUT_PATTERNS = [
  /\(\s*[가나다라]\s*\)/,
  /성취기준\s*해설/,
  /적용\s*시\s*고려/,
];

export function normalizeWhitespace(value) {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim();
}

export function sliceStandardText(fullText, startIdx, endIdx) {
  let chunk = fullText.slice(startIdx, endIdx);
  for (const pattern of SECTION_CUT_PATTERNS) {
    const cut = chunk.search(pattern);
    if (cut !== -1) chunk = chunk.slice(0, cut);
  }
  return normalizeWhitespace(chunk);
}

export function extractTexts(pdfText, expectedCodes) {
  const positions = [...pdfText.matchAll(CODE_PATTERN)].map((m) => ({
    code: m[0],
    start: m.index,
    end: m.index + m[0].length,
  }));
  const texts = new Map();
  const failures = [];
  for (const code of expectedCodes) {
    const first = positions.find((p) => p.code === code);
    if (!first) { failures.push({ code, reason: 'code-not-found' }); continue; }
    const next = positions.find((p) => p.start > first.end);
    const endIdx = next ? next.start : Math.min(pdfText.length, first.end + 1200);
    const text = sliceStandardText(pdfText, first.end, endIdx);
    if (!text) { failures.push({ code, reason: 'empty-after-slice' }); continue; }
    if (text.length > 700) { failures.push({ code, reason: 'suspiciously-long', preview: text.slice(0, 80) }); continue; }
    texts.set(code, text);
  }
  return { texts, failures };
}

function main() {
  const curriculaDoc = JSON.parse(readFileSync(curriculaPath, 'utf8'));
  const exceptions = JSON.parse(readFileSync(exceptionsPath, 'utf8'));

  const bySource = new Map();
  for (const curriculum of curriculaDoc.curricula) {
    for (const standard of curriculum.standards) {
      const ref = standard.evidence?.[0]?.sourceId ?? standard.sourceRefs?.[0];
      if (!bySource.has(ref)) bySource.set(ref, []);
      bySource.get(ref).push(standard);
    }
  }

  const collected = [];
  const allFailures = [];
  for (const [sourceId, standards] of bySource) {
    const pdfPath = join(cacheDir, `${sourceId}.pdf`);
    if (!existsSync(pdfPath)) {
      allFailures.push(...standards.map((s) => ({ code: s.code, reason: `pdf-missing:${sourceId}` })));
      continue;
    }
    const pdfText = execFileSync('pdftotext', ['-layout', pdfPath, '-'], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    }).normalize('NFC');
    const { texts, failures } = extractTexts(pdfText, standards.map((s) => s.code));
    for (const standard of standards) {
      const override = exceptions[standard.code];
      const text = override ?? texts.get(standard.code);
      if (!text) continue;
      collected.push({
        code: standard.code,
        text: normalizeWhitespace(text),
        sourceId,
        locator: override ? 'manual-exception' : (standard.evidence?.[0]?.locator ?? 'pattern-match'),
      });
    }
    allFailures.push(...failures.filter((f) => !exceptions[f.code]));
  }

  collected.sort((a, b) => a.code.localeCompare(b.code, 'en'));
  writeFileSync(outputPath, `${JSON.stringify({
    version: 'kr-standard-texts-v1',
    generatedAt: new Date().toISOString(),
    sourceNote: '교육부 공표 공공저작물(NCIC 공개 PDF)에서 추출한 성취기준 본문. 출처는 항목별 sourceId 참조.',
    texts: collected,
  }, null, 1)}\n`);

  console.error(`✓ 원문 ${collected.length}건 기록 (${outputPath})`);
  if (allFailures.length) {
    console.error(`✗ 미해결 ${allFailures.length}건 — pipeline/exceptions.json에 코드별 원문을 수동 기입 후 재실행:`);
    for (const f of allFailures) console.error(`  - ${f.code} [${f.reason}]${f.preview ? ` ${f.preview}…` : ''}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
