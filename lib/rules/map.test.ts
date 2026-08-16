import { describe, expect, it } from "vitest";
import { CAMPAIGN_GRADE_CONFIG } from "@/lib/content/dungeons";
import {
  BOSS_RISK_SUMMARY,
  DUNGEON_EVENT_POOLS,
  EVENT_KIND_RISK_SUMMARY,
} from "@/lib/content/events";
import type { DungeonEventPools } from "@/lib/content/events";
import { EVENT_KINDS, GRADES, RuleError } from "@/lib/domain";
import type {
  EventKind,
  GeneratedMap,
  Grade,
  MapNode,
  MapPath,
} from "@/lib/domain";
import { createRng } from "@/lib/rng";
import type { Rng, RngStream } from "@/lib/rng";
import { generateGradeMap, validateGeneratedMap } from "@/lib/rules/map";

const EVENT_BY_ID = new Map(
  [
    ...EVENT_KINDS.flatMap((kind) => DUNGEON_EVENT_POOLS.regular[kind]),
    ...DUNGEON_EVENT_POOLS.boss,
  ].map((event) => [event.id as string, event]),
);

function mapOf(grade: Grade, seed: string): GeneratedMap {
  return generateGradeMap(grade, createRng(seed).derive("map"));
}

function kindOf(node: MapNode): EventKind {
  const event = EVENT_BY_ID.get(node.eventId);
  if (event === undefined) throw new Error(`풀에 없는 사건이다: ${node.eventId}`);
  return event.kind;
}

function nodesById(map: GeneratedMap): Map<string, MapNode> {
  return new Map(map.nodes.map((node) => [node.id as string, node]));
}

function nodeOf(map: GeneratedMap, id: string): MapNode {
  const node = nodesById(map).get(id);
  if (node === undefined) throw new Error(`없는 지점이다: ${id}`);
  return node;
}

function branchId(branch: number, depth: number): string {
  return `node-path-${branch}-depth-${depth}`;
}

function expectedAdjacency(branchLength: number): Record<string, string[]> {
  const adjacency: Record<string, string[]> = {
    "node-entry": [branchId(1, 1), branchId(2, 1)],
    "node-merge": ["node-boss"],
    "node-boss": [],
  };
  for (const branch of [1, 2]) {
    for (let depth = 1; depth <= branchLength; depth += 1) {
      adjacency[branchId(branch, depth)] = [
        depth === branchLength ? "node-merge" : branchId(branch, depth + 1),
      ];
    }
  }
  return adjacency;
}

function pathKinds(map: GeneratedMap, path: MapPath): EventKind[] {
  return path.nodeIds
    .filter((id) => id !== map.bossNodeId)
    .map((id) => kindOf(nodeOf(map, id)));
}

function clonedPools(): DungeonEventPools {
  return structuredClone(DUNGEON_EVENT_POOLS) as DungeonEventPools;
}

function poolsWithout(kind: EventKind, keep: number): DungeonEventPools {
  const pools = clonedPools();
  return {
    ...pools,
    regular: { ...pools.regular, [kind]: pools.regular[kind].slice(0, keep) },
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
    ["C", 7, 3, 2, 1],
    ["B", 9, 4, 3, 1],
    ["A", 11, 5, 4, 2],
    ["S", 13, 6, 5, 2],
  ] as const)(
    "%s급 지도는 전체 지점·일반 사건·정보·보스 보장 수를 만족한다",
    (grade, total, regular, info, bossInfo) => {
      const map = mapOf(grade, `수치-${grade}`);

      expect(map.grade).toBe(grade);
      expect(map.nodes).toHaveLength(total);
      expect(map.paths).toHaveLength(2);
      expect(map.paths.every((path) => path.regularEventCount === regular)).toBe(true);
      expect(map.paths.every((path) => path.infoCount === info)).toBe(true);
      expect(map.paths.every((path) => path.bossRelatedInfoCount === bossInfo)).toBe(true);
    },
  );

  it("등급 설정의 전체 지점 수는 갈래 길이에서 유도한 값과 같다", () => {
    for (const grade of GRADES) {
      const config = CAMPAIGN_GRADE_CONFIG[grade];
      expect(config.nodeCount).toBe(config.branchLength * 2 + 3);
    }
  });
});

