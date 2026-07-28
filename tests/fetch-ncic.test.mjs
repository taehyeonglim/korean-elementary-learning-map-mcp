import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { diffSources, isPdf, neededSourceIds, seedSourceMap } from '../pipeline/fetch-ncic.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const curriculaDoc = JSON.parse(
  readFileSync(join(here, '..', 'data', 'kr', 'curriculum-standards.json'), 'utf8')
);

test('isPdf는 %PDF- 매직 바이트로 판별한다', () => {
  assert.equal(isPdf(Buffer.from('%PDF-1.7 something')), true);
  assert.equal(isPdf(Buffer.from('<html>error page</html>')), false);
});

test('실데이터에서 필요한 원문 소스는 정확히 12종이다', () => {
  const ids = neededSourceIds(curriculaDoc);
  assert.equal(ids.length, 12);
  assert.ok(ids.includes('kr-ncic-math-pdf-2022'));
  assert.ok(ids.includes('kr-moe-2022-33-annex5-pdf'));
});

test('seedSourceMap은 배열 길이가 다른 교과를 건너뛰고 download.do URL만 채운다', () => {
  const map = seedSourceMap(curriculaDoc);
  assert.ok(map['kr-ncic-math-pdf-2022']?.includes('download.do'));
  for (const url of Object.values(map)) assert.ok(url.includes('download.do'));
});

test('diffSources는 해시 변경과 다운로드 실패를 구분한다', () => {
  const entries = { a: { sha256: 'x1' }, b: { sha256: 'x2' }, c: { sha256: 'x3' } };
  const computed = new Map([['a', 'x1'], ['b', 'CHANGED'], ['c', null]]);
  const { changed, unreachable } = diffSources(entries, computed);
  assert.deepEqual(changed, [{ id: 'b', recorded: 'x2', actual: 'CHANGED' }]);
  assert.deepEqual(unreachable.map((u) => u.id), ['c']);
});

test('diffSources는 전부 일치하면 빈 결과를 반환한다', () => {
  const entries = { a: { sha256: 'x1' } };
  const { changed, unreachable } = diffSources(entries, new Map([['a', 'x1']]));
  assert.deepEqual(changed, []);
  assert.deepEqual(unreachable, []);
});
