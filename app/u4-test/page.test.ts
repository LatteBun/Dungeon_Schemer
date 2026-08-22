import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import U4TestPage from "./page";

describe("U4TestPage", () => {
  it("renders the deterministic U4 preview with actual generated map data", async () => {
    const page = await U4TestPage({ searchParams: Promise.resolve({}) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("던전 지도");
    expect(html).toContain("파티 상태");
    expect(html).toContain("이 지점으로 이동");
    expect((html.match(/data-testid=\"u4-party-member\"/g) ?? [])).toHaveLength(3);
  });

  it("dead=1 switches exactly one preview party member to a dead portrait", async () => {
    const page = await U4TestPage({
      searchParams: Promise.resolve({ dead: "1" }),
    });
    const html = renderToStaticMarkup(page);

    expect((html.match(/\/assets\/characters\/dead\//g) ?? [])).toHaveLength(1);
    expect(html).toContain("사망");
  });
});
