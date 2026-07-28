import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadStore } from '../src/data-store.mjs';
import { directEdges, learningPath } from '../src/graph.mjs';

const store = loadStore();
const MAKE = 'kr.mt.art.3-4.4mi0101.make';
const UNDERSTAND = 'kr.mt.art.3-4.4mi0101.understand';

test('직접 선수 간선을 제목과 함께 반환한다', () => {
  const edges = directEdges(store, MAKE);
  const hit = edges.find((e) => e.relatedTopicId === UNDERSTAND);
  assert.ok(hit);
  assert.equal(typeof hit.relatedTopicTitle, 'string');
  assert.ok(['hard', 'soft'].includes(hit.strength));
  assert.equal(typeof hit.reason, 'string');
});

test('unlocks 방향은 역관계를 반환한다', () => {
  const edges = directEdges(store, UNDERSTAND, { direction: 'unlocks' });
  assert.ok(edges.some((e) => e.relatedTopicId === MAKE));
});

test('strength 필터가 적용된다', () => {
  const all = directEdges(store, MAKE);
  const hard = directEdges(store, MAKE, { strength: 'hard' });
  assert.ok(hard.length <= all.length);
  for (const e of hard) assert.equal(e.strength, 'hard');
});

test('간선이 없는 주제는 빈 배열', () => {
  const noIncoming = store.topics.find((t) => !store.prerequisitesByTopic.has(t.id));
  assert.ok(noIncoming, '선수가 없는 주제가 최소 1개 존재해야 한다');
  assert.deepEqual(directEdges(store, noIncoming.id), []);
});

test('learningPath는 대상이 마지막이고 위상 순서를 지킨다', () => {
  const path = learningPath(store, MAKE);
  const ids = path.map((entry) => entry.topicId);
  assert.equal(ids.at(-1), MAKE);
  assert.ok(ids.includes(UNDERSTAND));
  const position = new Map(ids.map((id, index) => [id, index]));
  for (const entry of path) {
    for (const edge of entry.directEdges) {
      assert.ok(
        position.get(edge.relatedTopicId) < position.get(entry.topicId),
        `${edge.relatedTopicId}가 ${entry.topicId}보다 먼저 나와야 한다`
      );
    }
  }
});

test('learningPath unlocks 방향은 대상이 첫 번째', () => {
  const path = learningPath(store, UNDERSTAND, { direction: 'unlocks' });
  assert.equal(path[0].topicId, UNDERSTAND);
  assert.ok(path.map((p) => p.topicId).includes(MAKE));
});
