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
    expect(html).toContain("/assets/u4/map/map_background_base.png");
    expect(html).toContain("map_atmosphere_ruins_props.png");
  });

  it("dead=1 keeps the official live portrait for the deceased preview member", async () => {
    const page = await U4TestPage({
      searchParams: Promise.resolve({ dead: "1" }),
    });
    const html = renderToStaticMarkup(page);

    expect((html.match(/class=\"party-card is-dead\"/g) ?? [])).toHaveLength(1);
    expect(html).toContain("/assets/characters/live/");
    expect(html).toContain("사망");
  });

  for (const themeId of ["spider", "desert", "graveyard"] as const) {
    it(`theme=${themeId} renders the shared parchment-map preview`, async () => {
      const page = await U4TestPage({
        searchParams: Promise.resolve({ theme: themeId }),
      });
      const html = renderToStaticMarkup(page);

      expect(html).toContain(
        "/assets/u4/map/map_background_spider_parchment.png",
      );
      expect(html).toContain("u4-map-surface__background is-parchment");
      expect(html).not.toContain("map_atmosphere_ruins_props.png");
    });
  }

  it("an unknown theme keeps the base-map fallback", async () => {
    const page = await U4TestPage({
      searchParams: Promise.resolve({ theme: "lava" }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("/assets/u4/map/map_background_base.png");
    expect(html).toContain("map_atmosphere_ruins_props.png");
  });

  it("an array theme keeps the base-map fallback", async () => {
    const page = await U4TestPage({
      searchParams: Promise.resolve({ theme: ["spider", "desert"] }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("/assets/u4/map/map_background_base.png");
    expect(html).toContain("map_atmosphere_ruins_props.png");
  });
});
