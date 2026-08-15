import { defineConfig } from "vitest/config";

/**
 * `pnpm backtest` 전용 설정이다.
 *
 * 기본 설정의 `include`는 `**\/*.test.ts`라 실행기 파일(`*.run.ts`)을 잡지 않는다.
 * 10,000시드는 1분을 넘게 도는 작업이라 매 `pnpm test`마다 돌 이유가 없고, 그렇다고
 * 테스트 안에 숨겨 두면 아무도 다시 돌리는 법을 모른다.
 * docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md의 `밸런스 조정과 재측정`
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.run.ts"],
    // 보고서를 파일로 쓰므로 진행 상황만 보이면 된다.
    reporters: ["default"],
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
