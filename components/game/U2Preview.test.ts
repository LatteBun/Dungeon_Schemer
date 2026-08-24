import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U2Preview } from "./U2Preview";

describe("U2Preview", () => {
  it("캠페인 시작 상태를 인트로에 공급하고 U3 게시판으로 연결한다", () => {
    const html = renderToStaticMarkup(createElement(U2Preview));
    /* 「영구」는 무엇에 견주어 영구한지를 말하지 않는다. 길잡이의 등급이다. */
    expect(html).toContain("길잡이 등급");
    expect(html).toContain("C");
    expect(html).toContain("현재 명성");
    expect(html).toContain("30");
    /* 승급 칸은 남은 거리를 적는다. 현재 명성은 옆 칸에 이미 있다. */
    expect(html).toContain("B까지 명성 30 더");
    expect(html).toContain("남은 던전");
    expect(html).toContain("15");
    expect(html).toContain("href=\"/u3-test\"");
  });
});
