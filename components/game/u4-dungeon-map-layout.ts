import type { GeneratedMap, NodeId } from "@/lib/domain";
import { createU4OptimizedLayerOrder } from "./u4-dungeon-map-order";

export interface U4Point {
  x: number;
  y: number;
}

export interface U4CorridorLayout {
  from: NodeId;
  to: NodeId;
  start: U4Point;
  end: U4Point;
  length: number;
  angleDeg: number;
}

export interface U4MapLayout {
  nodePositions: Readonly<Partial<Record<NodeId, U4Point>>>;
  corridors: readonly U4CorridorLayout[];
}

export class U4MapLayoutError extends Error {
  readonly geometricCrossingCount: number;

  constructor(geometricCrossingCount: number) {
    super(`U4 지도 통로 교차를 제거하지 못했습니다: ${geometricCrossingCount}`);
    this.name = "U4MapLayoutError";
    this.geometricCrossingCount = geometricCrossingCount;
  }
}

const HORIZONTAL_MIN = 0.1;
const HORIZONTAL_MAX = 0.9;
const MAP_TOP = 0.12;
const MAP_BOTTOM = 0.88;
const BOSS_POSITION: U4Point = { x: 0.5, y: MAP_TOP };
const ENTRY_POSITION: U4Point = { x: 0.5, y: MAP_BOTTOM };

