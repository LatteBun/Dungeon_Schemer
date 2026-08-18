import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { DUNGEON_EVENT_POOLS, ENTRY_EVENT } from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS, GRADES, RuleError } from "@/lib/domain";
import type { EventKind, GeneratedMap, Grade } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { generateGradeMap, validateGeneratedMap } from "@/lib/rules/map";

export interface E1NodeView {
  id: string;
  depth: number;
  /** 갈래 지점이면 1 또는 2, 입구·합류·보스방이면 null이다. */
  branch: number | null;
  eventId: string;
  eventTitle: string;
  kind: EventKind;
  riskSummary: string;
  hasInfoOpportunity: boolean;
  bossRelatedInfoCount: number;
  role: "entry" | "branch" | "merge" | "boss";
}

export interface E1RowView {
  depth: number;
  nodes: E1NodeView[];
}

export interface E1PathView {
  label: string;
  nodeIds: string[];
  regularEventCount: number;
  infoCount: number;
  bossRelatedInfoCount: number;
  kinds: EventKind[];
  coversAllKinds: boolean;
}

export interface E1CheckView {
  label: string;
  expected: string;
  actual: string;
  pass: boolean;
}

export interface E1GradeView {
  grade: Grade;
  status: "pass" | "fail";
  error?: string;
  pathLength: number;
  rows: E1RowView[];
  paths: E1PathView[];
  checks: E1CheckView[];
  layerWidths: number[];
  infoNodeCount: number;
}

export interface E1NegativeCase {
  label: string;
  reason: string;
  pass: boolean;
  errorCode?: string;
  message?: string;
}

export interface E1Snapshot {
  seed: string;
  grades: E1GradeView[];
  negativeCases: E1NegativeCase[];
  reproducibility: {
    sameSeed: boolean;
    otherSeedDiffers: boolean;
    sampleNodeIds: string[];
  };
}

const EVENT_BY_ID = new Map(
  [
    ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
    ...DUNGEON_EVENT_POOLS.boss,
    // 입구는 일반 풀에 없는 전용 사건이다. 빠뜨리면 "알 수 없는 사건"으로 뜬다.
    ENTRY_EVENT,
  ].map((event) => [event.id as string, event]),
);

function branchOf(nodeId: string): number | null {
  const matched = /^node-path-(\d+)-depth-\d+$/.exec(nodeId);
  return matched === null ? null : Number(matched[1]);
}

function roleOf(map: GeneratedMap, nodeId: string): E1NodeView["role"] {
  if (nodeId === map.entryNodeId) return "entry";
  if (nodeId === map.bossNodeId) return "boss";
  return branchOf(nodeId) === null ? "merge" : "branch";
}

function toNodeView(map: GeneratedMap, nodeId: string): E1NodeView {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  if (node === undefined) throw new Error(`없는 지점이다: ${nodeId}`);
  const event = EVENT_BY_ID.get(node.eventId as string);

  return {
    id: node.id as string,
    depth: node.depth,
    branch: branchOf(node.id as string),
    eventId: node.eventId as string,
    eventTitle: event?.title ?? "알 수 없는 사건",
    kind: event?.kind ?? "special",
    riskSummary: node.riskSummary,
    hasInfoOpportunity: node.hasInfoOpportunity,
    bossRelatedInfoCount: node.bossRelatedInfoCount,
    role: roleOf(map, node.id as string),
  };
}

/** 보스방이 맨 위에 오도록 깊이를 내림차순으로 묶는다. 화면이 위로 올라간다. */
function toRows(map: GeneratedMap): E1RowView[] {
  const byDepth = new Map<number, E1NodeView[]>();
  for (const node of map.nodes) {
    const view = toNodeView(map, node.id as string);
    byDepth.set(view.depth, [...(byDepth.get(view.depth) ?? []), view]);
  }
  return [...byDepth.entries()]
    .sort(([left], [right]) => right - left)
    .map(([depth, nodes]) => ({
      depth,
      nodes: [...nodes].sort((left, right) => (left.branch ?? 0) - (right.branch ?? 0)),
    }));
}

