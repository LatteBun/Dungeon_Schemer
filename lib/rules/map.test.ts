import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_GRADE_CONFIG,
  MAX_LAYER_WIDTH,
  MAX_NEXT_NODES,
} from "@/lib/content/dungeons";
import { DUNGEON_EVENT_POOLS, ENTRY_EVENT } from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS, GRADES, RuleError } from "@/lib/domain";
import type { EventKind, GeneratedMap, Grade, MapNode } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng, RngStream } from "@/lib/rng";
import { generateGradeMap, validateGeneratedMap } from "@/lib/rules/map";

const EVENT_BY_ID = new Map(
  EVENT_KINDS.flatMap((kind) =>
    DUNGEON_EVENT_POOLS.regular[kind].map((event) => [event.id as string, kind])),
);

function mapOf(grade: Grade, seed: string): GeneratedMap {
  return generateGradeMap(grade, createRng(seed).derive("map"));
}

function nodesById(map: GeneratedMap): Map<string, MapNode> {
  return new Map(map.nodes.map((node) => [node.id as string, node]));
}

function layers(map: GeneratedMap): Map<number, MapNode[]> {
  const byDepth = new Map<number, MapNode[]>();
  for (const node of map.nodes) {
    byDepth.set(node.depth, [...(byDepth.get(node.depth) ?? []), node]);
  }
  return byDepth;
}

function kindOf(node: MapNode): EventKind | undefined {
  return EVENT_BY_ID.get(node.eventId as string);
}

/** 입구에서 보스까지 가능한 모든 경로. 지점 수가 적을 때만 쓴다. */
function walkAll(map: GeneratedMap): MapNode[][] {
  const byId = nodesById(map);
  const routes: MapNode[][] = [];
  const visit = (node: MapNode, trail: MapNode[]): void => {
    if (node.id === map.bossNodeId) {
      routes.push([...trail, node]);
      return;
    }
    for (const next of node.nextNodeIds) {
      visit(byId.get(next as string)!, [...trail, node]);
    }
  };
  visit(byId.get(map.entryNodeId as string)!, []);
  return routes;
}

function clonedPools(): DungeonEventPools {
  return structuredClone(DUNGEON_EVENT_POOLS) as DungeonEventPools;
}

/** 분류별 3개만 남긴 풀. 전체 12개라 S급이 요구하는 16개에 못 미친다. */
function thinPools(): DungeonEventPools {
  const pools = clonedPools();
  return {
    ...pools,
    regular: Object.fromEntries(
      EVENT_KINDS.map((kind) => [kind, pools.regular[kind].slice(0, 3)]),
    ) as unknown as DungeonEventPools["regular"],
  };
}

function countingRng(seed: string): { readonly rng: Rng; readonly calls: () => number } {
  const delegate = createRng(seed).derive("map");
  let callCount = 0;
  const count = <T>(operation: () => T): T => {
    callCount += 1;
    return operation();
  };
  return {
    rng: {
      seed: delegate.seed,
      float: () => count(() => delegate.float()),
      int: (min, max) => count(() => delegate.int(min, max)),
      pick: <T>(items: readonly T[]) => count(() => delegate.pick(items)),
      shuffle: <T>(items: readonly T[]) => count(() => delegate.shuffle(items)),
      derive: (stream: RngStream) => count(() => delegate.derive(stream)),
    },
    calls: () => callCount,
  };
}

function generationErrorOf(call: () => unknown): RuleError {
  let caught: unknown;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RuleError);
  return caught as RuleError;
}

describe("등급별 지도 수치", () => {
  it.each([
    ["C", 4, 7, 2, 1],
    ["B", 5, 9, 3, 1],
    ["A", 6, 11, 4, 2],
    ["S", 7, 13, 5, 2],
  ] as const)(
    "%s급은 경로 %i칸·지점 %i개·정보 %i회·보스 보장 %i회다",
    (grade, pathLength, eventNodes, info, bossInfo) => {
      const map = mapOf(grade, `수치-${grade}`);

      expect(map.grade).toBe(grade);
      expect(map.nodes).toHaveLength(eventNodes + 2);
      expect(map.regularEventCount).toBe(pathLength);
      expect(map.infoCount).toBe(info);
      expect(map.bossRelatedInfoCount).toBe(bossInfo);
    },
  );

  it("등급 설정의 지점 수가 경로 길이보다 많아 갈래가 생긴다", () => {
    for (const grade of GRADES) {
      const config = CAMPAIGN_GRADE_CONFIG[grade];
      expect(config.eventNodeCount).toBeGreaterThan(config.pathLength);
    }
  });
});

