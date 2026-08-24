import { describe, expect, it } from "vitest";
import { ENDING_ORDER } from "@/lib/domain";
import type { EndingKind } from "@/lib/domain";
import { ENDING_SEAL_TONE, ENDING_TITLE, endingCrestSrc, isNormalCompletion } from "./u6-ending-model";

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

  /*
   * 실패한 판에 훈장을 주지 않는다.
   *
   * 다섯 결말에 업적 문양 넷을 나눠 쓰고 있었다. 그러면 실직에 길드 훈장이,
   * 인력 소진에 귀환 훈장이 걸려 상을 받은 것처럼 읽힌다. 업적 문양은 완주한
   * 판의 「주요 업적」 칸이 쓰는 것이다.
   *
   * 끝난 판에 남는 것은 길드가 찍은 판결이다. 인주 하나를 쓰고 색으로 가른다.
   */
  it("결말의 문양은 훈장이 아니라 인주다", () => {
    for (const kind of ENDING_ORDER) {
      expect(endingCrestSrc(kind as EndingKind)).toMatch(/emblems\/wax_seal\.png$/);
      expect(endingCrestSrc(kind as EndingKind)).not.toContain("achievement");
    }
  });

  /* 색이 결말을 가른다. 같은 그림이 다섯 번 나오면 무엇이 다른지 알 수 없다. */
  it("결말마다 인주 색이 다르다", () => {
    const tones = ENDING_ORDER.map((kind) => ENDING_SEAL_TONE[kind as EndingKind]);

    expect(new Set(tones).size).toBeGreaterThan(2);
    expect(ENDING_SEAL_TONE.completed).not.toBe(ENDING_SEAL_TONE.denounced);
  });
});
