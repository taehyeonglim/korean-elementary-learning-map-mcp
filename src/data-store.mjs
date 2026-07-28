import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultDataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data', 'kr');

export const CORE_FILES = [
  'curriculum-standards.json',
  'topics.json',
  'dependencies.json',
  'clusters.json',
];

export function normalizeCode(code) {
  const compact = String(code ?? '').replace(/\s+/g, '');
  if (!compact) return compact;
  return compact.startsWith('[') ? compact : `[${compact}]`;
}

function readVerified(dataDir, manifest, file) {
  const expected = manifest.files[file];
  if (!expected) {
    throw new Error(`manifest.json에 ${file} 항목이 없습니다.`);
  }
  const raw = readFileSync(join(dataDir, file));
  const sha256 = createHash('sha256').update(raw).digest('hex');
  if (sha256 !== expected.sha256) {
    throw new Error(
      `${file} 체크섬 불일치 — 설치본이 손상되었습니다. 패키지를 재설치하세요. (manifest=${expected.sha256}, 실제=${sha256})`
    );
  }
  return JSON.parse(raw.toString('utf8'));
}

export function loadStore(dataDir = defaultDataDir) {
  const manifest = JSON.parse(readFileSync(join(dataDir, 'manifest.json'), 'utf8'));
  const { curricula } = readVerified(dataDir, manifest, 'curriculum-standards.json');
  const { topics } = readVerified(dataDir, manifest, 'topics.json');
  const { dependencies } = readVerified(dataDir, manifest, 'dependencies.json');
  const { clusters } = readVerified(dataDir, manifest, 'clusters.json');

  const allStandards = [];
  const standardsByCode = new Map();
  const standardsByKey = new Map();
  for (const curriculum of curricula) {
    for (const standard of curriculum.standards) {
      const record = { ...standard, curriculumId: curriculum.id };
      allStandards.push(record);
      standardsByCode.set(standard.code, record);
      standardsByKey.set(standard.key, record);
    }
  }

  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const clustersById = new Map(clusters.map((cluster) => [cluster.id, cluster]));

  const topicsByStandardKey = new Map();
  for (const topic of topics) {
    for (const key of topic.standards ?? []) {
      if (!topicsByStandardKey.has(key)) topicsByStandardKey.set(key, []);
      topicsByStandardKey.get(key).push(topic);
    }
  }

  const prerequisitesByTopic = new Map();
  const unlocksByTopic = new Map();
  for (const edge of dependencies) {
    if (!prerequisitesByTopic.has(edge.topicId)) prerequisitesByTopic.set(edge.topicId, []);
    prerequisitesByTopic.get(edge.topicId).push(edge);
    if (!unlocksByTopic.has(edge.prerequisiteId)) unlocksByTopic.set(edge.prerequisiteId, []);
    unlocksByTopic.get(edge.prerequisiteId).push(edge);
  }

  return {
    manifest,
    curricula,
    topics,
    dependencies,
    clusters,
    allStandards,
    standardsByCode,
    standardsByKey,
    topicsById,
    clustersById,
    topicsByStandardKey,
    prerequisitesByTopic,
    unlocksByTopic,
  };
}
