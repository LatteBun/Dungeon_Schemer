import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DENOUNCE_THRESHOLD } from "@/lib/domain";
import { TopStatusBar } from "./TopStatusBar";

const baseStatus = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingDungeons: 15,
  zeroTrust: { livingCount: 0, threshold: DENOUNCE_THRESHOLD },
};

/** 상태 칩 하나만 잘라서 그 칸의 상호작용 여부를 확인한다. */
function chip(html: string, label: string): string {
  const found = html.match(new RegExp(`<(button|div)[^>]*>(?:(?!</\\1>)[\\s\\S])*?${label}[\\s\\S]*?</\\1>`));
  expect(found, `${label} 칸`).not.toBeNull();
  return found![0];
}

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
    expect(html).toContain("B · 30 남음");
    /* 옆 칸의 현재 명성을 되풀이하지 않는다. */
    /* 옆 칸의 현재 명성을 되풀이하지 않고, 한 칸에 담길 만큼 짧다. */
    expect(html).not.toContain("30 / B 60");
    expect(html).not.toContain("명성 30 더");
  });

  it("올릴 수 있으면 그렇게 적는다", () => {
    const html = renderToStaticMarkup(
      createElement(TopStatusBar, {
        status: { ...baseStatus, canPromote: true, nextPromotion: { rank: "B", reputationRequired: 60 } },
      }),
    );

    expect(html).toContain("B 가능");
  });

  /* 더 올라갈 곳이 없으면 남은 거리를 말할 수 없다. */
  it("최고 등급이면 그렇게 적는다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, { status: baseStatus }));

    expect(html).toContain("최고");
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

  it("의심 인원과 기준을 승급 뒤 남은 던전 앞에 표시한다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: {
        ...baseStatus,
        zeroTrust: { livingCount: 2, threshold: DENOUNCE_THRESHOLD },
      },
    }));

    expect(html).toContain("의심 인원");
    expect(html).toContain("2 / 5");
    expect(html.indexOf("승급")).toBeLessThan(html.indexOf("의심 인원"));
    expect(html.indexOf("의심 인원")).toBeLessThan(html.indexOf("남은 던전"));
    expect(html).toContain("/assets/u2/status-trust.svg");
  });

  it("기준 초과 값을 제한하지 않고 의심 인원 팝업을 여는 버튼으로 표시한다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: {
        ...baseStatus,
        zeroTrust: { livingCount: 7, threshold: DENOUNCE_THRESHOLD },
      },
      onOpenPromotion: () => undefined,
    }));

    const trust = chip(html, "의심 인원");
    expect(trust).toContain("7 / 5");
    expect(trust.startsWith("<button")).toBe(true);
    expect(trust).toContain('data-testid="zero-trust-info-trigger"');
    expect(trust).toContain('aria-label="의심 인원: 7 / 5"');
    expect(html).toContain("이번 던전이 끝난 뒤 누적 고발이 시작됩니다.");
  });

  it("신뢰 상태 아이콘은 공통 24x24 SVG 계약을 따른다", () => {
    const svg = readFileSync(
      join(process.cwd(), "public", "assets", "u2", "status-trust.svg"),
      "utf8",
    );
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain("<path");
  });
});

/*
 * 올리는 일은 「승급」 칸이 맡는다.
 *
 * 전에는 「길잡이 등급」 칸을 누르면 승급 창이 열렸다. 그 칸은 지금 등급이
 * 무엇인지 말하는 자리이지 무엇을 하는 자리가 아니라, 누를 수 있다는 것을
 * 알아채기 어려웠다. 바로 옆에 「승급」 이라고 적힌 칸이 있는데 그쪽은 눌러도
 * 아무 일이 없었다.
 */
describe("승급을 여는 자리", () => {
  const promotable = {
    ...baseStatus,
    canPromote: true,
    nextPromotion: { rank: "B" as const, reputationRequired: 60 },
  };

  it("「승급」 칸이 누를 수 있는 자리다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: promotable,
      onOpenPromotion: () => undefined,
    }));

    const promotion = chip(html, "승급");
    expect(promotion.startsWith("<button")).toBe(true);
    expect(promotion).toContain('data-testid="u3-promotion-trigger"');
  });

  it("「길잡이 등급」 칸은 읽는 자리로 남는다", () => {
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: promotable,
      onOpenPromotion: () => undefined,
    }));

    const rank = chip(html, "길잡이 등급");
    expect(rank.startsWith("<button")).toBe(false);
    expect(rank).not.toContain("u3-promotion-trigger");
  });

  it("누를 자리는 하나뿐이다", () => {
    // 두 칸이 같은 창을 열면 어느 쪽이 그 일을 하는지 흐려진다.
    const html = renderToStaticMarkup(createElement(TopStatusBar, {
      status: promotable,
      onOpenPromotion: () => undefined,
    }));

    expect(html.match(/u3-promotion-trigger/g)).toHaveLength(1);
  });
});
