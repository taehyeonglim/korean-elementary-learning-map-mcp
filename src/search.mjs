import { normalizeCode } from './data-store.mjs';

const MAX_LIMIT = 50;

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const substitution = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(prev[j] + 1, current[j - 1] + 1, substitution);
    }
    prev = current;
  }
  return prev[b.length];
}

export function suggestSimilar(input, candidates, max = 3) {
  const norm = normalizeText(input);
  const threshold = Math.max(3, Math.ceil(norm.length / 3));
  const scored = candidates.map((candidate) => {
    const c = normalizeText(candidate);
    if (c.includes(norm) || norm.includes(c)) return { candidate, distance: 0 };
    return { candidate, distance: levenshtein(norm, c) };
  });
  scored.sort((a, b) => a.distance - b.distance);
  return scored
    .filter((entry) => entry.distance <= threshold)
    .slice(0, max)
    .map((entry) => entry.candidate);
}

export function compactStandard(standard) {
  return {
    key: standard.key,
    code: standard.code,
    subjectKorean: standard.subjectKorean,
    gradeBand: standard.gradeBand,
    domainKorean: standard.domainKorean,
    module: standard.module,
    focus: standard.focus,
  };
}

export function compactTopic(topic) {
  return {
    id: topic.id,
    titleKorean: topic.titleKorean,
    subjectKorean: topic.subjectKorean,
    gradeBand: topic.gradeBand,
    domainKorean: topic.domainKorean,
    type: topic.type,
    module: topic.module,
  };
}

function matchesFilter(filterValue, ...recordValues) {
  const target = normalizeText(filterValue);
  return recordValues.some((value) => normalizeText(value) === target);
}

function scoreByFields(normQuery, weightedFields) {
  let score = 0;
  for (const [value, weight] of weightedFields) {
    if (value && normalizeText(value).includes(normQuery)) score += weight;
  }
  return score;
}

function rankByQuery(candidates, query, weightedFieldsOf, tieBreak) {
  const normQuery = normalizeText(query);
  return candidates
    .map((record) => ({ record, score: weightedFieldsOf(record, normQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || tieBreak(a.record, b.record))
    .map((entry) => entry.record);
}

export function searchStandards(store, { query, subject, gradeBand, domain, limit = 20 } = {}) {
  const cap = Math.min(limit, MAX_LIMIT);
  let candidates = store.allStandards;
  if (subject) candidates = candidates.filter((s) => matchesFilter(subject, s.subject, s.subjectKorean));
  if (gradeBand) candidates = candidates.filter((s) => s.gradeBand === gradeBand);
  if (domain) candidates = candidates.filter((s) => matchesFilter(domain, s.domain, s.domainKorean));
  if (query) {
    const codeQuery = normalizeText(normalizeCode(query));
    candidates = rankByQuery(
      candidates,
      query,
      (s, normQuery) => {
        let score = scoreByFields(normQuery, [
          [s.module, 10],
          [s.domainKorean, 8],
          [s.focus, 5],
          [s.summary, 3],
        ]);
        if (normalizeText(s.code) === codeQuery) score += 100;
        else if (normalizeText(s.code).includes(normQuery)) score += 50;
        return score;
      },
      (a, b) => (a.sequence ?? 0) - (b.sequence ?? 0) || a.code.localeCompare(b.code)
    );
  }
  return { total: candidates.length, results: candidates.slice(0, cap).map(compactStandard) };
}

export function searchTopics(store, { query, subject, gradeBand, type, standardCode, limit = 20 } = {}) {
  const cap = Math.min(limit, MAX_LIMIT);
  let candidates = store.topics;
  if (subject) candidates = candidates.filter((t) => matchesFilter(subject, t.subject, t.subjectKorean));
  if (gradeBand) candidates = candidates.filter((t) => t.gradeBand === gradeBand);
  if (type) candidates = candidates.filter((t) => normalizeText(t.type) === normalizeText(type));
  if (standardCode) {
    const standard = store.standardsByCode.get(normalizeCode(standardCode));
    const linked = standard ? store.topicsByStandardKey.get(standard.key) ?? [] : [];
    const linkedIds = new Set(linked.map((t) => t.id));
    candidates = candidates.filter((t) => linkedIds.has(t.id));
  }
  if (query) {
    candidates = rankByQuery(
      candidates,
      query,
      (t, normQuery) =>
        scoreByFields(normQuery, [
          [t.titleKorean, 10],
          [t.module, 8],
          [t.domainKorean, 5],
          [t.description, 3],
        ]),
      (a, b) => a.id.localeCompare(b.id)
    );
  }
  return { total: candidates.length, results: candidates.slice(0, cap).map(compactTopic) };
}