describe("지도 구조", () => {
  it("입구에서 두 갈래로 나뉘고 합류를 거쳐 보스로 이어진다", () => {
    for (const grade of GRADES) {
      const map = mapOf(grade, `구조-${grade}`);
      const adjacency = Object.fromEntries(
        map.nodes.map((node) => [node.id as string, node.nextNodeIds as string[]]),
      );

      expect(adjacency).toEqual(expectedAdjacency(CAMPAIGN_GRADE_CONFIG[grade].branchLength));
      expect(map.entryNodeId).toBe("node-entry");
      expect(map.bossNodeId).toBe("node-boss");
    }
  });

  it("깊이는 입구 0에서 보스까지 단조 증가한다", () => {
    for (const grade of GRADES) {
      const map = mapOf(grade, `깊이-${grade}`);
      const byId = nodesById(map);

      expect(nodeOf(map, "node-entry").depth).toBe(0);
      expect(nodeOf(map, "node-boss").depth).toBe(CAMPAIGN_GRADE_CONFIG[grade].branchLength + 2);
      for (const node of map.nodes) {
        for (const next of node.nextNodeIds) {
          expect(byId.get(next as string)!.depth).toBeGreaterThan(node.depth);
        }
      }
    }
  });

  it("두 경로는 실제 간선을 따라 입구에서 보스까지 이어진다", () => {
    for (const grade of GRADES) {
      const map = mapOf(grade, `경로-${grade}`);
      const length = CAMPAIGN_GRADE_CONFIG[grade].branchLength + 3;

      for (const path of map.paths) {
        expect(path.nodeIds).toHaveLength(length);
        expect(path.nodeIds[0]).toBe(map.entryNodeId);
        expect(path.nodeIds[path.nodeIds.length - 1]).toBe(map.bossNodeId);
        for (let index = 0; index < path.nodeIds.length - 1; index += 1) {
          expect(nodeOf(map, path.nodeIds[index] as string).nextNodeIds)
            .toContain(path.nodeIds[index + 1]);
        }
      }
      expect(map.paths[0].nodeIds).not.toEqual(map.paths[1].nodeIds);
    }
  });

  it("보스방은 정보 기회가 없고 다음 지점도 없다", () => {
    for (const grade of GRADES) {
      const boss = nodeOf(mapOf(grade, `보스방-${grade}`), "node-boss");

      expect(boss.hasInfoOpportunity).toBe(false);
      expect(boss.bossRelatedInfoCount).toBe(0);
      expect(boss.nextNodeIds).toEqual([]);
      expect(boss.riskSummary).toBe(BOSS_RISK_SUMMARY);
    }
  });
});

describe("정보 전달 기회 배치", () => {
  it("갈래에 표시한 정보 기회는 양쪽이 같은 깊이에 대칭으로 놓인다", () => {
    for (const grade of GRADES) {
      const { branchLength } = CAMPAIGN_GRADE_CONFIG[grade];
      for (let index = 0; index < 40; index += 1) {
        const map = mapOf(grade, `대칭-${grade}-${index}`);
        for (let depth = 1; depth <= branchLength; depth += 1) {
          const first = nodeOf(map, branchId(1, depth));
          const second = nodeOf(map, branchId(2, depth));

          expect(first.hasInfoOpportunity).toBe(second.hasInfoOpportunity);
          expect(first.bossRelatedInfoCount).toBe(second.bossRelatedInfoCount);
        }
      }
    }
  });

  it("합류는 정보 기회 후보이며 입구에는 정보 기회가 없다", () => {
    const shared = new Set<string>();
    for (const grade of GRADES) {
      for (let index = 0; index < 40; index += 1) {
        const map = mapOf(grade, `공유-${grade}-${index}`);
        for (const id of ["node-merge"]) {
          if (nodeOf(map, id).hasInfoOpportunity) shared.add(id);
        }
      }
    }

    expect(shared).toEqual(new Set(["node-merge"]));
  });

  it("보스 보장 지점은 정보 기회가 있는 지점 안에서만 표시한다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 40; index += 1) {
        const map = mapOf(grade, `보장-${grade}-${index}`);
        for (const node of map.nodes) {
          expect(node.bossRelatedInfoCount).toBeLessThanOrEqual(1);
          if (node.bossRelatedInfoCount > 0) {
            expect(node.hasInfoOpportunity).toBe(true);
          }
        }
      }
    }
  });
});

