import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesertMonstersTestPage } from "./page";

describe("/desert-monsters-test", () => {
  it("사막 9종 검수 카탈로그를 렌더링한다", () => {
    const html = renderToStaticMarkup(createElement(DesertMonstersTestPage));

    expect(html).toContain("사막 몬스터 에셋 검수");
    expect(html).toContain("사막전갈");
    expect(html).toContain("스핑크스 네프리스");
  });
});
