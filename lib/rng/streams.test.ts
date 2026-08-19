import { describe, expect, it } from "vitest";
import { RNG_STREAMS, createRng } from "@/lib/rng";

describe("캠페인 난수 스트림 계약", () => {
  it("캠페인 영역별 스트림 이름을 고정한다", () => {
    expect(RNG_STREAMS).toEqual([
      "pool",
      "party",
      "board",
      "map",
      "ecology",
      "card",
      "event",
      "boss",
      "trust",
      "worldturn",
    ]);
  });

  it("모든 계약 스트림은 같은 시드에서 독립적으로 파생된다", () => {
    const root = createRng("f1-streams");
    const streams = RNG_STREAMS.map((name) => root.derive(name));

    expect(new Set(streams.map((stream) => stream.seed)).size).toBe(
      RNG_STREAMS.length,
    );
    expect(streams.map((stream) => stream.float())).toEqual(
      RNG_STREAMS.map((name) => root.derive(name).float()),
    );
  });
});
