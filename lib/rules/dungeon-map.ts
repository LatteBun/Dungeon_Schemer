import type { DungeonId, DungeonLayer, DungeonNode, GeneratedMap, NodeId, RiskLevel } from "@/lib/domain";
import { RISK_LEVELS } from "@/lib/domain";
import { RuleError } from "@/lib/domain/errors";
import { createRng } from "@/lib/rng";

export interface MapTemplate {
  readonly id: string;
  readonly riskLevel: RiskLevel;
  readonly layerWidths: readonly number[];
}

const DEPTH_COUNTS: Readonly<Record<RiskLevel, number>> = {
  1: 6,
  2: 6,
  3: 7,
  4: 8,
  5: 8,
};

const TEMPLATE_COUNTS: Readonly<Record<RiskLevel, number>> = {
  1: 3,
  2: 3,
  3: 3,
  4: 4,
  5: 3,
};

const AVERAGE_WIDTH_RANGES: Readonly<Record<RiskLevel, readonly [number, number]>> = {
  1: [1.5, 2],
  2: [2, 2.5],
  3: [2.5, 3],
  4: [3, 3.5],
  5: [3.5, 4],
};

export const MAP_TEMPLATES: readonly MapTemplate[] = [
  { id: "risk1-a", riskLevel: 1, layerWidths: [1, 2, 2, 2, 2, 1] },
  { id: "risk1-b", riskLevel: 1, layerWidths: [2, 2, 3, 2, 1, 2] },
  { id: "risk1-c", riskLevel: 1, layerWidths: [1, 2, 3, 2, 2, 2] },
  { id: "risk2-a", riskLevel: 2, layerWidths: [2, 3, 3, 2, 3, 2] },
  { id: "risk2-b", riskLevel: 2, layerWidths: [2, 3, 2, 4, 2, 2] },
  { id: "risk2-c", riskLevel: 2, layerWidths: [2, 2, 3, 3, 2, 2] },
  { id: "risk3-a", riskLevel: 3, layerWidths: [2, 3, 4, 3, 4, 3, 2] },
  { id: "risk3-b", riskLevel: 3, layerWidths: [2, 4, 3, 4, 3, 3, 2] },
  { id: "risk3-c", riskLevel: 3, layerWidths: [2, 3, 5, 4, 3, 2, 2] },
  { id: "risk4-a", riskLevel: 4, layerWidths: [2, 3, 4, 3, 4, 3, 3, 2] },
  { id: "risk4-b", riskLevel: 4, layerWidths: [2, 4, 3, 5, 3, 4, 3, 2] },
  { id: "risk4-c", riskLevel: 4, layerWidths: [2, 3, 5, 4, 4, 3, 3, 2] },
  { id: "risk4-d", riskLevel: 4, layerWidths: [2, 4, 4, 3, 5, 4, 3, 2] },
  { id: "risk5-a", riskLevel: 5, layerWidths: [2, 4, 5, 4, 5, 4, 3, 2] },
  { id: "risk5-b", riskLevel: 5, layerWidths: [2, 4, 5, 5, 4, 5, 3, 2] },
  { id: "risk5-c", riskLevel: 5, layerWidths: [2, 4, 5, 4, 5, 5, 4, 2] },
];

