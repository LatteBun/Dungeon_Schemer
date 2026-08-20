import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  U1PreviewMainContent,
  U1PreviewRightPanelContent,
} from "./U1PreviewContent";

describe("U1PreviewContent", () => {
  it("레퍼런스의 게시판·지도·진행·정산 정보 위계를 렌더링한다", () => {
    const expected = {
      board: ["길드 공고", "거미굴 3번", "계약 상세", "출전 파티", "계약하기"],
      map: ["던전 경로", "입구", "보스방", "선택 지점 입장", "에다 · 전사"],
      progress: ["정찰 장면", "상황 설명", "왼쪽 통로로 빠져나간다", "최근 반응"],
      settlement: ["원정 정산", "보상과 승급", "승급하기"],
    } as const;

    for (const [screenId, anchors] of Object.entries(expected)) {
      const html =
        renderToStaticMarkup(
          createElement(U1PreviewMainContent, {
            screenId: screenId as keyof typeof expected,
          }),
        ) +
        renderToStaticMarkup(
          createElement(U1PreviewRightPanelContent, {
            screenId: screenId as keyof typeof expected,
          }),
        );

      for (const anchor of anchors) {
        expect(html).toContain(anchor);
      }
    }
  });

  it("인트로는 좌측 안내만 렌더링한다", () => {
    const mainHtml = renderToStaticMarkup(
      createElement(U1PreviewMainContent, { screenId: "intro" }),
    );
    const rightHtml = renderToStaticMarkup(
      createElement(U1PreviewRightPanelContent, { screenId: "intro" }),
    );

    expect(mainHtml).toContain("길잡이의 시작");
    expect(rightHtml).toBe("");
  });
});
