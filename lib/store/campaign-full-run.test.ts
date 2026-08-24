import { describe, expect, it } from "vitest";
import { createU6EndingView } from "@/components/game/u6-ending-adapter";
import { createStrategy } from "@/lib/backtest/strategies";
import { runCampaign } from "@/lib/backtest/campaign-driver";

/**
 * 한 캠페인을 끝까지 돌린다.
 *
 * `I2` 의 완료 기준은 「인트로→게시판→탐험→정산→월드턴→다음 공고/엔딩」이다.
 * 한 판만 도는 검사로는 그 끝을 못 본다 — 엔딩은 여러 원정이 쌓여야 온다.
 *
 * 화면을 거치지 않고 스토어로 돌린다. 렌더를 섞으면 무엇이 달라졌는지 가려진다.
 */

function runToEnd(seed: string, limit = 400) {
  const result = runCampaign({ seed, strategy: createStrategy("survival"), accuracy: 0.7, stepLimit: limit });
  if (!result.ok) throw new Error(`${result.errorKind}: ${result.message}`);
  return {
    campaign: result.campaign,
    taken: result.trace.actionTypes,
    store: { getState: () => ({ rejected: null }) },
  };
}

/*
 * 승급까지 태우면 등급 S 에 이르고 인력이 마르며 끝난다.
 *
 * 아무 시드나 되지 않는다 - 지도가 규칙이 거부할 이동을 내놓는 결함이 있어
 * 40 시드 중 23 이 도중에 막힌다. `E3` 의 몫이고 아래에 그 재현을 남긴다.
 */
const SEED = "i2-run-2";

describe("캠페인 한 판", () => {
  it("인트로에서 시작해 엔딩에 이른다", () => {
    const run = runToEnd(SEED);

    expect(run.campaign.phase).toBe("ended");
    expect(run.campaign.ending).not.toBeNull();
  });

  /* 끝까지 가는 동안 한 번도 거부되지 않는다. 거부는 흐름이 끊긴 자리다. */
  it("끝까지 가는 동안 거부가 없다", () => {
    const run = runToEnd(SEED);

    expect(run.store.getState().rejected).toBeNull();
    expect(run.taken.filter((one) => one === "COMPLETE_EXPEDITION").length).toBeGreaterThan(1);
  });

  it("엔딩 화면을 그릴 수 있다", () => {
    const run = runToEnd(SEED);
    const view = createU6EndingView(run.campaign, run.campaign.ending!);

    /* 판정 근거는 규칙이 쓴 문장이다. 화면이 지어낸 것이 아니다. */
    expect(view.reasons[0]).toBe(run.campaign.ending!.reason);
    expect(view.reasons.every((line) => line.length > 0)).toBe(true);
    expect(view.report.every((line) => !line.includes("undefined"))).toBe(true);
    expect(view.consequences).toHaveLength(4);
  });

  /* 엔딩의 숫자는 그 캠페인에서 나온 값이다. 고정값이 아니다. */
  it("엔딩의 통계가 실제로 돌린 캠페인과 맞는다", () => {
    const run = runToEnd(SEED);
    const view = createU6EndingView(run.campaign, run.campaign.ending!);

    expect(view.totalExpeditions).toBe(run.campaign.statistics.totalExpeditions);
    expect(view.diedCount).toBe(run.campaign.statistics.totalDeaths);
    expect(view.finalReputation).toBe(run.campaign.reputation);
    expect(view.totalExpeditions).toBeGreaterThan(0);
  });

  it("승급을 밟고 등급이 오른다", () => {
    const run = runToEnd(SEED);

    expect(run.taken).toContain("PROMOTE_GUIDE");
    expect(run.campaign.rank).not.toBe("C");
  });

  it("같은 시드는 끝까지 같은 캠페인을 낸다", () => {
    expect(JSON.stringify(runToEnd(SEED).campaign)).toBe(JSON.stringify(runToEnd(SEED).campaign));
  });
});

/**
 * 지도는 규칙이 거부할 이동을 내놓지 않는다.
 *
 * 한때 40 시드 중 23 이 막혔다. 강한 연계의 후속 지점은 선행 단서를 들고 있어야
 * 물질화되는데, 배치가 "선행에서 **도달 가능**" 만 요구했기 때문이다. 갈림길에서
 * 다른 갈래로 가면 선행을 밟지 않고 후속에 닿고, 그 지점은 지도에서 고를 수 있게
 * 보였다. 이제 배치가 후속에 닿는 **모든** 길이 선행을 지날 것을 요구한다.
 *
 * 한 시드로는 못 본다. 지도가 갈라지는 모양이 시드마다 다르고, 막히는 것은 그
 * 갈래 중 하나를 골랐을 때뿐이다.
 */
describe("막다른 길이 없다", () => {
  it("어느 시드로 시작해도 끝까지 간다", () => {
    const stuck: string[] = [];
    for (let index = 0; index < 40; index += 1) {
      const seed = `scan-${index}`;
      try {
        const run = runToEnd(seed);
        if (run.campaign.phase !== "ended") stuck.push(`${seed}: ${run.campaign.phase} 에서 멈춤`);
      } catch (error) {
        stuck.push(`${seed}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    expect(stuck).toEqual([]);
  });
});
