import { describe, expect, it } from "vitest";
import { presentShuffledAdvice } from "@/lib/rules/advice-evaluation";
import { eventsForTheme } from "@/lib/content/event-registry";
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { countEmergencyEligibleAdventurers } from "@/lib/rules/ending";
import { U5_PREVIEW_ENTRIES, U5_PREVIEW_SOURCE } from "./u5-preview-data";

/**
 * 프리뷰가 값을 지어내지 않고 실제 규칙을 거친다는 것을 고정한다.
 *
 * U6 는 선행이 하나도 없어 전부 지어냈지만, U5 는 E2 가 완료돼 있다. 조언
 * 순서와 반응이 화면 사정이 아니라 규칙에서 와야 한다.
 */

describe("U5 프리뷰 데이터", () => {
  it("상태 바의 누적 고발 기준은 도메인 상수와 같다", () => {
    for (const entry of U5_PREVIEW_ENTRIES) {
      expect(entry.status.zeroTrust.threshold).toBe(DENOUNCE_THRESHOLD);
      expect(Number.isInteger(entry.status.remainingAdventurers)).toBe(true);
      expect(entry.status.remainingAdventurers).toBeGreaterThanOrEqual(0);
      expect(entry.status.remainingAdventurers)
        .toBe(countEmergencyEligibleAdventurers(U5_PREVIEW_SOURCE.campaign));
    }
  });

  it("아홉 상태를 담는다", () => {
    expect(U5_PREVIEW_ENTRIES).toHaveLength(9);
    expect(new Set(U5_PREVIEW_ENTRIES.map((entry) => entry.id)).size).toBe(9);
  });

  it("조언은 항상 세 개다", () => {
    for (const entry of U5_PREVIEW_ENTRIES) {
      expect(entry.progress.advice).toHaveLength(3);
      expect(entry.progress.advice.map((one) => one.slot)).toEqual([0, 1, 2]);
    }
  });

  /* 화면이 다시 섞으면 같은 seed 에서 다른 순서가 나온다. */
  it("조언 순서를 화면이 아니라 E2 가 정한다", () => {
    const before = U5_PREVIEW_ENTRIES.find((entry) => entry.id === "monster-before");

    /* 프리뷰가 실제로 쓴 입력을 그대로 본다. 여기서 다시 지어내면 프리뷰가
     * 바뀌어도 검사는 옛 입력으로 통과한다. */
    const presented = presentShuffledAdvice({
      campaignSeed: U5_PREVIEW_SOURCE.seed,
      dungeonId: U5_PREVIEW_SOURCE.dungeonId,
      attempt: U5_PREVIEW_SOURCE.attempt,
      depth: U5_PREVIEW_SOURCE.samples.monster.depth,
      event: U5_PREVIEW_SOURCE.samples.monster.event,
    });

    expect(before?.progress.advice.map((one) => one.text)).toEqual(
      presented.map((one) => one.label),
    );
  });

  it("선택 전 상태는 결과를 담지 않는다", () => {
    const before = U5_PREVIEW_ENTRIES.find((entry) => entry.id === "monster-before");

    expect(before?.progress.outcome).toBeNull();
  });

  it("선택 후 상태는 살아 있는 파티원 수만큼 반응을 담는다", () => {
    const after = U5_PREVIEW_ENTRIES.find((entry) => entry.id === "monster-after");

    expect(after?.progress.outcome?.reactions.length).toBe(after?.progress.party.length);
  });

  it("생태 목록이 위험도에 따라 공개된 규칙만 담는다", () => {
    for (const entry of U5_PREVIEW_ENTRIES) {
      // 위험도 1~2 는 3개, 3~4 는 2개, 5 는 1개다. 활성 규칙 3개를 넘지 않는다.
      expect(entry.ecology.disclosedRules.length).toBeGreaterThan(0);
      expect(entry.ecology.disclosedRules.length).toBeLessThanOrEqual(3);
    }
  });

  it("관찰 단서를 확인된 생태에 섞지 않는다", () => {
    for (const entry of U5_PREVIEW_ENTRIES) {
      for (const clue of entry.ecology.observedClues) {
        expect(entry.ecology.disclosedRules).not.toContain(clue);
      }
    }
  });

  it("어느 상태에서도 조언 식별자가 새지 않는다", () => {
    const ids = eventsForTheme("spider").flatMap((event) => event.advice.map((one) => one.id));
    const serialized = JSON.stringify(U5_PREVIEW_ENTRIES);

    for (const id of ids) {
      expect(serialized).not.toContain(id);
    }
  });
});