describe("층 구조", () => {
  it("어느 길로 가도 사건을 같은 횟수만큼 지난다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 20; index += 1) {
        const map = mapOf(grade, `동일-${grade}-${index}`);
        const lengths = new Set(
          // 입구와 보스방을 뺀 수가 실제로 겪는 사건 수다.
          walkAll(map).map((route) => route.length - 2),
        );

        expect(lengths).toEqual(new Set([map.regularEventCount]));
      }
    }
  });

  it("간선은 깊이를 정확히 1씩 늘린다", () => {
    for (const grade of GRADES) {
      const map = mapOf(grade, `깊이-${grade}`);
      const byId = nodesById(map);

      for (const node of map.nodes) {
        for (const next of node.nextNodeIds) {
          expect(byId.get(next as string)!.depth).toBe(node.depth + 1);
        }
      }
    }
  });

  it("한 지점의 다음 선택지는 최대 2개다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 20; index += 1) {
        for (const node of mapOf(grade, `선택지-${grade}-${index}`).nodes) {
          expect(node.nextNodeIds.length).toBeLessThanOrEqual(MAX_NEXT_NODES);
          expect(new Set(node.nextNodeIds.map(String)).size)
            .toBe(node.nextNodeIds.length);
        }
      }
    }
  });

  it("층 너비가 1에서 3 사이다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 20; index += 1) {
        const map = mapOf(grade, `너비-${grade}-${index}`);
        const config = CAMPAIGN_GRADE_CONFIG[grade];

        for (let depth = 1; depth <= config.pathLength; depth += 1) {
          const width = layers(map).get(depth)!.length;
          expect(width).toBeGreaterThanOrEqual(1);
          expect(width).toBeLessThanOrEqual(MAX_LAYER_WIDTH);
        }
      }
    }
  });

  it("모든 지점이 입구에서 닿고 보스방으로 이어진다", () => {
    for (const grade of GRADES) {
      const map = mapOf(grade, `연결-${grade}`);
      const byId = nodesById(map);
      const seen = new Set<string>();
      const stack = [map.entryNodeId as string];
      while (stack.length > 0) {
        const id = stack.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        for (const next of byId.get(id)!.nextNodeIds) stack.push(next as string);
      }

      expect(seen.size).toBe(map.nodes.length);
      expect(map.nodes.filter((node) => node.nextNodeIds.length === 0)
        .map((node) => node.id)).toEqual([map.bossNodeId]);
    }
  });

  it("갈라졌다가 다시 합쳐지는 자리가 생긴다", () => {
    let merges = 0;
    let splits = 0;
    for (const grade of GRADES) {
      for (let index = 0; index < 20; index += 1) {
        const map = mapOf(grade, `합류-${grade}-${index}`);
        const incoming = new Map<string, number>();
        for (const node of map.nodes) {
          if (node.nextNodeIds.length > 1) splits += 1;
          for (const next of node.nextNodeIds) {
            incoming.set(next as string, (incoming.get(next as string) ?? 0) + 1);
          }
        }
        merges += [...incoming.values()].filter((count) => count > 1).length;
      }
    }

    expect(splits, "갈라지는 자리가 하나도 없다").toBeGreaterThan(0);
    expect(merges, "다시 합쳐지는 자리가 하나도 없다").toBeGreaterThan(0);
  });

  it("층 안의 열 번호가 0부터 이어진다", () => {
    const map = mapOf("S", "열번호");
    for (const [, layer] of layers(map)) {
      expect(layer.map((node) => node.column).sort((a, b) => a - b))
        .toEqual(layer.map((_, index) => index));
    }
  });
});