function clampTo(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function renderGeometry(value: number): number {
  return Number(value.toFixed(4));
}

function renderPoint(x: number, y: number): U4Point {
  return { x: renderGeometry(x), y: renderGeometry(y) };
}

/**
 * 층의 노드를 좌우로 벌린다.
 *
 * 늘 안전 구역 끝까지 벌리면 두 갈래짜리 층이 매번 왼쪽 끝과 오른쪽 끝에 박힌다.
 * 그 층이 여럿 쌓이면 긴 대각선이 층층이 겹쳐 지도가 격자무늬가 된다 - 실제로
 * 그렇게 보였다.
 *
 * 갈래가 적으면 좁게, 많으면 넓게 벌린다. 넓이도 층마다 조금씩 다르게 두어 층과
 * 층이 같은 자리에 서지 않게 한다.
 */
function xPositions(count: number, spread: number, shift: number): readonly number[] {
  if (count <= 0) return [];
  if (count === 1) return [clampTo(0.5 + shift, HORIZONTAL_MIN, HORIZONTAL_MAX)];

  const full = HORIZONTAL_MAX - HORIZONTAL_MIN;
  const width = full * spread;
  const left = 0.5 - width / 2 + shift;
  const step = width / (count - 1);
  return Array.from({ length: count }, (_, index) =>
    clampTo(left + step * index, HORIZONTAL_MIN, HORIZONTAL_MAX),
  );
}

/** 갈래가 둘이면 절반쯤, 다섯이면 끝까지 벌린다. */
function spreadFor(count: number): number {
  return Math.min(1, 0.42 + 0.15 * Math.max(0, count - 1));
}

function depthY(index: number, depthCount: number): number {
  // Entry + all normal depths + Boss are one explicit bottom-to-top row sequence.
  // A normal depth therefore occupies rows 1..depthCount between the two endpoints.
  const rowCount = depthCount + 1;
  const ratio = (index + 1) / rowCount;
  return MAP_BOTTOM - (MAP_BOTTOM - MAP_TOP) * ratio;
}

/*
 * 노드 ID 하나에서 -1..1 사이 값을 뽑는다.
 *
 * 같은 던전은 늘 같은 모양이어야 하므로 난수를 쓰지 않는다. 같은 시드가 같은
 * 지도를 낸다는 성질이 여기서도 지켜져야 한다.
 */
function wobble(nodeId: NodeId, salt: number): number {
  let hash = 2166136261 ^ salt;
  const text = String(nodeId);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  /* 상위 비트를 쓴다. 하위 비트는 이웃한 ID 끼리 비슷하게 나온다. */
  return ((hash >>> 8) % 2001) / 1000 - 1;
}

/**
 * 자로 잰 격자를 조금 흐트러뜨린다.
 *
 * 층마다 균등 간격으로 놓으면 지도가 표처럼 보인다. 던전은 그렇게 파이지
 * 않는다. 다만 흐트러짐이 뜻을 바꾸면 안 되므로 두 가지를 지킨다 - 같은 층
 * 안의 좌우 순서와, 층과 층의 위아래 순서다. 그래서 흔들림을 간격의 일부로
 * 묶는다. 좌우는 이웃과의 간격보다 작게, 위아래는 층 간격의 절반보다 작게.
 */
const X_WOBBLE = 0.18;
const Y_WOBBLE = 0.22;

export interface U4RoomVariation {
  /** 방틀을 기울이는 각도. 아이콘은 돌리지 않는다 — 읽혀야 한다. */
  readonly tiltDeg: number;
  /** 방틀의 크기 배율. 방마다 조금씩 다르게 파인다. */
  readonly scale: number;
  /** 좌우를 뒤집는가. 같은 그림이 찍힌 것처럼 보이지 않게 한다. */
  readonly flipped: boolean;
}

/**
 * 방마다 조금씩 다르게 보이게 한다.
 *
 * 분류별 그림이 하나뿐이라 같은 분류가 여럿이면 도장 찍은 것처럼 보인다. 변형
 * 자산을 새로 그리는 대신 기울기와 크기와 좌우를 바꾼다.
 *
 * 아이콘은 돌리지 않는다. 방이 무엇인지 알려 주는 것이 아이콘이라 기울면 읽기
 * 어려워진다. 틀만 기운다.
 */
export function roomVariationFor(nodeId: NodeId): U4RoomVariation {
  return {
    tiltDeg: renderGeometry(wobble(nodeId, 3) * 7),
    scale: renderGeometry(1 + wobble(nodeId, 4) * 0.09),
    flipped: wobble(nodeId, 5) > 0,
  };
}

function requirePosition(
  positions: Readonly<Partial<Record<NodeId, U4Point>>>,
  nodeId: NodeId,
): U4Point {
  const point = positions[nodeId];
  if (point === undefined) {
    throw new Error(`U4 지도 좌표를 찾을 수 없습니다: ${nodeId}`);
  }
  return point;
}

interface LayoutWobbleOptions {
  readonly xWobble: boolean;
  readonly yWobble: boolean;
  readonly layerShift: boolean;
}

function buildLayout(
  map: GeneratedMap,
  rows: readonly (readonly NodeId[])[],
  options: LayoutWobbleOptions,
): U4MapLayout {
  const positions: Partial<Record<NodeId, U4Point>> = {
    [map.entryNodeId]: ENTRY_POSITION,
    [map.bossNodeId]: BOSS_POSITION,
  };

  map.layers.forEach((layer, layerIndex) => {
    const orderedNodeIds = rows[layerIndex + 1]!;
    /* 층마다 조금씩 옆으로 민다. 층과 층이 같은 자리에 서면 다시 격자가 된다. */
    const shift = options.layerShift ? wobble(layer.nodeIds[0] ?? map.entryNodeId, 6) * 0.07 : 0;
    const xs = xPositions(layer.nodeIds.length, spreadFor(layer.nodeIds.length), shift);
    const y = depthY(layerIndex, map.layers.length);
    const xGap = layer.nodeIds.length > 1
      ? (HORIZONTAL_MAX - HORIZONTAL_MIN) * spreadFor(layer.nodeIds.length) / (layer.nodeIds.length - 1)
      : HORIZONTAL_MAX - HORIZONTAL_MIN;
    const yGap = (MAP_BOTTOM - MAP_TOP) / (map.layers.length + 1);

    orderedNodeIds.forEach((nodeId, nodeIndex) => {
      const x = clampTo(
        xs[nodeIndex]! + (options.xWobble ? wobble(nodeId, 1) * xGap * X_WOBBLE : 0),
        HORIZONTAL_MIN,
        HORIZONTAL_MAX,
      );
      positions[nodeId] = renderPoint(x, y + (options.yWobble ? wobble(nodeId, 2) * yGap * Y_WOBBLE : 0));
    });
  });

  const corridors: U4CorridorLayout[] = [];
  for (const node of map.nodes) {
    const start = requirePosition(positions, node.id);
    for (const nextNodeId of node.nextNodeIds) {
      const end = requirePosition(positions, nextNodeId);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      corridors.push({
        from: node.id,
        to: nextNodeId,
        start,
        end,
        length: renderGeometry(Math.hypot(dx, dy)),
        angleDeg: renderGeometry((Math.atan2(dy, dx) * 180) / Math.PI),
      });
    }
  }

  return {
    nodePositions: positions,
    corridors,
  };
}

interface GeometryPoint { x: number; y: number }

function orientation(a: GeometryPoint, b: GeometryPoint, c: GeometryPoint): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  return Math.sign(value);
}

