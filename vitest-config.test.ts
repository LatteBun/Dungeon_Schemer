import { describe, expect, it } from "vitest";
import baseConfig from "./vitest.config.mts";
import backtestConfig from "./vitest.backtest.config";

const REQUIRED_EXCLUDES = [".worktrees/**", ".pnpm-store/**", "node_modules/**", ".next/**"];

describe("Vitest 수집 경계", () => {
  it.each([
    ["기본", baseConfig],
    ["백테스트", backtestConfig],
  ] as const)("%s 설정이 저장소 내부 생성 디렉터리를 제외한다", (_name, config) => {
    expect(config.test?.exclude).toEqual(expect.arrayContaining(REQUIRED_EXCLUDES));
  });
});
