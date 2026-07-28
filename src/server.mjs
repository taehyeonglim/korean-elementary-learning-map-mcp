import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { normalizeCode } from './data-store.mjs';
import {
  normalizeText,
  searchStandards,
  searchStandardTexts,
  searchTopics,
  suggestSimilar,
} from './search.mjs';
import { directEdges, learningPath } from './graph.mjs';
import { buildRoadmap } from './roadmap.mjs';

const SERVER_INFO = { name: 'korean-elementary-learning-map', version: '0.5.0' };

function emptyHint(store) {
  const subjects = store.curricula.map((c) => c.subjectKorean).join(', ');
  return `검색 결과가 없습니다. 사용 가능한 subject: ${subjects} / gradeBand: 1-2, 3-4, 5-6. query를 더 짧은 핵심어로 바꿔 보세요.`;
}

function ok(payload) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 1) }] };
}

function fail(message, suggestions = []) {
  const text = suggestions.length ? `${message} 유사 후보: ${suggestions.join(', ')}` : message;
  return { content: [{ type: 'text', text }], isError: true };
}

function aboutText(store) {
  const { taxonomyVersion, counts } = store.manifest;
  return [
    '# 한국 초등 학습지도 MCP 서버',
    '',
    `- 데이터 릴리스: ${taxonomyVersion}`,
    `- 수량: 교육과정 ${counts.curricula} · 성취기준 ${counts.standards} · 주제 ${counts.topics} · 선수관계 ${counts.dependencies} · 클러스터 ${counts.clusters}`,
    '- 라이선스: MIT (저장소 작성 산출물 기준). 인용된 공식 교육과정 문서는 국가 공표 공공 자료이다.',
    '- 성취기준 공식 원문을 수록한다. 원문은 교육부 공표 공공저작물(저작권법 제24조의2)로서 출처(NCIC 공개 PDF)를 표기해 이용한다.',
    '- 교육부·국가교육위원회·NCIC의 공식 산출물이 아니며, 개별 학습자를 진단하지 않는다.',
    '- 선수 관계는 이 릴리스 모델의 추천 구조이며 보편적 학습 순서 주장이 아니다.',
    '- 출처·방법론: https://github.com/DECK6/korean-elementary-learning-map',
  ].join('\n');
}

