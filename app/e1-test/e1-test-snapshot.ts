import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import { DUNGEON_EVENT_POOLS } from "@/lib/content/events";
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
  branchLength: number;
  rows: E1RowView[];
  paths: E1PathView[];
  checks: E1CheckView[];
  entryKind: EventKind;
  mergeKind: EventKind;
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

function toPathViews(map: GeneratedMap): E1PathView[] {
  return map.paths.map((path, index) => {
    const kinds = path.nodeIds
      .filter((id) => id !== map.bossNodeId)
      .map((id) => toNodeView(map, id as string).kind);
    return {
      label: index === 0 ? "왼쪽 갈래" : "오른쪽 갈래",
      nodeIds: path.nodeIds as unknown as string[],
      regularEventCount: path.regularEventCount,
      infoCount: path.infoCount,
      bossRelatedInfoCount: path.bossRelatedInfoCount,
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
      branchLength: config.branchLength,
      rows: [],
      paths: [],
      checks: [],
      entryKind: "special",
      mergeKind: "special",
      infoNodeCount: 0,
    };
  }

  const paths = toPathViews(map);
  const entry = toNodeView(map, map.entryNodeId as string);
  const merge = toNodeView(map, "node-merge");
  const distinctEvents = new Set(map.nodes.map((node) => node.eventId as string)).size;

  const checks: E1CheckView[] = [
    check("전체 지점", config.nodeCount, map.nodes.length),
    check("갈래 길이", config.branchLength, (map.nodes.length - 3) / 2),
    check("서로 다른 사건", map.nodes.length, distinctEvents),
    check(
      "경로별 일반 사건",
      config.branchLength + 2,
      new Set(paths.map((path) => path.regularEventCount)).size === 1
        ? paths[0].regularEventCount
        : "불일치",
    ),
    check(
      "경로별 정보 기회",
      config.infoOpportunityCount,
      new Set(paths.map((path) => path.infoCount)).size === 1
        ? paths[0].infoCount
        : "불일치",
    ),
    check(
      "경로별 보스 보장",
      config.bossRelatedInfoCount,
      new Set(paths.map((path) => path.bossRelatedInfoCount)).size === 1
        ? paths[0].bossRelatedInfoCount
        : "불일치",
    ),
    check(
      "네 분류를 지나는 경로",
      paths.length,
      paths.filter((path) => path.coversAllKinds).length,
    ),
    check("입구·합류 분류", "서로 다름", entry.kind === merge.kind ? "같음" : "서로 다름"),
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
    branchLength: config.branchLength,
    rows: toRows(map),
    paths,
    checks,
    entryKind: entry.kind,
    mergeKind: merge.kind,
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
      "S급 · 몬스터 풀 1개 축소",
      "S급은 서로 다른 사건 12개를 요구하므로 11개로는 생성할 수 없다",
      () => generateGradeMap("S", createRng(seed).derive("map"), {
        eventPools: poolsWithout("monster", 2),
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
        for (const path of map.paths) path.bossRelatedInfoCount = 0;
      }),
    ),
    negativeCase(
      "합류 → 보스방 간선 절단",
      "보스방에 도달하지 못하는 지도가 된다",
      corrupted(seed, (map) => {
        const merge = map.nodes.find((node) => node.id === "node-merge");
        if (merge !== undefined) merge.nextNodeIds = [];
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
      sampleNodeIds: first.paths[0].nodeIds as unknown as string[],
    },
  };
}
