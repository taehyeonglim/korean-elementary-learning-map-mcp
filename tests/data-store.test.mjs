import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadStore, normalizeCode } from '../src/data-store.mjs';

const store = loadStore();

test('인덱스 수량이 manifest counts와 일치한다', () => {
  const { counts } = store.manifest;
  assert.equal(store.curricula.length, counts.curricula);
  assert.equal(store.allStandards.length, counts.standards);
  assert.equal(store.topics.length, counts.topics);
  assert.equal(store.dependencies.length, counts.dependencies);
  assert.equal(store.clusters.length, counts.clusters);
});

test('코드·ID 인덱스가 알려진 레코드를 찾는다', () => {
  assert.ok(store.standardsByCode.get('[2수01-01]'));
  assert.ok(store.standardsByKey.get('kr-2022-elem-math:[2수01-01]'));
  assert.ok(store.topicsById.get('kr.mt.art.3-4.4mi0101.make'));
  assert.ok(store.clustersById.get('kr.cluster.art.3-4.unit-1'));
});

test('성취기준→주제 역인덱스가 채워져 있다', () => {
  const linked = store.topicsByStandardKey.get('kr-2022-elem-math:[2수01-01]');
  assert.ok(Array.isArray(linked));
  assert.ok(linked.length >= 1);
});

test('선수관계 인접 리스트가 양방향으로 구축된다', () => {
  const forward = store.prerequisitesByTopic.get('kr.mt.art.3-4.4mi0101.make');
  assert.ok(forward.some((e) => e.prerequisiteId === 'kr.mt.art.3-4.4mi0101.understand'));
  const backward = store.unlocksByTopic.get('kr.mt.art.3-4.4mi0101.understand');
  assert.ok(backward.some((e) => e.topicId === 'kr.mt.art.3-4.4mi0101.make'));
});

test('normalizeCode는 대괄호·공백을 보정한다', () => {
  assert.equal(normalizeCode('2수01-01'), '[2수01-01]');
  assert.equal(normalizeCode('[2수01-01]'), '[2수01-01]');
  assert.equal(normalizeCode(' 2수01-01 '), '[2수01-01]');
});

test('체크섬이 깨진 데이터 디렉터리는 loadStore가 거부한다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kr-mcp-store-'));
  const bodies = {
    'curriculum-standards.json': JSON.stringify({ curricula: [] }),
    'topics.json': JSON.stringify({ topics: [] }),
    'dependencies.json': JSON.stringify({ dependencies: [] }),
    'clusters.json': JSON.stringify({ clusters: [] }),
    'standard-texts.json': JSON.stringify({ texts: [] }),
  };
  const files = {};
  for (const [name, body] of Object.entries(bodies)) {
    writeFileSync(join(dir, name), body);
    files[name] = {
      bytes: Buffer.byteLength(body),
      sha256: createHash('sha256').update(body).digest('hex'),
    };
  }
  files['topics.json'].sha256 = '0'.repeat(64);
  writeFileSync(
    join(dir, 'manifest.json'),
    JSON.stringify({ counts: { curricula: 0, standards: 0, topics: 0, dependencies: 0, clusters: 0 }, files })
  );
  assert.throws(() => loadStore(dir), /체크섬 불일치/);
});
