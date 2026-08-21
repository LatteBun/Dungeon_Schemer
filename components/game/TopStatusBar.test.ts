import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TopStatusBar } from "./TopStatusBar";

const baseStatus = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingDungeons: 15,
};

describe("TopStatusBar U2/U3", () => {
  it("상태 아이콘은 기존 U2 자산과 에셋보드 남은 던전 PNG를 함께 사용한다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, { status: baseStatus }));
    for (const asset of [
      "status-rank.svg",
      "status-reputation.svg",
      "status-gold.svg",
      "status-promotion.svg",
    ]) {
      expect(html).toContain(`/assets/u2/${asset}`);
    }
    expect(html).toContain("/assets/u3/extracted/status-dungeon.png");
    expect(html).not.toContain("/assets/u2/status-dungeon.svg");
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("영구 등급");
    expect(html).toContain("현재 명성");
  });

  it("다음 승급 정보가 있으면 현재 명성과 목표를 함께 표시한다", () => {
    const html = renderToStaticMarkup(
      createElement(TopStatusBar, {
        status: {
          ...baseStatus,
          nextPromotion: { rank: "B", reputationRequired: 60 },
        },
      }),
    );
    expect(html).toContain("30 / B 60");
  });

  it("다음 승급 정보가 없으면 기존 승급 문구를 유지한다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, { status: baseStatus }));
    expect(html).toContain("승급 조건 미달");
  });
});
