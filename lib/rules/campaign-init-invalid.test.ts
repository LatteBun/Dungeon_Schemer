import { describe, expect, it, vi } from "vitest";
import type { RuleError } from "@/lib/domain";

describe("initializeCampaign 생성 오류", () => {
  it("테마·위험도별 생태 패키지가 부족하면 INVALID_GENERATION으로 중단한다", async () => {
    vi.resetModules();
    vi.doMock("@/lib/content/campaign-dungeons", () => ({
      INITIAL_DUNGEON_SLOTS: [
        ...Array.from({ length: 15 }, (_, index) => ({
          id: `dungeon-spider-${String(index + 1).padStart(2, "0")}`,
          name: `거미굴 ${index + 1}`,
          theme: "spider",
          initialRiskLevel: 1,
        })),
      ],
    }));
    vi.doMock("@/lib/content/themes", () => ({
      THEMES: [
        {
          id: "spider",
          ecologyProfiles: [],
          bosses: [],
        },
      ],
      selectThemeBoss: vi.fn(),
    }));

    const { initializeCampaign } = await import("@/lib/rules/campaign-init");

    try {
      initializeCampaign("c1-invalid-content");
      throw new Error("INVALID_GENERATION이 발생하지 않았다");
    } catch (error) {
      expect(error).toHaveProperty("code", "INVALID_GENERATION");
      expect((error as RuleError).details).toMatchObject({
        theme: "spider",
        initialRiskLevel: 1,
        expected: 15,
        actual: 0,
      });
    } finally {
      vi.doUnmock("@/lib/content/campaign-dungeons");
      vi.doUnmock("@/lib/content/themes");
      vi.resetModules();
    }
  });
});
