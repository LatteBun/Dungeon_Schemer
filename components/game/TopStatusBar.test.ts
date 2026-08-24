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
    /* 「영구」는 무엇에 견주어 영구한지를 말하지 않는다. 길잡이의 등급이다. */
    expect(html).toContain("길잡이 등급");
    expect(html).toContain("현재 명성");
  });

  /*
   * 얼마나 남았는지를 적는다.
   *
   * 전에는 "30 / B 60" 이었다. 앞의 30 은 옆 칸의 현재 명성을 되풀이한 것이고,
   * 두 숫자의 관계도 슬래시로는 읽히지 않았다.
   */
  it("승급까지 얼마나 남았는지 적는다", () => {
    const html = renderToStaticMarkup(
      createElement(TopStatusBar, {
        status: {
          ...baseStatus,
          nextPromotion: { rank: "B", reputationRequired: 60 },
        },
      }),
    );
    expect(html).toContain("B까지 명성 30 더");
    /* 옆 칸의 현재 명성을 되풀이하지 않는다. */
    expect(html).not.toContain("30 / B 60");
  });

  it("올릴 수 있으면 그렇게 적는다", () => {
    const html = renderToStaticMarkup(
      createElement(TopStatusBar, {
        status: { ...baseStatus, canPromote: true, nextPromotion: { rank: "B", reputationRequired: 60 } },
      }),
    );

    expect(html).toContain("B 승급 가능");
  });

  /* 더 올라갈 곳이 없으면 남은 거리를 말할 수 없다. */
  it("최고 등급이면 그렇게 적는다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, { status: baseStatus }));

    expect(html).toContain("최고 등급");
  });

  it("게시판에서만 등급 상태 칩을 승급 진입 버튼으로 바꾼다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: {
        ...baseStatus,
        canPromote: true,
        nextPromotion: { rank: "B", reputationRequired: 60 },
      },
      onOpenPromotion: () => undefined,
    }));

    expect(html).toContain('data-testid="u3-promotion-trigger"');
    expect(html).toContain('data-promotion-available="true"');
  });

  it("조건 미달이어도 다음 승급 목표를 확인할 수 있다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: {
        ...baseStatus,
        canPromote: false,
        nextPromotion: { rank: "B", reputationRequired: 60 },
      },
      onOpenPromotion: () => undefined,
    }));

    expect(html).toContain('data-testid="u3-promotion-trigger"');
    expect(html).toContain('data-promotion-available="false"');
    expect(html).not.toContain('disabled=""');
  });
});