function onSegment(a: GeometryPoint, b: GeometryPoint, p: GeometryPoint): boolean {
  return p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) &&
    p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y);
}

function normalizePoint(point: U4Point): GeometryPoint {
  return { x: Math.round(point.x * 10_000), y: Math.round(point.y * 10_000) };
}

function segmentsIntersect(a: U4CorridorLayout, b: U4CorridorLayout): boolean {
  const p1 = normalizePoint(a.start);
  const p2 = normalizePoint(a.end);
  const p3 = normalizePoint(b.start);
  const p4 = normalizePoint(b.end);
  const o1 = orientation(p1, p2, p3);
  const o2 = orientation(p1, p2, p4);
  const o3 = orientation(p3, p4, p1);
  const o4 = orientation(p3, p4, p2);
  if (o1 !== o2 && o3 !== o4) return true;
  return (o1 === 0 && onSegment(p1, p2, p3)) ||
    (o2 === 0 && onSegment(p1, p2, p4)) ||
    (o3 === 0 && onSegment(p3, p4, p1)) ||
    (o4 === 0 && onSegment(p3, p4, p2));
}

export function countU4GeometricCrossings(
  corridors: readonly U4CorridorLayout[],
): number {
  let count = 0;
  for (let left = 0; left < corridors.length; left += 1) {
    for (let right = left + 1; right < corridors.length; right += 1) {
      const a = corridors[left]!;
      const b = corridors[right]!;
      if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;
      if (segmentsIntersect(a, b)) count += 1;
    }
  }
  return count;
}

export function createU4DungeonMapLayout(map: GeneratedMap): U4MapLayout {
  const { wobbled, fallback } = createU4DungeonMapLayoutCandidatesForTest(map);
  return resolveU4MapLayoutCandidatesForTest(wobbled, fallback);
}

/** Exposes the two deterministic candidates for invariant-focused layout tests. */
export function createU4DungeonMapLayoutCandidatesForTest(map: GeneratedMap): {
  readonly wobbled: U4MapLayout;
  readonly fallback: U4MapLayout;
} {
  const optimized = createU4OptimizedLayerOrder(map);
  const wobbled = buildLayout(map, optimized.rows, {
    xWobble: true,
    yWobble: true,
    layerShift: true,
  });
  const fallback = buildLayout(map, optimized.rows, {
    xWobble: true,
    yWobble: false,
    layerShift: true,
  });
  return { wobbled, fallback };
}

export function resolveU4MapLayoutCandidatesForTest(
  wobbled: U4MapLayout,
  flatDepths: U4MapLayout,
): U4MapLayout {
  if (countU4GeometricCrossings(wobbled.corridors) === 0) return wobbled;
  const geometricCrossingCount = countU4GeometricCrossings(flatDepths.corridors);
  if (geometricCrossingCount !== 0) throw new U4MapLayoutError(geometricCrossingCount);
  return flatDepths;
}
