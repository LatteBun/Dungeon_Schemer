import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U3Preview } from "./U3Preview";

describe("U3Preview", () => {
  it("C2 실제 공고를 사용해 게시판과 계약 상세를 렌더링한다", () => {
    const html = renderToStaticMarkup(createElement(U3Preview));

    expect(html).toContain("길드 게시판");
    expect((html.match(/data-testid=\"u3-notice\"/g) ?? []).length).toBeGreaterThan(0);
    expect((html.match(/data-testid=\"u3-notice\"/g) ?? []).length).toBeLessThanOrEqual(5);
    expect(html).toContain("환경 특성");
    expect((html.match(/data-testid=\"u3-party-member\"/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain("의뢰 갱신");
    expect(html).not.toContain("정찰 보고");
  });
});
