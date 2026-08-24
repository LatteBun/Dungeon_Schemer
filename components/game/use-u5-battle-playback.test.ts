import { describe, expect, it } from "vitest";
import { nextU5BattleFrameIndex, u5ReplaySignature } from "./use-u5-battle-playback";
import { U5_TEST_BATTLE_REPLAY } from "./u5-battle-test-fixture";

describe("u5 battle playback", () => {
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
});
