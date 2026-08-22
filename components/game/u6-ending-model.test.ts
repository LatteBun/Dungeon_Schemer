import { describe, expect, it } from "vitest";
import { ENDING_ORDER } from "@/lib/domain";
import type { EndingKind } from "@/lib/domain";
import { ENDING_TITLE, endingCrestSrc, isNormalCompletion } from "./u6-ending-model";

describe("U6 엔딩 화면 모델", () => {
  it("엔딩 5종이 모두 제목을 가진다", () => {
    for (const kind of ENDING_ORDER) {
      expect(ENDING_TITLE[kind as EndingKind]).toBeTruthy();
    }

    expect(Object.keys(ENDING_TITLE).sort()).toEqual([...ENDING_ORDER].sort());
  });

  it("제목이 서로 겹치지 않는다", () => {
    const titles = Object.values(ENDING_TITLE);

    expect(new Set(titles).size).toBe(titles.length);
  });

  /*
   * 던전 15개를 모두 클리어하면 C·B·A·S 어느 등급이든 정상 완주다. 등급이
   * 아니라 엔딩 종류가 완주 여부를 정한다.
   */
  it("completed 만 정상 완주다", () => {
    expect(isNormalCompletion("completed")).toBe(true);

    for (const kind of ENDING_ORDER.filter((k) => k !== "completed")) {
      expect(isNormalCompletion(kind as EndingKind)).toBe(false);
    }
  });

  it("엔딩마다 표제 문양 경로를 준다", () => {
    const paths = ENDING_ORDER.map((kind) => endingCrestSrc(kind as EndingKind));

    for (const path of paths) {
      expect(path).toMatch(/achievements\/achievement_[a-z]+\.png$/);
    }
  });
});
