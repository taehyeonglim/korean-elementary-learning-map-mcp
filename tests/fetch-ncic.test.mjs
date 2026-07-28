import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isPdf, neededSourceIds, seedSourceMap } from '../pipeline/fetch-ncic.mjs';

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