describe("사건 배치", () => {
  it("모든 경로가 네 분류를 최소 한 번씩 지난다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 40; index += 1) {
        const map = mapOf(grade, `분류-${grade}-${index}`);
        for (const path of map.paths) {
          expect(new Set(pathKinds(map, path))).toEqual(new Set(EVENT_KINDS));
        }
      }
    }
  });

  it("한 지도 안에서 같은 사건을 두 번 쓰지 않는다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 40; index += 1) {
        const map = mapOf(grade, `중복-${grade}-${index}`);
        const eventIds = map.nodes.map((node) => node.eventId);

        expect(new Set(eventIds).size).toBe(eventIds.length);
      }
    }
  });

  it("입구와 합류는 서로 다른 분류를 쓴다", () => {
    for (const grade of GRADES) {
      for (let index = 0; index < 40; index += 1) {
        const map = mapOf(grade, `입구합류-${grade}-${index}`);

        expect(kindOf(nodeOf(map, "node-entry")))
          .not.toBe(kindOf(nodeOf(map, "node-merge")));
      }
    }
  });

  it("일반 지점의 위험 요약은 분류 문구를 그대로 쓴다", () => {
    const map = mapOf("S", "위험-요약");

    for (const node of map.nodes) {
      if (node.id === map.bossNodeId) continue;
      expect(node.riskSummary).toBe(EVENT_KIND_RISK_SUMMARY[kindOf(node)]);
    }
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

describe("재현성", () => {
  it("같은 시드는 같은 지도를 만든다", () => {
    for (const grade of GRADES) {
      expect(mapOf(grade, `재현-${grade}`)).toEqual(mapOf(grade, `재현-${grade}`));
    }
  });

  it("시드가 다르면 정보 위치나 사건 배치가 달라진다", () => {
    const signatures = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      const map = mapOf("C", `변화-${index}`);
      signatures.add(map.nodes
        .map((node) => `${node.eventId}:${node.hasInfoOpportunity ? 1 : 0}`)
        .join("|"));
    }

    expect(signatures.size).toBeGreaterThan(1);
  });

  it("입력 콘텐츠 풀을 변경하지 않는다", () => {
    const before = structuredClone(DUNGEON_EVENT_POOLS);
    for (const grade of GRADES) mapOf(grade, `불변-${grade}`);

    expect(DUNGEON_EVENT_POOLS).toEqual(before);
  });
});

describe("생성 실패", () => {
  it("풀 전체 용량이 등급 요구보다 적으면 거부한다", () => {
    const error = generationErrorOf(() =>
      generateGradeMap("S", createRng("부족").derive("map"), {
        eventPools: poolsWithout("monster", 2),
      }));

    expect(error.code).toBe("INVALID_GENERATION");
    expect(error.message).toMatch(/S급.*사건.*부족/);
  });

  it("분류가 통째로 빠진 풀은 사건 풀 검증에서 거부한다", () => {
    const error = generationErrorOf(() =>
      generateGradeMap("C", createRng("빈분류").derive("map"), {
        eventPools: poolsWithout("special", 0),
      }));

    expect(error.code).toBe("INVALID_GENERATION");
    expect(error.message).toMatch(/special/);
  });

  it("잘못된 풀은 난수를 소비하기 전에 거부한다", () => {
    const { rng, calls } = countingRng("소비-전");

    generationErrorOf(() =>
      generateGradeMap("S", rng, { eventPools: poolsWithout("rest", 2) }));

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

  it("경로별 정보 횟수가 어긋나면 거부한다", () => {
    const map = structuredClone(mapOf("A", "정보수"));
    const target = map.nodes.find((node) =>
      node.id === "node-path-1-depth-1" && node.hasInfoOpportunity)
      ?? map.nodes.find((node) => node.hasInfoOpportunity)!;
    target.hasInfoOpportunity = false;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/정보/);
  });

  it("보스 관련 보장이 모자라면 거부한다", () => {
    const map = structuredClone(mapOf("S", "보장수"));
    for (const node of map.nodes) node.bossRelatedInfoCount = 0;
    for (const path of map.paths) path.bossRelatedInfoCount = 0;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/보스/);
  });

  it("사건이 중복되면 거부한다", () => {
    const map = structuredClone(mapOf("B", "사건중복"));
    map.nodes[1].eventId = map.nodes[2].eventId;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/중복/);
  });

  it("경로가 끊기면 거부한다", () => {
    const map = structuredClone(mapOf("C", "단절"));
    nodeOf(map, "node-merge").nextNodeIds = [];

    expect(generationErrorOf(() => validateGeneratedMap(map)).message)
      .toMatch(/보스|도달|연결/);
  });

  it("경로에 빠진 분류가 있으면 거부한다", () => {
    const map = structuredClone(mapOf("C", "분류누락"));
    const entryKind = kindOf(nodeOf(map, "node-entry"));
    const used = new Set(map.nodes.map((node) => node.eventId as string));
    // 입구와 같은 분류의 미사용 사건으로 갈래 지점을 덮으면 그 경로에서
    // 원래 갈래가 맡던 분류 하나가 사라진다.
    const replacement = DUNGEON_EVENT_POOLS.regular[entryKind]
      .find((event) => !used.has(event.id as string));
    expect(replacement).toBeDefined();
    nodeOf(map, branchId(1, 1)).eventId = replacement!.id;

    expect(generationErrorOf(() => validateGeneratedMap(map)).message).toMatch(/분류/);
  });
});

describe("다수 시드 불변식", () => {
  // 상위 plan Task 5가 요구하는 10,000개 지도 시드를 네 등급에 고르게 나눈다.
  it("등급별 2,500개 시드에서 지점·경로·정보·보장 불변식이 모두 성립한다", () => {
    for (const grade of GRADES) {
      const config = CAMPAIGN_GRADE_CONFIG[grade];
      for (let index = 0; index < 2_500; index += 1) {
        const map = mapOf(grade, `불변식-${grade}-${index}`);

        expect(() => validateGeneratedMap(map)).not.toThrow();
        expect(map.nodes).toHaveLength(config.nodeCount);
        for (const path of map.paths) {
          expect(path.infoCount).toBe(config.infoOpportunityCount);
          expect(path.bossRelatedInfoCount).toBe(config.bossRelatedInfoCount);
      expect(path.regularEventCount).toBe(config.branchLength + 1);
        }
      }
    }
    // 단독 실행은 3초 아래지만 전체 스위트가 파일을 병렬로 돌리면 CPU를 나눠
    // 써서 기본 5초 제한에 걸린다. 시드 수는 상위 plan이 정한 값이므로 줄이지
    // 않고 이 테스트에만 여유를 준다.
  }, 30_000);
});