/**
 * 입구에서 보스까지 갈 수 있는 모든 길을 걷는다.
 *
 * 간선이 깊이를 1씩 늘리므로 모든 길이 같은 값을 갖는다. 그래도 전부 걷는 이유는
 * 화면이 "정말 같은가"를 눈으로 보여주는 자리이기 때문이다.
 */
function toPathViews(map: GeneratedMap): E1PathView[] {
  const byId = new Map(map.nodes.map((node) => [node.id as string, node]));
  const routes: string[][] = [];
  const walk = (id: string, trail: string[]): void => {
    if (id === (map.bossNodeId as string)) {
      routes.push([...trail, id]);
      return;
    }
    for (const next of byId.get(id)!.nextNodeIds) walk(next as string, [...trail, id]);
  };
  walk(map.entryNodeId as string, []);

  return routes.map((nodeIds, index) => {
    const kinds = nodeIds
      .filter((id) => id !== (map.bossNodeId as string) && id !== (map.entryNodeId as string))
      .map((id) => toNodeView(map, id).kind);
    return {
      label: `경로 ${index + 1}`,
      nodeIds,
      regularEventCount: nodeIds.length - 2,
      infoCount: nodeIds.filter((id) => toNodeView(map, id).hasInfoOpportunity).length,
      bossRelatedInfoCount: nodeIds
        .reduce((sum, id) => sum + toNodeView(map, id).bossRelatedInfoCount, 0),
      kinds,
      coversAllKinds: EVENT_KINDS.every((kind) => kinds.includes(kind)),
    };
  });
}

function check(label: string, expected: number | string, actual: number | string): E1CheckView {
  return {
    label,
    expected: String(expected),
    actual: String(actual),
    pass: String(expected) === String(actual),
  };
}

function toGradeView(grade: Grade, seed: string): E1GradeView {
  const config = CAMPAIGN_GRADE_CONFIG[grade];
  let map: GeneratedMap;
  try {
    map = generateGradeMap(grade, createRng(`${seed}/${grade}`).derive("map"));
  } catch (error) {
    const ruleError = error instanceof RuleError ? error : undefined;
    return {
      grade,
      status: "fail",
      error: ruleError?.message ?? String(error),
      pathLength: config.pathLength,
      rows: [],
      paths: [],
      checks: [],
      layerWidths: [],
      infoNodeCount: 0,
    };
  }

  const paths = toPathViews(map);
  const distinctEvents = new Set(map.nodes.map((node) => node.eventId as string)).size;
  const layerWidths = Array.from({ length: config.pathLength }, (_, index) =>
    map.nodes.filter((node) => node.depth === index + 1).length);
  const uniform = <T>(values: readonly T[]): T | "불일치" =>
    new Set(values).size === 1 ? values[0] : "불일치";

  const checks: E1CheckView[] = [
    check("전체 지점", config.eventNodeCount + 2, map.nodes.length),
    check("경로 길이", config.pathLength, map.regularEventCount),
    check("서로 다른 사건", map.nodes.length, distinctEvents),
    check("모든 경로의 사건 수", config.pathLength,
      uniform(paths.map((path) => path.regularEventCount))),
    check("모든 경로의 정보 횟수", config.infoOpportunityCount,
      uniform(paths.map((path) => path.infoCount))),
    check("모든 경로의 보스 보장", config.bossRelatedInfoCount,
      uniform(paths.map((path) => path.bossRelatedInfoCount))),
    check("네 분류를 지나는 경로", paths.length,
      paths.filter((path) => path.coversAllKinds).length),
    check("층 너비 상한", "1~3",
      layerWidths.every((width) => width >= 1 && width <= 3) ? "1~3" : "벗어남"),
    check("다음 선택지 상한", "2 이하",
      map.nodes.every((node) => node.nextNodeIds.length <= 2) ? "2 이하" : "초과"),
  ];

  let error: string | undefined;
  try {
    validateGeneratedMap(map);
  } catch (caught) {
    error = caught instanceof RuleError ? caught.message : String(caught);
  }

  return {
    grade,
    status: error === undefined && checks.every((entry) => entry.pass) ? "pass" : "fail",
    error,
    pathLength: config.pathLength,
    rows: toRows(map),
    paths,
    checks,
    layerWidths,
    infoNodeCount: map.nodes.filter((node) => node.hasInfoOpportunity).length,
  };
}

