import { describe, expect, it } from "vitest";
import { normalizePreviewSeed } from "@/app/state-preview/preview-seed";

describe("상태 미리보기 seed 입력", () => {
  it("앞뒤 공백을 제거한 seed를 반환한다", () => {
    expect(normalizePreviewSeed("  manual-seed  ")).toBe("manual-seed");
  });

  it("공백만 있는 seed는 거부한다", () => {
    expect(normalizePreviewSeed(" \n\t ")).toBeNull();
  });
});
