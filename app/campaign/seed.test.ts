import { describe, expect, it, vi } from "vitest";
import { resolveCampaignSeed } from "./seed";

describe("resolveCampaignSeed", () => {
  it("유효한 명시적 시드는 새 시드를 만들지 않고 보존한다", () => {
    const generateSeed = vi.fn(() => "generated-seed");
    expect(resolveCampaignSeed("replay-184", generateSeed)).toBe("replay-184");
    expect(generateSeed).not.toHaveBeenCalled();
  });

  it.each([undefined, "", ["replay-184"]])("기본 진입 값 %j은 새 시드를 만든다", (seed) => {
    const generateSeed = vi.fn(() => "generated-seed");
    expect(resolveCampaignSeed(seed, generateSeed)).toBe("generated-seed");
    expect(generateSeed).toHaveBeenCalledTimes(1);
  });

  it("각 기본 진입은 호출자가 만든 새 시드를 그대로 사용한다", () => {
    const generateSeed = vi.fn().mockReturnValueOnce("generated-seed-one").mockReturnValueOnce("generated-seed-two");
    expect(resolveCampaignSeed(undefined, generateSeed)).toBe("generated-seed-one");
    expect(resolveCampaignSeed(undefined, generateSeed)).toBe("generated-seed-two");
  });
});
