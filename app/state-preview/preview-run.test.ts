import { describe, expect, it } from "vitest";
import { createPreviewRun } from "@/app/state-preview/preview-run";
import { createRng } from "@/lib/rng";
import { generateParty } from "@/lib/rules/party";

describe("R1 연동 상태 미리보기", () => {
  it("party 독립 stream의 R1 파티를 RunState에 담는다", () => {
    const seed = "manual-seed";

    expect(createPreviewRun(seed).party).toEqual(
      generateParty(createRng(seed).derive("party")),
    );
  });

  it("서로 다른 seed는 서로 다른 preview 파티를 만든다", () => {
    expect(createPreviewRun("preview-a").party).not.toEqual(
      createPreviewRun("preview-b").party,
    );
  });
});