describe("사건 배치", () => {
  it("어느 길로 가도 네 분류를 최소 한 번씩 지난다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 15; index += 1) {
        const map = mapOf(grade, `분류-${grade}-${index}`);

        for (const route of walkAll(map)) {
          const kinds = new Set(
            route.map(kindOf).filter((kind): kind is EventKind => kind !== undefined),
          );
          expect(kinds).toEqual(new Set(EVENT_KINDS));
        }
      }
    }
  });

  it("자유 깊이가 있어 갈래마다 만나는 사건이 갈릴 수 있다", () => {
    // 보장 깊이는 네 곳뿐이므로 S급 11층에는 자유 깊이가 일곱 곳 남는다.
    const differing = Array.from({ length: 20 }, (_, index) => {
      const map = mapOf("S", `편차-${index}`);
      return [...layers(map)].some(([depth, layer]) =>
        depth >= 1 && layer.length > 1 && new Set(layer.map(kindOf)).size > 1);
    });

    expect(differing.some(Boolean), "모든 층의 분류가 통일돼 있다").toBe(true);
  });

  it("한 지도 안에서 같은 사건을 두 번 쓰지 않는다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 20; index += 1) {
        const ids = mapOf(grade, `중복-${grade}-${index}`).nodes
          .map((node) => node.eventId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  it("입구는 전용 사건을 쓰고 일반 풀을 소비하지 않는다", () => {
    const map = mapOf("S", "입구사건");
    const entry = nodesById(map).get(map.entryNodeId as string)!;

    expect(entry.eventId).toBe(ENTRY_EVENT.id);
    expect(EVENT_BY_ID.has(entry.eventId as string)).toBe(false);
    expect(entry.hasInfoOpportunity).toBe(false);
  });

  it("보스 사건은 보스방에만 놓는다", () => {
    const bossIds = new Set(DUNGEON_EVENT_POOLS.boss.map((event) => event.id as string));
    for (const grade of GRADES) {
      const map = mapOf(grade, `보스사건-${grade}`);
      for (const node of map.nodes) {
        expect(bossIds.has(node.eventId as string)).toBe(node.id === map.bossNodeId);
      }
    }
  });
});

describe("정보 전달 기회", () => {
  it("같은 깊이의 지점은 정보 표시가 같다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 20; index += 1) {
        for (const [, layer] of layers(mapOf(grade, `표시-${grade}-${index}`))) {
          expect(new Set(layer.map((node) => node.hasInfoOpportunity)).size).toBe(1);
          expect(new Set(layer.map((node) => node.bossRelatedInfoCount)).size).toBe(1);
        }
      }
    }
  });

  it("어느 길로 가도 정보 횟수와 보스 보장이 같다", () => {
    for (const grade of GRADES) {
      const config = CAMPAIGN_GRADE_CONFIG[grade];
      for (let index = 0; index < 15; index += 1) {
        const map = mapOf(grade, `정보-${grade}-${index}`);

        for (const route of walkAll(map)) {
          expect(route.filter((node) => node.hasInfoOpportunity))
            .toHaveLength(config.infoOpportunityCount);
          expect(route.reduce((sum, node) => sum + node.bossRelatedInfoCount, 0))
            .toBe(config.bossRelatedInfoCount);
        }
      }
    }
  });

  it("보스 보장은 정보 기회가 있는 지점에만 붙는다", () => {
    for (const grade of GRADES) {
      for (const node of mapOf(grade, `보장-${grade}`).nodes) {
        expect(node.bossRelatedInfoCount).toBeLessThanOrEqual(1);
        if (node.bossRelatedInfoCount > 0) {
          expect(node.hasInfoOpportunity).toBe(true);
        }
      }
    }
  });
});

describe("재현성", () => {
  it("같은 시드는 같은 지도를 만든다", () => {
    for (const grade of GRADES) {
      expect(mapOf(grade, `재현-${grade}`)).toEqual(mapOf(grade, `재현-${grade}`));
    }
  });

  it("시드가 다르면 모양이나 배치가 달라진다", () => {
    const signatures = new Set(
      Array.from({ length: 30 }, (_, index) => {
        const map = mapOf("B", `변화-${index}`);
        return map.nodes
          .map((node) => `${node.id}:${node.eventId}:${node.nextNodeIds.join(",")}`)
          .join("|");
      }),
    );

    expect(signatures.size).toBeGreaterThan(1);
  });

  it("입력 콘텐츠 풀을 변경하지 않는다", () => {
    const before = structuredClone(DUNGEON_EVENT_POOLS);
    for (const grade of GRADES) mapOf(grade, `불변-${grade}`);

    expect(DUNGEON_EVENT_POOLS).toEqual(before);
  });
});

