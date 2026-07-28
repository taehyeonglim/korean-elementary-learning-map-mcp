#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..');
const cacheDir = join(repoRoot, '.cache');
const sourcesPath = join(here, 'sources.json');
const curriculaPath = join(repoRoot, 'data', 'kr', 'curriculum-standards.json');

export function isPdf(buffer) {
  return buffer.subarray(0, 5).toString('latin1').startsWith('%PDF-');
}

export function neededSourceIds(curriculaDoc) {
  const ids = new Set();
  for (const curriculum of curriculaDoc.curricula) {
    for (const standard of curriculum.standards) {
      const ref = standard.evidence?.[0]?.sourceId ?? standard.sourceRefs?.[0];
      if (ref) ids.add(ref);
    }
  }
  return [...ids].sort();
}

export function seedSourceMap(curriculaDoc) {
  const map = {};
  for (const curriculum of curriculaDoc.curricula) {
    const ids = curriculum.sourceIds ?? [];
    const urls = curriculum.sourceUrls ?? [];
    if (ids.length !== urls.length) continue;
    ids.forEach((id, index) => {
      if (urls[index]?.includes('download.do') && !map[id]) map[id] = urls[index];
    });
  }
  return map;
}

export function diffSources(entries, computedHashes) {
  const changed = [];
  const unreachable = [];
  for (const [id, entry] of Object.entries(entries)) {
    const actual = computedHashes.get(id);
    if (!actual) { unreachable.push({ id }); continue; }
    if (entry.sha256 && entry.sha256 !== actual) {
      changed.push({ id, recorded: entry.sha256, actual });
    }
  }
  return { changed, unreachable };
}

async function runCheck() {
  const curriculaDoc = JSON.parse(readFileSync(curriculaPath, 'utf8'));
  const needed = neededSourceIds(curriculaDoc);
  const sources = loadSources();
  const computed = new Map();
  for (const id of needed) {
    const url = sources.entries[id]?.url;
    if (!url) { computed.set(id, null); continue; }
    console.error(`점검: ${id}`);
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!isPdf(buffer)) throw new Error('PDF 아님');
      computed.set(id, createHash('sha256').update(buffer).digest('hex'));
    } catch {
      computed.set(id, null);
    }
  }
  const { changed, unreachable } = diffSources(sources.entries, computed);
  if (!changed.length && !unreachable.length) {
    console.error(`✓ 원본 ${needed.length}종 변경 없음`);
    return;
  }
  if (changed.length) {
    console.error(`⚠ 개정 의심 — 해시 변경 ${changed.length}종:`);
    for (const c of changed) console.error(`  - ${c.id}: 기록 ${c.recorded.slice(0, 12)}… → 현재 ${c.actual.slice(0, 12)}…`);
  }
  if (unreachable.length) {
    console.error(`✗ 다운로드 실패(개정 아님 — URL·네트워크 확인) ${unreachable.length}종:`);
    for (const u of unreachable) console.error(`  - ${u.id}`);
  }
  process.exit(1);
}

function loadSources() {
  if (!existsSync(sourcesPath)) return { entries: {} };
  return JSON.parse(readFileSync(sourcesPath, 'utf8'));
}

function saveSources(sources) {
  writeFileSync(sourcesPath, `${JSON.stringify(sources, null, 2)}\n`);
}

async function main() {
  if (process.argv.includes('--check')) {
    await runCheck();
    return;
  }
  const curriculaDoc = JSON.parse(readFileSync(curriculaPath, 'utf8'));
  const needed = neededSourceIds(curriculaDoc);
  const sources = loadSources();
  const seed = seedSourceMap(curriculaDoc);
  for (const id of needed) {
    sources.entries[id] ??= { url: seed[id] ?? null, sha256: null, bytes: null, downloadedAt: null };
    sources.entries[id].url ??= seed[id] ?? null;
  }
  saveSources(sources);

  if (process.argv.includes('--seed')) {
    const unresolved = needed.filter((id) => !sources.entries[id].url);
    console.error(`✓ sources.json 시드 완료 — 소스 ${needed.length}종 중 URL 미확정 ${unresolved.length}종`);
    for (const id of unresolved) {
      console.error(`  ! ${id}: pipeline/sources.json의 url을 직접 채우거나, PDF를 .cache/${id}.pdf 로 수동 저장`);
    }
    return;
  }

  mkdirSync(cacheDir, { recursive: true });
  const failures = [];
  for (const id of needed) {
    const dest = join(cacheDir, `${id}.pdf`);
    const entry = sources.entries[id];
    if (!existsSync(dest)) {
      if (!entry.url) { failures.push(`${id}: URL 미확정 (수동 저장 필요: .cache/${id}.pdf)`); continue; }
      console.error(`다운로드: ${id}`);
      try {
        const response = await fetch(entry.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!isPdf(buffer)) throw new Error('응답이 PDF가 아님 (세션/오류 페이지 가능성)');
        writeFileSync(dest, buffer);
        entry.downloadedAt = new Date().toISOString();
      } catch (error) {
        failures.push(`${id}: ${error.message} — 브라우저로 받아 .cache/${id}.pdf 에 저장하면 됨`);
        continue;
      }
    }
    const buffer = readFileSync(dest);
    if (!isPdf(buffer)) { failures.push(`${id}: .cache 파일이 PDF가 아님`); continue; }
    const sha256 = createHash('sha256').update(buffer).digest('hex');
    if (entry.sha256 && entry.sha256 !== sha256) {
      console.error(`경고: ${id} 해시가 기록과 다름 (원본 문서 변경 가능성) — 기록 갱신`);
    }
    entry.sha256 = sha256;
    entry.bytes = buffer.byteLength;
  }
  saveSources(sources);
  if (failures.length) {
    console.error(`✗ ${failures.length}종 미확보:`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.error(`✓ PDF ${needed.length}종 확보·해시 기록 완료`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