export function createServer(store) {
  const server = new McpServer(SERVER_INFO);

  server.registerResource(
    'about',
    'about://korean-elementary-learning-map',
    {
      title: '데이터 출처·라이선스 안내',
      description: '데이터 릴리스, 수량, 라이선스, 원문 미수록 고지',
      mimeType: 'text/markdown',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'text/markdown', text: aboutText(store) }],
    })
  );

  server.registerTool(
    'list_curricula',
    {
      title: '교과 목록',
      description: '11개 초등 교과의 ID, 이름, 성취기준 수, 학년군, 영역 목록을 반환한다.',
      inputSchema: {},
    },
    async () =>
      ok(
        store.curricula.map((curriculum) => ({
          id: curriculum.id,
          subjectKorean: curriculum.subjectKorean,
          subject: curriculum.subject,
          standardCount: curriculum.standardCount,
          gradeBands: [...new Set(curriculum.standards.map((s) => s.gradeBand))].sort(),
          domains: [...new Set(curriculum.standards.map((s) => s.domainKorean))],
        }))
      )
  );

  server.registerTool(
    'search_standards',
    {
      title: '성취기준 검색',
      description:
        '성취기준을 코드·키워드·필터로 검색해 요약 목록을 반환한다. 상세는 get_standard로 조회한다.',
      inputSchema: {
        query: z.string().max(200).optional().describe('키워드 또는 성취기준 코드 (예: 분수, 2수01-01)'),
        subject: z.string().max(200).optional().describe('교과명 (예: 수학 또는 Mathematics)'),
        gradeBand: z.string().max(200).optional().describe('학년군: 1-2, 3-4, 5-6'),
        domain: z.string().max(200).optional().describe('영역명 (예: 수와 연산)'),
        limit: z.number().int().min(1).max(50).optional().describe('최대 결과 수 (기본 20)'),
      },
    },
    async (args) => {
      const result = searchStandards(store, args);
      if (result.total === 0) result.hint = emptyHint(store);
      return ok(result);
    }
  );

  server.registerTool(
    'get_standard',
    {
      title: '성취기준 상세',
      description:
        '성취기준 코드([2수01-01] 또는 2수01-01)로 전체 레코드와 연결된 주제 목록을 조회한다.',
      inputSchema: { code: z.string().max(200).describe('성취기준 코드') },
    },
    async ({ code }) => {
      const normalized = normalizeCode(code);
      const standard = store.standardsByCode.get(normalized);
      if (!standard) {
        return fail(
          `성취기준 ${normalized}을(를) 찾을 수 없습니다.`,
          suggestSimilar(normalized, [...store.standardsByCode.keys()])
        );
      }
      const linkedTopics = (store.topicsByStandardKey.get(standard.key) ?? []).map((topic) => ({
        id: topic.id,
        titleKorean: topic.titleKorean,
      }));
      return ok({ ...standard, officialText: store.textsByCode.get(standard.code) ?? null, linkedTopics });
    }
  );

  server.registerTool(
    'search_topics',
    {
      title: '학습 주제 검색',
      description:
        '세부 학습 주제를 키워드·필터로 검색해 요약 목록을 반환한다. 상세는 get_topic으로 조회한다.',
      inputSchema: {
        query: z.string().max(200).optional().describe('키워드'),
        subject: z.string().max(200).optional().describe('교과명'),
        gradeBand: z.string().max(200).optional().describe('학년군: 1-2, 3-4, 5-6'),
        type: z.string().max(200).optional().describe('주제 유형 (예: CONCEPTUAL, PROCEDURAL)'),
        standardCode: z.string().max(200).optional().describe('이 성취기준에 연결된 주제만'),
        limit: z.number().int().min(1).max(50).optional().describe('최대 결과 수 (기본 20)'),
      },
    },
    async (args) => {
      const result = searchTopics(store, args);
      if (result.total === 0) result.hint = emptyHint(store);
      return ok(result);
    }
  );

  server.registerTool(
    'search_standard_text',
    {
      title: '성취기준 원문 검색',
      description:
        '성취기준 공식 원문 전문에서 키워드를 검색해 코드와 매칭 스니펫을 반환한다. 상세 원문은 get_standard의 officialText로 조회한다.',
      inputSchema: {
        query: z.string().min(1).max(200).describe('원문에서 찾을 키워드'),
        subject: z.string().max(200).optional().describe('교과명 필터'),
        gradeBand: z.string().max(200).optional().describe('학년군: 1-2, 3-4, 5-6'),
        limit: z.number().int().min(1).max(50).optional().describe('최대 결과 수 (기본 20)'),
      },
    },
    async (args) => {
      const result = searchStandardTexts(store, args);
      if (result.total === 0) result.hint = emptyHint(store);
      return ok(result);
    }
  );

  server.registerTool(
    'get_topic',
    {
      title: '학습 주제 상세',
      description: '주제 ID로 관찰 증거·평가 문항·출처를 포함한 전체 레코드를 조회한다.',
      inputSchema: { topicId: z.string().max(200).describe('주제 ID (예: kr.mt.math.…)') },
    },
    async ({ topicId }) => {
      const topic = store.topicsById.get(topicId);
      if (!topic) {
        return fail(
          `주제 ${topicId}을(를) 찾을 수 없습니다.`,
          suggestSimilar(topicId, [...store.topicsById.keys()])
        );
      }
      return ok(topic);
    }
  );

  server.registerTool(
    'get_prerequisites',
    {
      title: '선수관계 조회',
      description:
        '주제의 선수(prerequisites) 또는 후속(unlocks) 관계를 조회한다. depth=all이면 전이적 학습 경로를 위상 순서로 반환한다.',
      inputSchema: {
        topicId: z.string().max(200).describe('주제 ID'),
        direction: z.enum(['prerequisites', 'unlocks']).optional().describe('기본 prerequisites'),
        depth: z.union([z.literal(1), z.literal('all')]).optional().describe('1(직접) 또는 all(전이)'),
        strength: z.enum(['hard', 'soft']).optional().describe('관계 강도 필터'),
      },
    },
    async ({ topicId, direction = 'prerequisites', depth = 1, strength }) => {
      if (!store.topicsById.has(topicId)) {
        return fail(
          `주제 ${topicId}을(를) 찾을 수 없습니다.`,
          suggestSimilar(topicId, [...store.topicsById.keys()])
        );
      }
      if (depth === 'all') {
        return ok({
          topicId,
          direction,
          pathOrder: learningPath(store, topicId, { direction, strength }),
        });
      }
      return ok({ topicId, direction, edges: directEdges(store, topicId, { direction, strength }) });
    }
  );

  server.registerTool(
    'list_clusters',
    {
      title: '클러스터 조회',
      description:
        '학습 클러스터 목록을 조회한다. clusterId를 주면 단건 전체 레코드, 없으면 요약 목록을 반환한다.',
      inputSchema: {
        clusterId: z.string().max(200).optional().describe('클러스터 ID (단건 상세)'),
        subject: z.string().max(200).optional().describe('교과명 필터'),
        gradeBand: z.string().max(200).optional().describe('학년군 필터'),
      },
    },
    async ({ clusterId, subject, gradeBand }) => {
      if (clusterId) {
        const cluster = store.clustersById.get(clusterId);
        if (!cluster) {
          return fail(
            `클러스터 ${clusterId}을(를) 찾을 수 없습니다.`,
            suggestSimilar(clusterId, [...store.clustersById.keys()])
          );
        }
        return ok(cluster);
      }
      let candidates = store.clusters;
      if (subject) {
        const target = normalizeText(subject);
        candidates = candidates.filter(
          (c) => normalizeText(c.subject) === target || normalizeText(c.subjectKorean) === target
        );
      }
      if (gradeBand) candidates = candidates.filter((c) => c.gradeBand === gradeBand);
      return ok({
        total: candidates.length,
        results: candidates.map((c) => ({
          id: c.id,
          titleKorean: c.titleKorean,
          subjectKorean: c.subjectKorean,
          gradeBand: c.gradeBand,
          topicCount: c.topicCount,
        })),
      });
    }
  );

  server.registerTool(
    'get_learning_roadmap',
    {
      title: '학습 로드맵 요약',
      description:
        '교과·학년군의 성취기준을 영역→모듈 계층으로 집계한 학습 로드맵을 반환한다. 기존 데이터의 집계이며 새로운 순서를 생성하지 않는다.',
      inputSchema: {
        subject: z.string().max(200).describe('교과명 (예: 수학)'),
        gradeBand: z.string().max(200).describe('학년군: 1-2, 3-4, 5-6'),
        domain: z.string().max(200).optional().describe('영역명 필터 (예: 수와 연산)'),
      },
    },
    async ({ subject, gradeBand, domain }) => {
      const roadmap = buildRoadmap(store, { subject, gradeBand, domain });
      if (roadmap.error === 'unknown-subject') {
        return fail(
          `교과 ${subject}을(를) 찾을 수 없습니다. 사용 가능한 교과: ${roadmap.validSubjects.join(', ')}`
        );
      }
      if (roadmap.standardCount === 0) {
        roadmap.hint = '해당 학년군·영역 조합에 성취기준이 없습니다. gradeBand는 1-2/3-4/5-6 형식입니다.';
      }
      return ok(roadmap);
    }
  );

  return server;
}