describe("생성 실패", () => {
  it("풀 용량이 등급 요구보다 적으면 거부한다", () => {
    const error = generationErrorOf(() =>
      generateGradeMap("S", createRng("부족").derive("map"), { eventPools: thinPools() }));

    expect(error.code).toBe("INVALID_GENERATION");
    expect(error.message).toMatch(/S급.*사건.*부족/);
  });

  it("분류가 통째로 빠진 풀은 사건 풀 검증에서 거부한다", () => {
    const pools = clonedPools();
    const empty = { ...pools, regular: { ...pools.regular, special: [] } };
    const error = generationErrorOf(() =>
      generateGradeMap("C", createRng("빈분류").derive("map"), { eventPools: empty }));

    expect(error.code).toBe("INVALID_GENERATION");
    expect(error.message).toMatch(/special/);
  });

  it("잘못된 풀은 난수를 소비하기 전에 거부한다", () => {
    const { rng, calls } = countingRng("소비-전");
    generationErrorOf(() => generateGradeMap("S", rng, { eventPools: thinPools() }));

    expect(calls()).toBe(0);
  });
});

describe("생성된 지도 검증", () => {
  it("정상 지도는 통과한다", () => {
    for (const grade of GRADES) {
      expect(() => validateGeneratedMap(mapOf(grade, `검증-${grade}`))).not.toThrow();
    }
  });

  it("지점 수가 등급과 다르면 거부한다", () => {
    const map = structuredClone(mapOf("C", "지점수"));
    map.nodes.pop();

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/지점 수/);
  });

  it("깊이를 건너뛰는 간선을 거부한다", () => {
    const map = structuredClone(mapOf("C", "건너뜀"));
    const entry = map.nodes.find((node) => node.id === map.entryNodeId)!;
    entry.nextNodeIds = [map.bossNodeId];

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/깊이/);
  });

  it("선택지가 셋인 지점을 거부한다", () => {
    const map = structuredClone(mapOf("S", "선택지셋"));
    const wide = map.nodes.find((node) => node.depth === 1)!;
    const nextLayer = map.nodes.filter((node) => node.depth === 2).map((node) => node.id);
    if (nextLayer.length < 3) return;
    wide.nextNodeIds = nextLayer.slice(0, 3);

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/다음 지점/);
  });

  it("한 깊이의 정보 표시가 갈리면 거부한다", () => {
    const map = structuredClone(mapOf("S", "표시갈림"));
    const layer = [...layers(map)].find(
      ([depth, nodes]) => depth >= 1 && nodes.length > 1 && nodes[0].hasInfoOpportunity,
    );
    if (layer === undefined) return;
    map.nodes.find((node) => node.id === layer[1][0].id)!.hasInfoOpportunity = false;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message)
      .toMatch(/정보 표시|정보 전달/);
  });

  it("보스 관련 보장이 모자라면 거부한다", () => {
    const map = structuredClone(mapOf("S", "보장수"));
    for (const node of map.nodes) node.bossRelatedInfoCount = 0;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/보스/);
  });

  it("사건이 중복되면 거부한다", () => {
    const map = structuredClone(mapOf("B", "사건중복"));
    map.nodes[1].eventId = map.nodes[2].eventId;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/중복/);
  });

  it("경로가 끊기면 거부한다", () => {
    const map = structuredClone(mapOf("C", "단절"));
    map.nodes.find((node) => node.depth === 1)!.nextNodeIds = [];

    expect(generationErrorOf(() => validateGeneratedMap(map)).message)
      .toMatch(/보스방|도달|끊/);
  });
});

describe("다수 시드 불변식", () => {
  // 상위 plan Task 5가 요구하는 10,000개 지도 시드를 네 등급에 고르게 나눈다.
  it("등급별 2,500개 시드에서 구조 불변식이 모두 성립한다", () => {
    for (const grade of GRADES) {
      const config = CAMPAIGN_GRADE_CONFIG[grade];
      for (let index = 0; index < 2_500; index += 1) {
        const map = mapOf(grade, `불변식-${grade}-${index}`);

        expect(() => validateGeneratedMap(map)).not.toThrow();
        expect(map.nodes).toHaveLength(config.eventNodeCount + 2);
        expect(map.regularEventCount).toBe(config.pathLength);
      }
    }
    // 단독 실행은 빠르지만 전체 스위트가 파일을 병렬로 돌리면 기본 5초 제한에
    // 걸린다. 시드 수는 상위 plan이 정한 값이므로 줄이지 않는다.
  }, 60_000);
});
