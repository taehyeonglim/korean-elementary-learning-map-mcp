export function directEdges(store, topicId, { direction = 'prerequisites', strength } = {}) {
  const adjacency = direction === 'unlocks' ? store.unlocksByTopic : store.prerequisitesByTopic;
  let edges = adjacency.get(topicId) ?? [];
  if (strength) edges = edges.filter((edge) => edge.strength === strength);
  return edges.map((edge) => {
    const relatedTopicId = direction === 'unlocks' ? edge.topicId : edge.prerequisiteId;
    return {
      relatedTopicId,
      relatedTopicTitle: store.topicsById.get(relatedTopicId)?.titleKorean ?? null,
      strength: edge.strength,
      reason: edge.reason,
    };
  });
}

export function learningPath(store, topicId, { direction = 'prerequisites', strength } = {}) {
  const order = [];
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const edge of directEdges(store, id, { direction, strength })) {
      visit(edge.relatedTopicId);
    }
    order.push(id);
  };
  visit(topicId);
  if (direction === 'unlocks') order.reverse();
  return order.map((id) => ({
    topicId: id,
    titleKorean: store.topicsById.get(id)?.titleKorean ?? null,
    directEdges: directEdges(store, id, { direction, strength }),
  }));
}
