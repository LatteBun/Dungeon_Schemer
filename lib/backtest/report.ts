import { GRADES } from "@/lib/domain";
import type { Grade } from "@/lib/domain";
import { STRATEGY_NAMES } from "@/lib/backtest/campaign-simulator";
import type { BacktestReport, StrategySummary } from "@/lib/backtest/campaign-simulator";

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function round(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function bossEntryHp(summary: StrategySummary): string {
  const parts = GRADES
    .filter((grade): grade is Grade => summary.averageBossEntryHp[grade] !== undefined)
    .map((grade) => `${grade} ${round(summary.averageBossEntryHp[grade]!)}`);
  return parts.length === 0 ? "표본 없음" : parts.join(" · ");
}

function firstReached(summary: StrategySummary): string {
  return (["B", "A", "S"] as const)
    .map((grade) => {
      const at = summary.medianFirstReached[grade];
      return `${grade} ${at === undefined ? "미도달" : `${at}회차`}`;
    })
    .join(" · ");
}

/**
 * 보고서를 문서로 만든다.
 *
 * 파일로 떨어뜨리는 이유는 밸런스 패치 전후를 `git diff`로 비교하기 위해서다.
 * 콘솔로만 보면 무엇이 얼마나 달라졌는지 사람이 눈으로 맞춰야 한다.
 * docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md의 `밸런스 조정과 재측정`
 */
export function formatBacktestReport(
  report: BacktestReport,
  meta: { elapsedSeconds: number },
): string {
  const lines: string[] = [];

  lines.push("# 캠페인 백테스트 보고서");
  lines.push("");
  lines.push("> `pnpm backtest`가 만든다. 직접 고치지 않는다.");
  lines.push("");
  lines.push(`- 시드 ${report.seedCount.toLocaleString()}개 × 전략 ${STRATEGY_NAMES.length}종`);
  lines.push(`- 실행 시간 ${round(meta.elapsedSeconds)}초`);
  lines.push(`- 생성 오류 **${report.generationErrors.length}건**`);
  lines.push(`- 시작 즉시 진행 불가 시드 **${report.unplayableSeeds.length}건**`);
  lines.push("");

  if (report.generationErrors.length > 0) {
    lines.push("## 생성 오류");
    lines.push("");
    for (const error of report.generationErrors.slice(0, 20)) {
      lines.push(`- ${error}`);
    }
    if (report.generationErrors.length > 20) {
      lines.push(`- 그 밖 ${report.generationErrors.length - 20}건`);
    }
    lines.push("");
  }

  lines.push("## 기준 승급 시나리오");
  lines.push("");
  lines.push("난수 없이 보상표만으로 계산한다. 보상이나 승급 기준을 바꾸면 여기가 먼저 달라진다.");
  lines.push("");
  lines.push("| 구간 | 현재 명성 | 누적 골드 | 승급 점수 |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const grade of ["B", "A", "S"] as const) {
    const point = report.baseline.checkpoints[grade];
    lines.push(`| ${grade} | ${point.reputation} | ${point.cumulativeGold} | ${point.score} |`);
  }
  lines.push("");

  lines.push("## 전략 비교");
  lines.push("");
  lines.push("| 항목 | " + STRATEGY_NAMES.join(" | ") + " |");
  lines.push("| --- |" + STRATEGY_NAMES.map(() => " ---: |").join(""));

  const row = (label: string, pick: (summary: StrategySummary) => string): void => {
    lines.push(`| ${label} | ${STRATEGY_NAMES.map((name) => pick(report.byStrategy[name])).join(" | ")} |`);
  };
  row("평균 원정", (s) => round(s.averageExpeditions));
  row("평균 클리어", (s) => round(s.averageClears));
  row("평균 전멸", (s) => round(s.averageWipes));
  row("평균 승급 횟수", (s) => round(s.averageGradeRises, 2));
  row("최종 승급 점수", (s) => round(s.averageFinalScore, 0));
  row("평균 HP", (s) => round(s.averageHp));
  row("평균 신뢰", (s) => round(s.averageTrust));
  row("B 도달률", (s) => percent(s.reachRates.B));
  row("A 도달률", (s) => percent(s.reachRates.A));
  row("S 도달률", (s) => percent(s.reachRates.S));
  row("불신의 대가", (s) => percent(s.endingRates.distrust));
  row("원정 종료", (s) => percent(s.endingRates.expeditionComplete));
  row("길잡이 자격 박탈", (s) => percent(s.endingRates.supportUnavailable));
  row("용사들의 시대가 끝나다", (s) => percent(s.endingRates.partyExhausted));
  row("엔딩 없이 중단", (s) => percent(s.endingRates.none));
  lines.push("");

  lines.push("## 밸런스 관찰");
  lines.push("");
  for (const name of STRATEGY_NAMES) {
    const summary = report.byStrategy[name];
    lines.push(`### ${name}`);
    lines.push("");
    lines.push(`- 최초 도달 원정 회차(중앙값): ${firstReached(summary)}`);
    lines.push(`- **명성 절벽** 전멸을 겪은 캠페인이 지원 불가로 끝난 비율: ${percent(summary.wipeThenSupportUnavailableRate)}`);
    lines.push(`- **보스방 도착 평균 HP**: ${bossEntryHp(summary)}`);
    lines.push(
      `- **카드 노출**: ${summary.cardExposure.distinct}종`
      + (summary.cardExposure.most === null
        ? ""
        : ` · 최다 \`${summary.cardExposure.most.id}\` ${summary.cardExposure.most.count.toLocaleString()}회`)
      + (summary.cardExposure.least === null
        ? ""
        : ` · 최소 \`${summary.cardExposure.least.id}\` ${summary.cardExposure.least.count.toLocaleString()}회`),
    );
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("이 보고서는 합격·불합격을 판정하지 않는다. 강제하는 것은 생성 오류 0건과 진행 불가 시드 0건뿐이고, 나머지 수치는 밸런스 조정의 근거 자료다.");
  lines.push("");

  return lines.join("\n");
}
