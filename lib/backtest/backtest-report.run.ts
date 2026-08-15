import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "vitest";
import { runBacktest } from "@/lib/backtest/campaign-simulator";
import { formatBacktestReport } from "@/lib/backtest/report";

/**
 * `pnpm backtest`의 실행기다.
 *
 * 파일 이름이 `.run.ts`라 기본 `pnpm test`에는 잡히지 않는다. 10,000시드는 1분을
 * 넘게 도는 작업이라 매 테스트 실행마다 돌 이유가 없다. 그래도 vitest를 쓰는
 * 이유는 이 저장소에 TypeScript를 바로 실행할 다른 도구가 없고, `@/` 별칭을
 * 해석하는 설정이 vitest에만 있기 때문이다.
 *
 * 시드 수는 `BACKTEST_SEEDS` 환경 변수로 바꾼다. 빠르게 확인할 때 쓴다.
 */
const OUTPUT = join(import.meta.dirname, "..", "..", "docs", "technical", "BACKTEST_REPORT.md");

it("백테스트 보고서를 만든다", () => {
  const seedCount = Number(process.env.BACKTEST_SEEDS ?? 10_000);
  const started = Date.now();
  const report = runBacktest({ seedCount });
  const elapsedSeconds = (Date.now() - started) / 1000;

  writeFileSync(OUTPUT, formatBacktestReport(report, { elapsedSeconds }), "utf8");

  process.stdout.write(
    `\n백테스트 완료: 시드 ${seedCount.toLocaleString()} · ${elapsedSeconds.toFixed(1)}초\n`
    + `생성 오류 ${report.generationErrors.length}건 · 진행 불가 ${report.unplayableSeeds.length}건\n`
    + `보고서: docs/technical/BACKTEST_REPORT.md\n\n`,
  );
}, 30 * 60 * 1000);
