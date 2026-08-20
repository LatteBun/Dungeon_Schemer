import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { U1TestPage } from "./page";

describe("U1TestPage", () => {
  it("screen=board query를 게시판 초기 화면으로 전달한다", async () => {
    const page = await U1TestPage({
      searchParams: Promise.resolve({ screen: "board" }),
    });

    const html = renderToStaticMarkup(page);

    expect(html).toContain('aria-pressed="true">게시판</button>');
    expect(html).toContain("길드 공고");
  });
});