function invalidGeneration(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function isRiskLevel(value: number): value is RiskLevel {
  return RISK_LEVELS.includes(value as RiskLevel);
}

export function validateMapTemplate(template: MapTemplate): void {
  if (!template.id) {
    invalidGeneration("지도 템플릿 ID가 비어 있다.");
  }
  if (!isRiskLevel(template.riskLevel)) {
    invalidGeneration("지도 템플릿의 위험도가 유효하지 않다.", { riskLevel: template.riskLevel });
  }

  const expectedDepthCount = DEPTH_COUNTS[template.riskLevel];
  if (template.layerWidths.length !== expectedDepthCount) {
    invalidGeneration("지도 템플릿의 Depth 수가 위험도 계약과 다르다.", {
      templateId: template.id,
      expectedDepthCount,
      actualDepthCount: template.layerWidths.length,
    });
  }

  if (template.layerWidths.some((width) => !Number.isInteger(width) || width < 1 || width > 5)) {
    invalidGeneration("지도 템플릿의 폭은 1부터 5 사이의 정수여야 한다.", { templateId: template.id });
  }
  if (template.layerWidths[0] > 2 || template.layerWidths.at(-1)! > 2) {
    invalidGeneration("지도 템플릿의 첫·마지막 Depth 폭은 2 이하여야 한다.", { templateId: template.id });
  }

  for (let index = 1; index < template.layerWidths.length; index += 1) {
    const previous = template.layerWidths[index - 1];
    const current = template.layerWidths[index];
    if (Math.max(previous, current) > Math.min(previous, current) * 2) {
      invalidGeneration("인접 Depth 폭은 서로 2배를 넘을 수 없다.", { templateId: template.id, index });
    }
  }

  const average = template.layerWidths.reduce((sum, width) => sum + width, 0) / template.layerWidths.length;
  const [minimum, maximum] = AVERAGE_WIDTH_RANGES[template.riskLevel];
  if (average < minimum || average > maximum) {
    invalidGeneration("지도 템플릿의 평균 폭이 위험도 목표 범위를 벗어난다.", {
      templateId: template.id,
      average,
      minimum,
      maximum,
    });
  }
}

export function validateMapTemplates(templates: readonly MapTemplate[]): void {
  const ids = new Set<string>();
  const counts: Record<RiskLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

  for (const template of templates) {
    validateMapTemplate(template);
    if (ids.has(template.id)) {
      invalidGeneration("지도 템플릿 ID가 중복된다.", { templateId: template.id });
    }
    ids.add(template.id);
    counts[template.riskLevel] += 1;
  }

  for (const riskLevel of RISK_LEVELS) {
    if (counts[riskLevel] !== TEMPLATE_COUNTS[riskLevel]) {
      invalidGeneration("위험도별 지도 템플릿 수가 계약과 다르다.", {
        riskLevel,
        expected: TEMPLATE_COUNTS[riskLevel],
        actual: counts[riskLevel],
      });
    }
  }
}

validateMapTemplates(MAP_TEMPLATES);

function nodeMap(map: GeneratedMap): Map<NodeId, DungeonNode> {
  const result = new Map<NodeId, DungeonNode>();
  for (const node of map.nodes) {
    if (result.has(node.id)) {
      invalidGeneration("지도 안에서 NodeId가 중복된다.", { nodeId: node.id });
    }
    result.set(node.id, node);
  }
  return result;
}

function traverse(start: NodeId, edges: ReadonlyMap<NodeId, readonly NodeId[]>): Set<NodeId> {
  const visited = new Set<NodeId>();
  const queue: NodeId[] = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of edges.get(current) ?? []) {
      if (!visited.has(next)) queue.push(next);
    }
  }
  return visited;
}

