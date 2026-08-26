import { describe, expect, it } from "vitest";
import type { NodeId } from "@/lib/domain";
import { createLayeredOrderSolver } from "./layered-map-crossing";

const id = (value: string) => value as NodeId;
const ENTRY = id("entry");
const A = id("a");
const B = id("b");
const C = id("c");
const D = id("d");
const BOSS = id("boss");

describe("layered map crossing solver", () => {
  const rows = [[ENTRY], [A, B], [C, D], [BOSS]] as const;

  it("finds an exact zero-crossing order", () => {
    const solver = createLayeredOrderSolver(rows);
    expect(solver.solve([
      { from: ENTRY, to: A }, { from: ENTRY, to: B },
      { from: A, to: D }, { from: B, to: C },
      { from: C, to: BOSS }, { from: D, to: BOSS },
    ]).crossingCount).toBe(0);
  });

  it("is deterministic and supports partial, safe, and unavoidable edges", () => {
    const solver = createLayeredOrderSolver(rows);
    const safe = [{ from: A, to: D }];
    const safeResult = solver.solve(safe);
    expect(safeResult.crossingCount).toBe(0);
    expect(safeResult.rows).toEqual(rows);
    expect(safeResult).toEqual(solver.solve(safe));
    expect(solver.solve([]).crossingCount).toBe(0);
    expect(solver.solve([
      { from: A, to: C }, { from: A, to: D },
      { from: B, to: C }, { from: B, to: D },
    ]).crossingCount).toBe(1);
    expect(solver.solve([
      { from: ENTRY, to: A }, { from: ENTRY, to: B },
      { from: A, to: C }, { from: B, to: C },
    ]).crossingCount).toBe(0);
  });

  it("rejects invalid rows", () => {
    expect(() => createLayeredOrderSolver([])).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
    expect(() => createLayeredOrderSolver([[]])).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
    expect(() => createLayeredOrderSolver([[A, A]])).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
    expect(() => createLayeredOrderSolver([[A, B, C, D, ENTRY, BOSS, id("x")]])).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
    expect(() => createLayeredOrderSolver([[A, B, C, D, ENTRY, BOSS]])).not.toThrow();
    expect(() => createLayeredOrderSolver([[A], [A]])).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
  });

  it("rejects unknown, duplicate, reversed, skipped, and self edges", () => {
    const solver = createLayeredOrderSolver(rows);
    const invalid = [
      { from: id("unknown"), to: A },
      { from: BOSS, to: D },
      { from: ENTRY, to: C },
      { from: A, to: A },
    ];
    for (const edge of invalid) {
      expect(() => solver.solve([edge])).toThrowError(expect.objectContaining({ code: "INVALID_GENERATION" }));
    }
    expect(() => solver.solve([{ from: A, to: C }, { from: A, to: C }])).toThrowError(
      expect.objectContaining({ code: "INVALID_GENERATION" }),
    );
  });
});
