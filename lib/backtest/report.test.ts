import { describe, expect, it } from "vitest";
import { STRATEGY_NAMES, runBacktest } from "@/lib/backtest/campaign-simulator";
import { formatBacktestReport } from "@/lib/backtest/report";

const report = runBacktest({ seedCount: 20, seedPrefix: "보고서" });
const document = formatBacktestReport(report, { elapsedSeconds: 1.5 });

describe("백테스트 보고서 문서", () => {
  it("강제 조건과 실행 정보를 머리에 둔다", () => {
    expect(document).toContain("# 캠페인 백테스트 보고서");
    expect(document).toContain("시드 20개");
    expect(document).toContain("생성 오류 **0건**");
    expect(document).toContain("진행 불가 시드 **0건**");
  });

  it("기준 승급 시나리오와 세 전략을 모두 담는다", () => {
    expect(document).toContain("| B | 30 | 60 | 120 |");
    expect(document).toContain("| S | 117 | 255 | 489 |");
    for (const name of STRATEGY_NAMES) {
      expect(document).toContain(name);
    }
  });

  it("밸런스 관찰 세 항목을 전략마다 적는다", () => {
    for (const name of STRATEGY_NAMES) {
      const section = document.split(`### ${name}`)[1];
      expect(section, `${name} 절이 없다`).toBeDefined();
      expect(section).toContain("명성 절벽");
      expect(section).toContain("보스방 도착 평균 HP");
      expect(section).toContain("카드 노출");
    }
  });

  it("합격 판정이 아니라는 것을 문서에 남긴다", () => {
    expect(document).toContain("합격·불합격을 판정하지 않는다");
  });

  it("생성 오류가 있으면 목록을 적는다", () => {
    const withErrors = formatBacktestReport(
      { ...report, generationErrors: ["시드-1/balanced: INVALID_GENERATION: 테스트"] },
      { elapsedSeconds: 0.1 },
    );

    expect(withErrors).toContain("## 생성 오류");
    expect(withErrors).toContain("INVALID_GENERATION");
  });
});
