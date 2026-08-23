import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initializeCampaign } from "@/lib/rules/campaign-init";
import { U3Preview, applyPreviewPromotion } from "./U3Preview";

describe("U3Preview", () => {
  it("C2 실제 공고를 사용해 파티·계약 상세을 렌더링한다", () => {
    const html = renderToStaticMarkup(createElement(U3Preview));

    expect(html).toContain("길드 게시판");
    expect((html.match(/data-testid=\"u3-notice\"/g) ?? []).length).toBeGreaterThan(0);
    expect((html.match(/data-testid=\"u3-notice\"/g) ?? []).length).toBeLessThanOrEqual(5);
    expect(html).not.toContain("환경 특성");
    expect((html.match(/data-testid=\"u3-party-member\"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("전원 생존 시");
    expect(html).toContain("전원 사망 시");
    expect(html).not.toContain("답사 기록");
    expect(html).not.toContain("정찰 보고");
    expect(html).not.toContain("의뢰 갱신");
    expect(html).not.toContain("소요 시간");
  });

  it("승급 확정 뒤 C2 공고를 새 등급으로 다시 만든다", () => {
    const campaign = {
      ...initializeCampaign("u3-promotion-preview"),
      phase: "promotion" as const,
      reputation: 60,
    };
    const execution = applyPreviewPromotion(campaign, "reputation");

    expect(execution.campaign.rank).toBe("B");
    expect(execution.result.newlyUnlockedRiskLevel).toBe(3);
    expect(execution.campaign.offers.some((offer) => offer.riskLevel === 3 && offer.lockReason === null)).toBe(true);
  });
});
