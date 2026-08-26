import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import {
  U1_PREVIEW_CHOICES,
  U1_PREVIEW_NOTICES,
  U1_PREVIEW_PARTY,
  U1_PREVIEW_PATH_NODES,
  U1_PREVIEW_SCREEN_IDS,
  U1_PREVIEW_SCREENS,
  U1_PREVIEW_SETTLEMENT_STEPS,
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

  it("레퍼런스 프리뷰 fixture는 비어 있거나 끊어진 정보를 만들지 않는다", () => {
    const partyIds = new Set(U1_PREVIEW_PARTY.map((member) => member.id));
    const violations = [
      ...U1_PREVIEW_PARTY.flatMap((member) => [
        member.name.length === 0 ? `${member.id}:name` : null,
        member.role.length === 0 ? `${member.id}:role` : null,
        member.currentHp <= 0 || member.maxHp <= 0 ? `${member.id}:hp` : null,
      ]),
      new Set(U1_PREVIEW_PARTY.map((member) => member.id)).size !== U1_PREVIEW_PARTY.length
        ? "party:duplicate-id"
        : null,
      ...U1_PREVIEW_NOTICES.flatMap((notice) => [
        notice.title.length === 0 ? `${notice.id}:title` : null,
        notice.riskLevel <= 0 ? `${notice.id}:risk` : null,
        notice.partyIds.some((partyId) => !partyIds.has(partyId))
          ? `${notice.id}:party`
          : null,
      ]),
      new Set(U1_PREVIEW_NOTICES.map((notice) => notice.id)).size !== U1_PREVIEW_NOTICES.length
        ? "notice:duplicate-id"
        : null,
      ...U1_PREVIEW_PATH_NODES.flatMap((node) =>
        node.label.length === 0 || node.state.length === 0 ? `${node.id}:label` : null,
      ),
      new Set(U1_PREVIEW_PATH_NODES.map((node) => node.id)).size !== U1_PREVIEW_PATH_NODES.length
        ? "path:duplicate-id"
        : null,
      ...U1_PREVIEW_CHOICES.map((choice) =>
        choice.title.length === 0 ? `${choice.id}:title` : null,
      ),
      ...U1_PREVIEW_SETTLEMENT_STEPS.map((step) =>
        step.label.length === 0 || step.reason.length === 0 ? `${step.id}:reason` : null,
      ),
    ].filter((value): value is string => value !== null);

    expect(violations).toEqual([]);
  });

  it("상태 fixture는 공통 상태 표시값을 제공한다", () => {
    expect(U1_PREVIEW_STATUS).toMatchObject({
      rank: "B",
      reputation: expect.any(Number),
      gold: expect.any(Number),
      canPromote: expect.any(Boolean),
      remainingAdventurers: expect.any(Number),
      remainingDungeons: expect.any(Number),
      zeroTrust: {
        livingCount: expect.any(Number),
        threshold: DENOUNCE_THRESHOLD,
      },
    });
    expect(U1_PREVIEW_STATUS.remainingAdventurers).toBe(12);
    expect(U1_PREVIEW_STATUS.zeroTrust).toEqual({
      livingCount: 7,
      threshold: DENOUNCE_THRESHOLD,
    });
    expect(Number.isInteger(U1_PREVIEW_STATUS.remainingAdventurers)).toBe(true);
    expect(U1_PREVIEW_STATUS.remainingAdventurers).toBeGreaterThanOrEqual(0);
    expect(U1_PREVIEW_STATUS.currentDungeon?.name).toBe("자카르의 불탄 우물");
  });
});
