import { describe, expect, it } from "vitest";
import { createE1TestSnapshot } from "@/app/e1-test/e1-test-snapshot";

const EXPECTED_BY_GRADE = {
  C: { nodes: 9, pathLength: 4, regular: 4, info: 2, bossInfo: 1 },
  B: { nodes: 11, pathLength: 5, regular: 5, info: 3, bossInfo: 1 },
  A: { nodes: 13, pathLength: 6, regular: 6, info: 4, bossInfo: 2 },
  S: { nodes: 15, pathLength: 7, regular: 7, info: 5, bossInfo: 2 },
} as const;

describe("E1 검증 snapshot", () => {
  it("네 등급 지도가 모두 불변식을 통과한다", () => {
    const snapshot = createE1TestSnapshot("alpha");

    expect(snapshot.seed).toBe("alpha");
    expect(snapshot.grades.map((grade) => grade.grade)).toEqual(["C", "B", "A", "S"]);
    for (const view of snapshot.grades) {
      const expected = EXPECTED_BY_GRADE[view.grade];

      expect(view.status).toBe("pass");
      expect(view.error).toBeUndefined();
      expect(view.pathLength).toBe(expected.pathLength);
      expect(view.checks.every((check) => check.pass)).toBe(true);
      expect(view.paths.length).toBeGreaterThan(0);
      for (const path of view.paths) {
        expect(path.regularEventCount).toBe(expected.regular);
        expect(path.infoCount).toBe(expected.info);
        expect(path.bossRelatedInfoCount).toBe(expected.bossInfo);
        expect(path.coversAllKinds).toBe(true);
        expect(path.nodeIds).toHaveLength(expected.pathLength + 2);
      }
    }
  });

  it("화면이 그리는 행은 보스방부터 입구까지 깊이 순으로 이어진다", () => {
    for (const view of createE1TestSnapshot("rows").grades) {
      const expected = EXPECTED_BY_GRADE[view.grade];
      const depths = view.rows.map((row) => row.depth);

      expect(depths).toEqual([...depths].sort((left, right) => right - left));
      expect(depths[0]).toBe(expected.pathLength + 1);
      expect(depths[depths.length - 1]).toBe(0);
      expect(view.rows.flatMap((row) => row.nodes)).toHaveLength(expected.nodes);
      expect(view.rows[0].nodes.map((node) => node.role)).toEqual(["boss"]);
      expect(view.rows[depths.length - 1].nodes.map((node) => node.role)).toEqual(["entry"]);
      // 입구와 보스방은 한 지점이고, 사건 층은 1~3개다.
      expect(view.rows[0].nodes).toHaveLength(1);
      expect(view.rows[depths.length - 1].nodes).toHaveLength(1);
      expect(view.rows.every((row) => row.nodes.length >= 1 && row.nodes.length <= 3))
        .toBe(true);
    }
  });

  it("의도적 실패 fixture는 모두 구조화된 생성 오류를 낸다", () => {
    const snapshot = createE1TestSnapshot("negative");

    expect(snapshot.negativeCases).toHaveLength(6);
    const failed = snapshot.negativeCases.filter((entry) =>
      !entry.pass || entry.errorCode !== "INVALID_GENERATION");
    expect(failed.map((entry) => `${entry.label}: ${entry.message ?? "오류 없음"}`)).toEqual([]);
  });

  it("같은 시드는 재현되고 다른 시드는 배치가 달라진다", () => {
    const first = createE1TestSnapshot("repeat");
    const second = createE1TestSnapshot("repeat");

    expect(first).toEqual(second);
    expect(first.reproducibility.sameSeed).toBe(true);
    expect(first.reproducibility.otherSeedDiffers).toBe(true);
  });
});
