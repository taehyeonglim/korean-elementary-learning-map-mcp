import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStore } from '../src/data-store.mjs';
import { buildRoadmap } from '../src/roadmap.mjs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.mjs';

const store = loadStore();

test('수학 1-2 로드맵: 영역이 domainOrder 순이고 성취기준·주제 수가 채워진다', () => {
  const roadmap = buildRoadmap(store, { subject: '수학', gradeBand: '1-2' });
  assert.equal(roadmap.subjectKorean, '수학');
  assert.ok(roadmap.standardCount >= 1);
  assert.equal(roadmap.domains[0].domainKorean, '수와 연산');
  const firstModule = roadmap.domains[0].modules[0];
  assert.ok(firstModule.standards.length >= 1);
  assert.ok(firstModule.standards[0].topicCount >= 1);
});

test('sequence·module 없는 교과(체육 등)도 빈 그룹 없이 동작한다', () => {
  const roadmap = buildRoadmap(store, { subject: '체육', gradeBand: '3-4' });
  assert.ok(roadmap.standardCount >= 1);
  for (const domain of roadmap.domains) {
    assert.ok(domain.modules.length + domain.standardsWithoutModule.length >= 1);
  }
});

test('존재하지 않는 교과는 validSubjects와 함께 실패한다', () => {
  const result = buildRoadmap(store, { subject: '없는교과', gradeBand: '1-2' });
  assert.equal(result.error, 'unknown-subject');
  assert.ok(result.validSubjects.includes('수학'));
});

test('get_learning_roadmap 도구가 등록되어 동작하고 도구는 총 9종이다', async () => {
  const server = createServer(store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(clientTransport);

  const { tools } = await client.listTools();
  assert.equal(tools.length, 9);

  const payload = JSON.parse(
    (await client.callTool({
      name: 'get_learning_roadmap',
      arguments: { subject: '수학', gradeBand: '1-2' },
    })).content[0].text
  );
  assert.equal(payload.domains[0].domainKorean, '수와 연산');
});
