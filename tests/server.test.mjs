import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadStore } from '../src/data-store.mjs';
import { createServer } from '../src/server.mjs';

const store = loadStore();

async function connect() {
  const server = createServer(store);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: 'test-client', version: '0.0.1' });
  await client.connect(clientTransport);
  return client;
}

function payloadOf(result) {
  return JSON.parse(result.content[0].text);
}

test('도구 7종이 등록되어 있다', async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(
    tools.map((t) => t.name).sort(),
    [
      'get_prerequisites',
      'get_standard',
      'get_topic',
      'list_clusters',
      'list_curricula',
      'search_standards',
      'search_topics',
    ]
  );
});

test('list_curricula는 11개 교과를 반환한다', async () => {
  const client = await connect();
  const curricula = payloadOf(await client.callTool({ name: 'list_curricula', arguments: {} }));
  assert.equal(curricula.length, 11);
  assert.ok(curricula.every((c) => c.id && c.subjectKorean && c.standardCount > 0));
});

test('search_standards → get_standard 왕복', async () => {
  const client = await connect();
  const search = payloadOf(
    await client.callTool({ name: 'search_standards', arguments: { query: '2수01-01' } })
  );
  assert.equal(search.results[0].code, '[2수01-01]');
  const detail = payloadOf(
    await client.callTool({ name: 'get_standard', arguments: { code: '2수01-01' } })
  );
  assert.equal(detail.code, '[2수01-01]');
  assert.ok(detail.linkedTopics.length >= 1);
});

test('search_topics standardCode 필터 + get_topic 왕복', async () => {
  const client = await connect();
  const search = payloadOf(
    await client.callTool({ name: 'search_topics', arguments: { standardCode: '2수01-01' } })
  );
  assert.ok(search.results.length >= 1);
  const topic = payloadOf(
    await client.callTool({ name: 'get_topic', arguments: { topicId: search.results[0].id } })
  );
  assert.ok(topic.standards.includes('kr-2022-elem-math:[2수01-01]'));
});

test('get_prerequisites 기본은 직접 간선', async () => {
  const client = await connect();
  const payload = payloadOf(
    await client.callTool({
      name: 'get_prerequisites',
      arguments: { topicId: 'kr.mt.art.3-4.4mi0101.make' },
    })
  );
  assert.ok(payload.edges.some((e) => e.relatedTopicId === 'kr.mt.art.3-4.4mi0101.understand'));
});

test('get_prerequisites depth=all은 위상 경로', async () => {
  const client = await connect();
  const payload = payloadOf(
    await client.callTool({
      name: 'get_prerequisites',
      arguments: { topicId: 'kr.mt.art.3-4.4mi0101.make', depth: 'all' },
    })
  );
  const ids = payload.pathOrder.map((p) => p.topicId);
  assert.equal(ids.at(-1), 'kr.mt.art.3-4.4mi0101.make');
  assert.ok(ids.includes('kr.mt.art.3-4.4mi0101.understand'));
});

test('list_clusters 단건 조회', async () => {
  const client = await connect();
  const cluster = payloadOf(
    await client.callTool({
      name: 'list_clusters',
      arguments: { clusterId: 'kr.cluster.art.3-4.unit-1' },
    })
  );
  assert.equal(cluster.topicCount, 12);
});

test('존재하지 않는 주제는 isError와 유사 후보를 반환한다', async () => {
  const client = await connect();
  const result = await client.callTool({
    name: 'get_topic',
    arguments: { topicId: 'kr.mt.art.3-4.4mi0101.mak' },
  });
  assert.equal(result.isError, true);
  assert.ok(result.content[0].text.includes('유사 후보'));
  assert.ok(result.content[0].text.includes('kr.mt.art.3-4.4mi0101.make'));
});

test('검색 0건이면 힌트를 포함한다', async () => {
  const client = await connect();
  const payload = payloadOf(
    await client.callTool({ name: 'search_standards', arguments: { query: 'zzzz없는검색어zzzz' } })
  );
  assert.equal(payload.total, 0);
  assert.ok(payload.hint);
});

test('about 리소스에 라이선스·원문 미수록 고지가 있다', async () => {
  const client = await connect();
  const { contents } = await client.readResource({
    uri: 'about://korean-elementary-learning-map',
  });
  assert.ok(contents[0].text.includes('MIT'));
  assert.ok(contents[0].text.includes('원문'));
  assert.ok(contents[0].text.includes('kr-full-depth-v0.4'));
});
