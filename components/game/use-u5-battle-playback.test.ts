import { describe, expect, it } from "vitest";
import {
  nextU5BattleFrameIndex,
  nextU5BattleFrameIndexForLength,
  nextU5BattlePlaybackRate,
  u5BattleFrameDurationMs,
  u5BattlePlaybackForSignature,
  u5ReplaySignature,
} from "./use-u5-battle-playback";
import { U5_TEST_BATTLE_REPLAY } from "./u5-battle-test-fixture";

describe("u5 battle playback", () => {
  it.each([
    ["idle", 500, 250],
    ["attack", 360, 180],
    ["impact", 420, 210],
    ["settle", 520, 260],
    ["complete", 0, 0],
  ] as const)("%s phase는 ×1/×2에서 정해진 wait를 쓴다", (phase, atOne, atTwo) => {
    expect(u5BattleFrameDurationMs(phase, 1)).toBe(atOne);
    expect(u5BattleFrameDurationMs(phase, 2)).toBe(atTwo);
  });

  it("새 replay signature는 frame만 처음으로 돌린다", () => {
    expect(u5BattlePlaybackForSignature(
      { signature: "before", frameIndex: 4 },
      "after",
    )).toEqual({ signature: "after", frameIndex: 0 });
  });

  it("같은 replay signature는 현재 frame을 유지한다", () => {
    const playback = { signature: "same", frameIndex: 0 } as const;

    expect(u5BattlePlaybackForSignature(playback, "same")).toBe(playback);
  });

  it.each([
    [1, 2],
    [2, 1],
  ] as const)("전투 속도 %d를 누르면 %d가 된다", (current, expected) => {
    expect(nextU5BattlePlaybackRate(current)).toBe(expected);
  });

  it("다음 frame 계산은 replay 객체가 아니라 frame 수만 사용한다", () => {
    expect(nextU5BattleFrameIndexForLength(U5_TEST_BATTLE_REPLAY.frames.length, 1)).toBe(2);
    expect(nextU5BattleFrameIndexForLength(U5_TEST_BATTLE_REPLAY.frames.length, 99))
      .toBe(U5_TEST_BATTLE_REPLAY.frames.length - 1);
  });

  it("같은 내용의 새 객체는 같은 signature를 가진다", () => {
    expect(u5ReplaySignature(U5_TEST_BATTLE_REPLAY))
      .toBe(u5ReplaySignature({ ...U5_TEST_BATTLE_REPLAY }));
  });

  it("마지막 frame을 넘지 않는다", () => {
    const last = U5_TEST_BATTLE_REPLAY.frames.length - 1;
    expect(nextU5BattleFrameIndex(U5_TEST_BATTLE_REPLAY, last)).toBe(last);
  });

  it("replay가 없으면 빈 signature다", () => {
    expect(u5ReplaySignature(undefined)).toBe("none");
  });

  it("frame 행동 내용이 바뀌면 새 replay로 식별한다", () => {
    const changed = {
      ...U5_TEST_BATTLE_REPLAY,
      frames: U5_TEST_BATTLE_REPLAY.frames.map((frame, index) => index === 1
        ? { ...frame, damage: (frame.damage ?? 0) + 1 }
        : frame),
    };
    expect(u5ReplaySignature(changed)).not.toBe(u5ReplaySignature(U5_TEST_BATTLE_REPLAY));
  });

  it("frame cue가 바뀌면 새 replay로 식별한다", () => {
    const changed = {
      ...U5_TEST_BATTLE_REPLAY,
      frames: U5_TEST_BATTLE_REPLAY.frames.map((frame, index) => index === 0
        ? {
            ...frame,
            cues: [{
              characterId: "party-1",
              axis: "targetWeight" as const,
              direction: "beneficial" as const,
              presentationKey: "boss-info.target-weight.beneficial",
            }],
          }
        : frame),
    };

    expect(u5ReplaySignature(changed)).not.toBe(u5ReplaySignature(U5_TEST_BATTLE_REPLAY));
  });

  it("참가자 표현 정보가 바뀌면 새 replay로 식별한다", () => {
    const changed = {
      ...U5_TEST_BATTLE_REPLAY,
      participants: U5_TEST_BATTLE_REPLAY.participants.map((participant, index) => index === 0
        ? { ...participant, name: "바뀐 코르빈" }
        : participant),
    };

    expect(u5ReplaySignature(changed)).not.toBe(u5ReplaySignature(U5_TEST_BATTLE_REPLAY));
  });
});
