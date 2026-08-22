import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U3Preview } from "./U3Preview";

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
});
