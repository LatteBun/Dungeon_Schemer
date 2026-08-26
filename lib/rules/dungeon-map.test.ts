import { describe, expect, it } from "vitest";
import type { GeneratedMap, NodeId } from "@/lib/domain";
import { RuleError } from "@/lib/domain/errors";
import {
  MAP_TEMPLATES,
  generateDungeonMap,
  generateDungeonMapWithDiagnostics,
  validateGeneratedMap,
  validateMapTemplate,
  validateMapTemplates,
} from "@/lib/rules/dungeon-map";

describe("위험도별 지도 템플릿 계약", () => {
  it("16개 템플릿의 위험도별 개수와 폭 범위를 고정한다", () => {
    expect(MAP_TEMPLATES).toHaveLength(16);
    expect(new Set(MAP_TEMPLATES.map((template) => template.id)).size).toBe(16);

    for (const riskLevel of [1, 2, 3, 4, 5] as const) {
      const templates = MAP_TEMPLATES.filter((template) => template.riskLevel === riskLevel);
      expect(templates).toHaveLength(riskLevel === 4 ? 4 : 3);
      expect(templates.every((template) => template.layerWidths.length === ({ 1: 6, 2: 6, 3: 7, 4: 8, 5: 8 }[riskLevel]))).toBe(true);
      expect(templates.every((template) => template.layerWidths.every((width) => width >= 1 && width <= 5))).toBe(true);
    }
  });

  it("깨진 템플릿을 INVALID_GENERATION으로 거부한다", () => {
    expect(() =>
      validateMapTemplate({ id: "broken", riskLevel: 1, layerWidths: [1, 0, 2, 2, 2, 1] }),
    ).toThrowError(RuleError);
    expect(() =>
      validateMapTemplate({ id: "broken", riskLevel: 1, layerWidths: [1, 0, 2, 2, 2, 1] }),
    ).toThrow(/INVALID_GENERATION|폭/);
  });

  it("전체 템플릿 풀의 위험도별 수량을 검증한다", () => {
    expect(() => validateMapTemplates(MAP_TEMPLATES)).not.toThrow();
    expect(() => validateMapTemplates(MAP_TEMPLATES.slice(0, 15))).toThrow(/INVALID_GENERATION|템플릿/);
  });
});

