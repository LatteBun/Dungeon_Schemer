import { describe, expect, it } from "vitest";
import {
  U1_PREVIEW_SCREEN_IDS,
  U1_PREVIEW_SCREENS,
  U1_PREVIEW_STATUS,
} from "./u1-preview-data";

describe("U1 프리뷰 정의", () => {
  it("다섯 화면을 고정된 순서로 제공한다", () => {
    expect(U1_PREVIEW_SCREEN_IDS).toEqual([
      "intro",
      "board",
      "map",
      "progress",
      "settlement",
    ]);
    expect(new Set(U1_PREVIEW_SCREEN_IDS).size).toBe(5);
    expect(U1_PREVIEW_SCREENS).toHaveLength(5);
  });

  it("인트로 외 화면은 우측 패널 문구를 가진다", () => {
    const violations = U1_PREVIEW_SCREENS.flatMap((screen) => [
      screen.label.length === 0 ? `${screen.id}:label` : null,
      screen.mainTitle.length === 0 ? `${screen.id}:mainTitle` : null,
      screen.mainDescription.length === 0 ? `${screen.id}:mainDescription` : null,
      screen.id !== "intro" && screen.rightTitle === null
        ? `${screen.id}:rightTitle`
        : null,
    ].filter((value): value is string => value !== null));

    expect(violations).toEqual([]);
  });

  it("상태 fixture는 공통 상태 표시값을 제공한다", () => {
    expect(U1_PREVIEW_STATUS).toMatchObject({
      rank: "B",
      reputation: expect.any(Number),
      gold: expect.any(Number),
      canPromote: expect.any(Boolean),
      remainingDungeons: expect.any(Number),
    });
  });
});
