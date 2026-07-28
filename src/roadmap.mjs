import { normalizeText } from './search.mjs';

export function buildRoadmap(store, { subject, gradeBand, domain } = {}) {
  const target = normalizeText(subject);
  const curriculum = store.curricula.find(
    (c) => normalizeText(c.subject) === target || normalizeText(c.subjectKorean) === target
  );
  if (!curriculum) {
    return { error: 'unknown-subject', validSubjects: store.curricula.map((c) => c.subjectKorean) };
  }

  let standards = curriculum.standards.filter((s) => s.gradeBand === gradeBand);
  if (domain) {
    const domainTarget = normalizeText(domain);
    standards = standards.filter(
      (s) => normalizeText(s.domain) === domainTarget || normalizeText(s.domainKorean) === domainTarget
    );
  }

  const domainMap = new Map();
  standards.forEach((standard, index) => {
    if (!domainMap.has(standard.domainKorean)) {
      domainMap.set(standard.domainKorean, {
        domainKorean: standard.domainKorean,
        domainOrder: standard.domainOrder ?? null,
        firstSeen: index,
        modules: new Map(),
        standardsWithoutModule: [],
      });
    }
    const group = domainMap.get(standard.domainKorean);
    const entry = {
      code: standard.code,
      focus: standard.focus ?? null,
      topicCount: (store.topicsByStandardKey.get(standard.key) ?? []).length,
    };
    if (standard.module) {
      if (!group.modules.has(standard.module)) group.modules.set(standard.module, []);
      group.modules.get(standard.module).push(entry);
    } else {
      group.standardsWithoutModule.push(entry);
    }
  });

  const domains = [...domainMap.values()]
    .sort(
      (a, b) =>
        (a.domainOrder ?? Number.POSITIVE_INFINITY) - (b.domainOrder ?? Number.POSITIVE_INFINITY) ||
        a.firstSeen - b.firstSeen
    )
    .map((group) => ({
      domainKorean: group.domainKorean,
      domainOrder: group.domainOrder,
      clusters: store.clusters
        .filter(
          (cluster) =>
            normalizeText(cluster.subjectKorean) === normalizeText(curriculum.subjectKorean) &&
            cluster.gradeBand === gradeBand &&
            normalizeText(cluster.domainKorean) === normalizeText(group.domainKorean)
        )
        .map((cluster) => ({ id: cluster.id, titleKorean: cluster.titleKorean })),
      modules: [...group.modules].map(([module, moduleStandards]) => ({
        module,
        standards: moduleStandards,
      })),
      standardsWithoutModule: group.standardsWithoutModule,
    }));

  return {
    subject: curriculum.subject,
    subjectKorean: curriculum.subjectKorean,
    gradeBand,
    standardCount: standards.length,
    domains,
  };
}