export function validateGeneratedMap(map: GeneratedMap, initialRiskLevel: RiskLevel): void {
  if (!isRiskLevel(initialRiskLevel)) {
    invalidGeneration("생성 지도 검증의 초기 위험도가 유효하지 않다.", { initialRiskLevel });
  }
  if (map.layers.length !== DEPTH_COUNTS[initialRiskLevel]) {
    invalidGeneration("생성 지도의 Depth 수가 초기 위험도와 다르다.", { initialRiskLevel });
  }

  const nodes = nodeMap(map);
  const entry = nodes.get(map.entryNodeId);
  const boss = nodes.get(map.bossNodeId);
  const entryNodes = map.nodes.filter((node) => node.kind === "entry");
  const bossNodes = map.nodes.filter((node) => node.kind === "boss");
  if (
    entryNodes.length !== 1 ||
    bossNodes.length !== 1 ||
    !entry ||
    entry.kind !== "entry" ||
    !boss ||
    boss.kind !== "boss"
  ) {
    invalidGeneration("생성 지도에 올바른 Entry 또는 Boss가 없다.");
  }

  const layerByNode = new Map<NodeId, number>();
  for (let index = 0; index < map.layers.length; index += 1) {
    const layer = map.layers[index];
    if (layer.depth !== index + 1) {
      invalidGeneration("생성 지도의 Depth 번호가 순서와 다르다.", { index, depth: layer.depth });
    }
    if (layer.nodeIds.length < 1 || layer.nodeIds.length > 5) {
      invalidGeneration("생성 지도의 Depth 폭이 1~5 범위를 벗어난다.", { depth: layer.depth });
    }
    if (index === 0 || index === map.layers.length - 1) {
      if (layer.nodeIds.length > 2) {
        invalidGeneration("생성 지도의 첫·마지막 Depth 폭은 2 이하여야 한다.", { depth: layer.depth });
      }
    }
    for (const nodeId of layer.nodeIds) {
      const node = nodes.get(nodeId);
      if (!node || node.kind !== "normal" || nodeId === map.entryNodeId || nodeId === map.bossNodeId) {
        invalidGeneration("layers가 일반 노드가 아닌 NodeId를 포함한다.", { nodeId });
      }
      if (layerByNode.has(nodeId)) {
        invalidGeneration("일반 NodeId가 여러 Depth에 포함된다.", { nodeId });
      }
      layerByNode.set(nodeId, index);
    }
  }

  for (const node of map.nodes) {
    if (node.kind === "normal" && !layerByNode.has(node.id)) {
      invalidGeneration("일반 노드가 어떤 Depth에도 속하지 않는다.", { nodeId: node.id });
    }
    if (node.nextNodeIds.length !== new Set(node.nextNodeIds).size) {
      invalidGeneration("한 노드에 중복 간선이 있다.", { nodeId: node.id });
    }
    for (const nextNodeId of node.nextNodeIds) {
      if (!nodes.has(nextNodeId)) {
        invalidGeneration("존재하지 않는 NodeId를 간선이 참조한다.", { nodeId: node.id, nextNodeId });
      }
    }
  }

  const incoming = new Map<NodeId, number>();
  const edges = new Map<NodeId, readonly NodeId[]>();
  for (const node of map.nodes) {
    edges.set(node.id, node.nextNodeIds);
    for (const nextNodeId of node.nextNodeIds) {
      incoming.set(nextNodeId, (incoming.get(nextNodeId) ?? 0) + 1);
    }
  }

  for (const node of map.nodes) {
    if (node.kind === "entry") {
      if (node.nextNodeIds.length < 1 || node.nextNodeIds.length > 2 || (incoming.get(node.id) ?? 0) !== 0) {
        invalidGeneration("Entry의 차수가 계약과 다르다.", { nodeId: node.id });
      }
      if (node.nextNodeIds.some((nextNodeId) => layerByNode.get(nextNodeId) !== 0)) {
        invalidGeneration("Entry는 첫 번째 Depth로만 연결되어야 한다.");
      }
      continue;
    }
    if (node.kind === "boss") {
      if (node.nextNodeIds.length !== 0 || (incoming.get(node.id) ?? 0) < 1 || (incoming.get(node.id) ?? 0) > 2) {
        invalidGeneration("Boss의 차수가 계약과 다르다.", { nodeId: node.id });
      }
      continue;
    }

    const layerIndex = layerByNode.get(node.id)!;
    const incomingCount = incoming.get(node.id) ?? 0;
    if (incomingCount < 1 || incomingCount > 2 || node.nextNodeIds.length < 1 || node.nextNodeIds.length > 2) {
      invalidGeneration("일반 노드의 incoming/outgoing 차수가 1~2 범위를 벗어난다.", { nodeId: node.id });
    }
    for (const nextNodeId of node.nextNodeIds) {
      const nextNode = nodes.get(nextNodeId)!;
      if (layerIndex === map.layers.length - 1) {
        if (nextNode.kind !== "boss") invalidGeneration("마지막 Depth는 Boss로만 연결되어야 한다.");
      } else if (layerByNode.get(nextNodeId) !== layerIndex + 1) {
        invalidGeneration("일반 노드의 간선은 바로 다음 Depth로만 연결되어야 한다.", { nodeId: node.id, nextNodeId });
      }
    }
  }

  const fromEntry = traverse(map.entryNodeId, edges);
  if (fromEntry.size !== map.nodes.length) {
    invalidGeneration("Entry에서 도달할 수 없는 노드가 있다.");
  }

  const reverseEdges = new Map<NodeId, NodeId[]>();
  for (const node of map.nodes) reverseEdges.set(node.id, []);
  for (const node of map.nodes) {
    for (const nextNodeId of node.nextNodeIds) reverseEdges.get(nextNodeId)!.push(node.id);
  }
  const toBoss = traverse(map.bossNodeId, reverseEdges);
  if (toBoss.size !== map.nodes.length) {
    invalidGeneration("Boss에 도달할 수 없는 노드가 있다.");
  }

  const pathLengths = (nodeId: NodeId): Set<number> => {
    if (nodeId === map.bossNodeId) return new Set([0]);
    const node = nodes.get(nodeId)!;
    const lengths = new Set<number>();
    for (const nextNodeId of node.nextNodeIds) {
      for (const length of pathLengths(nextNodeId)) lengths.add(length + 1);
    }
    return lengths;
  };
  const lengths = pathLengths(map.entryNodeId);
  if (lengths.size !== 1 || !lengths.has(map.layers.length + 1)) {
    invalidGeneration("Entry에서 Boss까지의 모든 경로가 같은 일반 Depth 수를 지나지 않는다.");
  }
}

