import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHARACTER_ROSTER } from "@/lib/content/character-roster";

const U4_ASSETS = [
  "public/assets/u4/map/map_background_base.png",
  "public/assets/u4/map/map_background_spider_parchment.png",
  "public/assets/u4/map/map_background_vignette.png",
  "public/assets/u4/map/map_atmosphere_ruins_props.png",
  "public/assets/u4/map/map_main_panel_frame.png",
  "public/assets/u4/map/map_title_bar_frame.png",
  "public/assets/u4/rooms/room_entry_base.png",
  "public/assets/u4/rooms/room_battle_base.png",
  "public/assets/u4/rooms/room_rest_base.png",
  "public/assets/u4/rooms/room_merchant_base.png",
  "public/assets/u4/rooms/room_special_base.png",
  "public/assets/u4/rooms/room_boss_base.png",
  "public/assets/u4/icons/icon_entry.png",
  "public/assets/u4/icons/icon_battle.png",
  "public/assets/u4/icons/icon_rest.png",
  "public/assets/u4/icons/icon_merchant.png",
  "public/assets/u4/icons/icon_special.png",
  "public/assets/u4/icons/icon_boss.png",
  "public/assets/u4/corridors/corridor_horizontal.png",
  "public/assets/u4/corridors/corridor_vertical.png",
  "public/assets/u4/corridors/corridor_corner.png",
  "public/assets/u4/corridors/corridor_t_junction.png",
  "public/assets/u4/corridors/corridor_cross.png",
  "public/assets/u4/corridors/corridor_stairs.png",
  "public/assets/u4/states/overlay_current_glow.png",
  "public/assets/u4/states/overlay_current_marker.png",
  "public/assets/u4/states/overlay_selectable_glow.png",
  "public/assets/u4/states/overlay_completed_glow.png",
  "public/assets/u4/states/overlay_unvisited_glow.png",
  "public/assets/u4/states/state_chip_current.png",
  "public/assets/u4/states/state_chip_selectable.png",
  "public/assets/u4/states/state_chip_completed.png",
  "public/assets/u4/states/state_chip_unvisited.png",
  "public/assets/u4/navigation/legend_panel_frame.png",
  "public/assets/u4/navigation/legend_row_dark.png",
  "public/assets/u4/navigation/legend_row_light.png",
  "public/assets/u4/navigation/destination_panel_frame.png",
  "public/assets/u4/navigation/destination_thumbnail_frame.png",
  "public/assets/u4/navigation/cta_button_left.png",
  "public/assets/u4/navigation/cta_button_center.png",
  "public/assets/u4/navigation/cta_button_right.png",
  "public/assets/u4/navigation/cta_button_arrow.png",
  "public/assets/u4/navigation/cta_button_active_center.png",
  "public/assets/u4/navigation/cta_button_disabled_center.png",
] as const;

describe("U4 assets", () => {
  it.each(U4_ASSETS)("exists: %s", (path) => {
    expect(existsSync(path)).toBe(true);
  });

  it("reuses existing U2/U3 assets and provides every official live portrait", () => {
    expect(existsSync("public/assets/u2/status-gold.svg")).toBe(true);
    expect(existsSync("public/assets/u3/extracted/risk-star.png")).toBe(true);
    expect(existsSync("public/assets/characters/dead")).toBe(false);
    for (const entry of CHARACTER_ROSTER) {
      expect(
        existsSync(
          `public/assets/characters/live/${entry.classId}/${entry.classId}_${entry.portraitVariant}.png`,
        ),
      ).toBe(true);
    }
  });

  it("keeps the spider parchment background compatible with the U4 map slot", () => {
    const parchment = readFileSync(
      "public/assets/u4/map/map_background_spider_parchment.png",
    );
    const width = parchment.readUInt32BE(16);
    const height = parchment.readUInt32BE(20);

    expect(parchment.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(width).toBeGreaterThanOrEqual(1500);
    expect(height).toBeGreaterThanOrEqual(1220);
    expect(width / height).toBeGreaterThanOrEqual(1.22);
    expect(width / height).toBeLessThanOrEqual(1.24);
  });
});