describe("생성 지도 구조 검증", () => {
  it("인접 행의 불가피한 교차를 INVALID_GENERATION으로 거부한다", () => {
    const layers = Array.from({ length: 6 }, (_, index) => ({
      depth: index + 1,
      nodeIds: [0, 1].map((nodeIndex) => `normal-${index}-${nodeIndex}` as NodeId),
    }));
    const nodes: GeneratedMap["nodes"] = [
      { id: "entry" as NodeId, kind: "entry", nextNodeIds: layers[0]!.nodeIds },
      ...layers.flatMap((layer, index) => layer.nodeIds.map((id) => ({
        id,
        kind: "normal" as const,
        nextNodeIds: index === 0
          ? layers[1]!.nodeIds
          : index === layers.length - 1 ? ["boss" as NodeId] : layers[index + 1]!.nodeIds,
      }))),
      { id: "boss" as NodeId, kind: "boss", nextNodeIds: [] },
    ];
    const error = (() => {
      try { validateGeneratedMap({
      entryNodeId: "entry" as NodeId,
      bossNodeId: "boss" as NodeId,
      layers,
      nodes,
      }, 1); return undefined;
      } catch (caught) { return caught as RuleError; }
    })();
    expect(error).toBeInstanceOf(RuleError);
    expect(error?.code).toBe("INVALID_GENERATION");
    expect(error?.details.minimumCrossingCount).toBeGreaterThan(0);
    expect(error?.message).toContain("minimumCrossingCount");
  });

  it("진단 생성기는 지도와 선택 간선 산식을 함께 반환한다", () => {
    const input = { campaignSeed: "diagnostics", dungeonId: "dungeon-map-test" as never, initialRiskLevel: 3 as const, attempt: 0 };
    const result = generateDungeonMapWithDiagnostics(input);
    expect(result.map).toEqual(generateDungeonMap(input));
    expect(result.diagnostics.acceptedOptionalEdgeCount).toBeGreaterThanOrEqual(0);
    expect(result.diagnostics.baseEdgeCount).toBe(
      result.map.nodes.reduce((sum, node) => sum + node.nextNodeIds.length, 0)
        - result.diagnostics.acceptedOptionalEdgeCount,
    );
  });

  it("유령 NodeId를 참조하는 그래프를 거부한다", () => {
    const map: GeneratedMap = {
      entryNodeId: "entry" as NodeId,
      bossNodeId: "boss" as NodeId,
      layers: Array.from({ length: 6 }, (_, index) => ({
        depth: index + 1,
        nodeIds: [`normal-${index}` as NodeId],
      })),
      nodes: [
        { id: "entry" as NodeId, kind: "entry", nextNodeIds: ["ghost" as NodeId] },
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `normal-${index}` as NodeId,
          kind: "normal" as const,
          nextNodeIds: [index === 5 ? ("boss" as NodeId) : (`normal-${index + 1}` as NodeId)],
        })),
        { id: "boss" as NodeId, kind: "boss", nextNodeIds: [] },
      ],
    };

    expect(() => validateGeneratedMap(map, 1)).toThrowError(RuleError);
    expect(() => validateGeneratedMap(map, 1)).toThrow(/존재하지/);
  });

  it("일반 노드가 진행을 계속하지 못하는 그래프를 거부한다", () => {
    const map: GeneratedMap = {
      entryNodeId: "entry" as NodeId,
      bossNodeId: "boss" as NodeId,
      layers: Array.from({ length: 6 }, (_, index) => ({
        depth: index + 1,
        nodeIds: [`normal-${index}` as NodeId],
      })),
      nodes: [
        { id: "entry" as NodeId, kind: "entry", nextNodeIds: ["normal-0" as NodeId] },
        ...Array.from({ length: 6 }, (_, index) => ({
          id: `normal-${index}` as NodeId,
          kind: "normal" as const,
          nextNodeIds: index === 0 ? [] : [index === 5 ? ("boss" as NodeId) : (`normal-${index + 1}` as NodeId)],
        })),
        { id: "boss" as NodeId, kind: "boss", nextNodeIds: [] },
      ],
    };

    expect(() => validateGeneratedMap(map, 1)).toThrow(/차수/);
  });
});

describe("결정적 지도 생성", () => {
  it.each([1, 2, 3, 4, 5] as const)("위험도 %s의 여러 시드가 모든 구조 계약을 만족한다", (riskLevel) => {
    for (const campaignSeed of ["seed-a", "seed-b", "seed-c"]) {
      const map = generateDungeonMap({
        campaignSeed,
        dungeonId: "dungeon-map-test" as never,
        initialRiskLevel: riskLevel,
        attempt: 0,
      });
      expect(map.layers).toHaveLength({ 1: 6, 2: 6, 3: 7, 4: 8, 5: 8 }[riskLevel]);
      expect(() => validateGeneratedMap(map, riskLevel)).not.toThrow();
      expect(map.nodes.every((node) => node.nextNodeIds.length <= 2)).toBe(true);
    }
  });

  it("같은 입력은 완전히 같고 attempt는 템플릿을 순환시킨다", () => {
    const input = {
      campaignSeed: "campaign-seed",
      dungeonId: "dungeon-001" as never,
      initialRiskLevel: 4 as const,
      attempt: 0,
    };
    const first = generateDungeonMap(input);
    const same = generateDungeonMap(input);
    const retry = generateDungeonMap({ ...input, attempt: 1 });

    expect(same).toEqual(first);
    expect(retry).not.toEqual(first);
    expect(retry.nodes[0]?.id).toContain(":attempt:1:");
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("잘못된 attempt %s를 거부한다", (attempt) => {
    expect(() =>
      generateDungeonMap({
        campaignSeed: "campaign-seed",
        dungeonId: "dungeon-001" as never,
        initialRiskLevel: 4,
        attempt,
      }),
    ).toThrow(/지도 생성 입력/);
  });
});
