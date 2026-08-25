import { describe, expect, it } from "vitest";
import {
  advanceU5BattlePlayback,
  nextU5BattleFrameIndex,
  nextU5BattlePlaybackRate,
  replayU5BattlePlayback,
  shouldAdvanceU5BattleFrame,
  u5BattleFrameDurationMs,
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

  it.each([
    [1, 2],
    [2, 1],
  ] as const)("전투 속도 %d를 누르면 %d가 된다", (current, expected) => {
    expect(nextU5BattlePlaybackRate(current)).toBe(expected);
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

  it("playing이 false면 다음 frame을 예약하지 않는다", () => {
    expect(shouldAdvanceU5BattleFrame(U5_TEST_BATTLE_REPLAY.frames[0]!, false)).toBe(false);
    expect(shouldAdvanceU5BattleFrame(U5_TEST_BATTLE_REPLAY.frames[0]!, true)).toBe(true);
    expect(shouldAdvanceU5BattleFrame(U5_TEST_BATTLE_REPLAY.frames.at(-1)!, true)).toBe(false);
  });

  it("피드백이 끝난 뒤 다시 보기는 수동 재생 상태로 마지막 frame까지 진행한다", () => {
    const restarted = replayU5BattlePlayback(
      { signature: "same", frameIndex: U5_TEST_BATTLE_REPLAY.frames.length - 1, replayingFromStart: false },
      "same",
    );

    expect(restarted).toEqual({ signature: "same", frameIndex: 0, replayingFromStart: true });
    expect(shouldAdvanceU5BattleFrame(U5_TEST_BATTLE_REPLAY.frames[0]!, false, restarted.replayingFromStart))
      .toBe(true);

    let current = restarted;
    while (current.frameIndex < U5_TEST_BATTLE_REPLAY.frames.length - 1) {
      current = advanceU5BattlePlayback(current, "same", U5_TEST_BATTLE_REPLAY.frames.length);
    }
    expect(current.replayingFromStart).toBe(false);
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
