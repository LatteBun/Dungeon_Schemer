import { describe, expect, it } from "vitest";

describe("U5 프리뷰 prerender", () => {
  it("E1 지도 topology가 바뀌어도 실제 비수용 상태를 만든다", async () => {
    const preview = await import("./u5-preview-data").then(
      (module) => module,
      () => undefined,
    );

    expect(preview).toBeDefined();
    const unaccepted = preview?.U5_PREVIEW_ENTRIES.find(
      (entry) => entry.id === "monster-default",
    );
    expect(unaccepted?.progress.outcome?.reactions.every(
      (reaction) => reaction.reaction !== "accepted",
    )).toBe(true);
  });
});
