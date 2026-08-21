import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U2Preview } from "./U2Preview";

describe("U2Preview", () => {
  it("캠페인 시작 상태를 인트로에 공급하고 U3 게시판으로 연결한다", () => {
    const html = renderToStaticMarkup(createElement(U2Preview));
    expect(html).toContain("영구 등급");
    expect(html).toContain("C");
    expect(html).toContain("현재 명성");
    expect(html).toContain("30");
    expect(html).toContain("30 / B 60");
    expect(html).toContain("남은 던전");
    expect(html).toContain("15");
    expect(html).toContain("href=\"/u3-test\"");
  });
});