function poolsWithout(kind: EventKind, keep: number): DungeonEventPools {
  const pools = structuredClone(DUNGEON_EVENT_POOLS) as DungeonEventPools;
  return {
    ...pools,
    regular: { ...pools.regular, [kind]: pools.regular[kind].slice(0, keep) },
  };
}

/** 분류별 3개만 남긴 풀. 전체 12개라 S급이 요구하는 16개에 못 미친다. */
function thinPools(): DungeonEventPools {
  const pools = structuredClone(DUNGEON_EVENT_POOLS) as DungeonEventPools;
  return {
    ...pools,
    regular: Object.fromEntries(
      EVENT_KINDS.map((kind) => [kind, pools.regular[kind].slice(0, 3)]),
    ) as unknown as DungeonEventPools["regular"],
  };
}

function negativeCase(
  label: string,
  reason: string,
  run: () => unknown,
): E1NegativeCase {
  try {
    run();
  } catch (error) {
    if (error instanceof RuleError) {
      return {
        label,
        reason,
        pass: error.code === "INVALID_GENERATION",
        errorCode: error.code,
        message: error.message,
      };
    }
    return { label, reason, pass: false, message: String(error) };
  }
  return { label, reason, pass: false, message: "오류 없이 통과했다" };
}

function corrupted(seed: string, mutate: (map: GeneratedMap) => void): () => void {
  return () => {
    const map = structuredClone(generateGradeMap("S", createRng(seed).derive("map")));
    mutate(map);
    validateGeneratedMap(map);
  };
}

function negativeCases(seed: string): E1NegativeCase[] {
  return [
    negativeCase(
      "S급 · 분류별 3개로 축소",
      "S급은 서로 다른 사건 16개를 요구하므로 12개로는 생성할 수 없다",
      () => generateGradeMap("S", createRng(seed).derive("map"), {
        eventPools: thinPools(),
      }),
    ),
    negativeCase(
      "C급 · 특수 분류 제거",
      "모든 경로가 네 분류를 지나야 하므로 분류가 통째로 빠지면 만들 수 없다",
      () => generateGradeMap("C", createRng(seed).derive("map"), {
        eventPools: poolsWithout("special", 0),
      }),
    ),
    negativeCase(
      "정보 기회 하나 지우기",
      "경로별 정보 횟수가 등급 요구와 어긋난다",
      corrupted(seed, (map) => {
        const target = map.nodes.find((node) => node.hasInfoOpportunity);
        if (target !== undefined) target.hasInfoOpportunity = false;
      }),
    ),
    negativeCase(
      "보스 보장 전부 지우기",
      "S급은 경로마다 보스 관련 정보를 2회 보장해야 한다",
      corrupted(seed, (map) => {
        for (const node of map.nodes) node.bossRelatedInfoCount = 0;
      }),
    ),
    negativeCase(
      "첫 층의 간선 절단",
      "보스방에 도달하지 못하는 지도가 된다",
      corrupted(seed, (map) => {
        const first = map.nodes.find((node) => node.depth === 1);
        if (first !== undefined) first.nextNodeIds = [];
      }),
    ),
    negativeCase(
      "같은 사건 두 번 배치",
      "한 던전 안에서 사건 콘텐츠를 중복할 수 없다",
      corrupted(seed, (map) => {
        map.nodes[1].eventId = map.nodes[2].eventId;
      }),
    ),
  ];
}

export function createE1TestSnapshot(seed: string): E1Snapshot {
  const first = generateGradeMap("B", createRng(`${seed}/B`).derive("map"));
  const again = generateGradeMap("B", createRng(`${seed}/B`).derive("map"));
  const other = generateGradeMap("B", createRng(`${seed}-다른/B`).derive("map"));
  const signature = (map: GeneratedMap): string => map.nodes
    .map((node) => `${node.eventId}:${node.hasInfoOpportunity ? 1 : 0}`)
    .join("|");

  return {
    seed,
    grades: GRADES.map((grade) => toGradeView(grade, seed)),
    negativeCases: negativeCases(seed),
    reproducibility: {
      sameSeed: signature(first) === signature(again),
      otherSeedDiffers: signature(first) !== signature(other),
      sampleNodeIds: toPathViews(first)[0].nodeIds,
    },
  };
}