export interface GenerateDungeonMapInput {
  readonly campaignSeed: string;
  readonly dungeonId: DungeonId;
  readonly initialRiskLevel: RiskLevel;
  readonly attempt: number;
}

function addEdge(edges: Map<NodeId, NodeId[]>, from: NodeId, to: NodeId): void {
  const targets = edges.get(from)!;
  if (!targets.includes(to)) targets.push(to);
}

export function generateDungeonMap(input: GenerateDungeonMapInput): GeneratedMap {
  const { campaignSeed, dungeonId, initialRiskLevel, attempt } = input;
  if (
    !campaignSeed ||
    !dungeonId ||
    !isRiskLevel(initialRiskLevel) ||
    !Number.isSafeInteger(attempt) ||
    attempt < 0
  ) {
    invalidGeneration("지도 생성 입력이 유효하지 않다.", { dungeonId, initialRiskLevel, attempt });
  }

  const templates = MAP_TEMPLATES.filter((template) => template.riskLevel === initialRiskLevel);
  const templateOrderRng = createRng(`${campaignSeed}:${dungeonId}:template-order`).derive("map");
  const orderedTemplates = templateOrderRng.shuffle(templates);
  const template = orderedTemplates[attempt % orderedTemplates.length];
  const mapRng = createRng(`${campaignSeed}:${dungeonId}:attempt:${attempt}`).derive("map");
  const prefix = `${dungeonId}:attempt:${attempt}`;
  const entryNodeId = `${prefix}:entry` as NodeId;
  const bossNodeId = `${prefix}:boss` as NodeId;
  const layers: DungeonLayer[] = template.layerWidths.map((width, index) => ({
    depth: index + 1,
    nodeIds: Array.from({ length: width }, (_, nodeIndex) => `${prefix}:depth:${index + 1}:node:${nodeIndex}` as NodeId),
  }));
  const allNormalNodeIds = layers.flatMap((layer) => layer.nodeIds);
  const edges = new Map<NodeId, NodeId[]>();
  for (const nodeId of [entryNodeId, ...allNormalNodeIds, bossNodeId]) edges.set(nodeId, []);
  addEdge(edges, entryNodeId, layers[0].nodeIds[0]);
  if (layers[0].nodeIds.length === 2) addEdge(edges, entryNodeId, layers[0].nodeIds[1]);

  const shuffledLayers = layers.map((layer) => mapRng.shuffle(layer.nodeIds));
  for (let layerIndex = 0; layerIndex < shuffledLayers.length - 1; layerIndex += 1) {
    const current = shuffledLayers[layerIndex];
    const next = shuffledLayers[layerIndex + 1];
    if (current.length <= next.length) {
      for (let index = 0; index < next.length; index += 1) addEdge(edges, current[Math.floor((index * current.length) / next.length)], next[index]);
    } else {
      for (let index = 0; index < current.length; index += 1) addEdge(edges, current[index], next[Math.floor((index * next.length) / current.length)]);
    }
    const candidates = mapRng.shuffle(current.flatMap((from) => next.map((to) => [from, to] as const)));
    for (const [from, to] of candidates) {
      const targetIncoming = [...edges.values()].reduce((count, targets) => count + (targets.includes(to) ? 1 : 0), 0);
      if (edges.get(from)!.length < 2 && targetIncoming < 2 && !edges.get(from)!.includes(to) && mapRng.int(0, 3) === 0) {
        addEdge(edges, from, to);
      }
    }
  }
  for (const nodeId of layers.at(-1)!.nodeIds) addEdge(edges, nodeId, bossNodeId);

  const nodes: DungeonNode[] = [
    { id: entryNodeId, kind: "entry", nextNodeIds: edges.get(entryNodeId)! },
    ...layers.flatMap((layer) => layer.nodeIds.map((id) => ({ id, kind: "normal" as const, nextNodeIds: edges.get(id)! }))),
    { id: bossNodeId, kind: "boss", nextNodeIds: [] },
  ];
  const map: GeneratedMap = { entryNodeId, bossNodeId, layers, nodes };
  validateGeneratedMap(map, initialRiskLevel);
  return map;
}
