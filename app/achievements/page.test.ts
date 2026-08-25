import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import RootLayout from "../layout";
import AchievementPage, { metadata } from "./page";

describe("업적 기록 페이지", () => {
  it("길잡이 업적 기록을 설명하는 고유 메타데이터를 제공한다", () => {
    expect(metadata).toEqual({
      title: "길잡이 업적 기록 | Dungeon Schemer",
      description: "캠페인 엔딩과 누적 통계로 해금한 길잡이 업적을 확인합니다.",
    });
  });

  it("실제 루트 레이아웃에서 12개 잠긴 카드와 메인 메뉴 연결을 렌더한다", () => {
    const html = renderToStaticMarkup(
      createElement(RootLayout, null, createElement(AchievementPage)),
    );

    expect(html).toContain("길잡이 업적 기록");
    expect(html).toContain('href="/"');
    expect(html.match(/미달성/g)).toHaveLength(12);
    expect(html.match(/>\?\?\?<\/h2>/g)).toHaveLength(12);
    expect(html).not.toContain('role="progressbar"');
  });
});
