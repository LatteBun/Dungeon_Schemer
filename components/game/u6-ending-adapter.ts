import type { CampaignEnding, CampaignState, Character, EndingKind, TurningPoint } from "@/lib/domain";
import { selectHighlightedTurningPoint } from "@/lib/rules/campaign-history";
import type { U6EndingNote, U6EndingView } from "./u6-ending-model";

/**
 * 실제 캠페인을 엔딩 View 로 옮긴다.
 *
 * 산문은 화면의 몫이다. `C6` 가 주는 것은 판정 근거 한 줄뿐이고, 그 결말을 어떤
 * 목소리로 전할지는 규칙의 일이 아니다. 다만 **사실을 다시 쓰지는 않는다.**
 * 숫자와 이름은 전부 캠페인에서 끌어온다.
 */

interface EndingFacts {
  readonly finalRank: string;
  readonly survivedCount: number;
  readonly diedCount: number;
  readonly zeroTrustCount: number;
  /** 그 결말을 부른 사람 수. `C6` 가 결정적 순서로 넘겨준다. */
  readonly triggerCount: number;
  readonly clearedDungeonCount: number;
  readonly finalReputation: number;
  readonly cumulativeGold: number;
  readonly wipedExpeditions: number;
  readonly clearedExpeditions: number;
  readonly totalExpeditions: number;
  readonly triggerNames: string;
}

/** 살아 있는 사람은 풀에서 세고, 죽은 사람은 `C8-A` 가 센 값을 쓴다. */
export function endingFactsFor(campaign: CampaignState, ending: CampaignEnding): EndingFacts {
  const pool = campaign.pool.order
    .map((id) => campaign.pool.byId[id])
    .filter((member): member is Character => member !== undefined);
  const names = ending.triggerCharacterIds
    .map((id) => campaign.pool.byId[id]?.name)
    .filter((name): name is string => name !== undefined);

  return {
    finalRank: ending.finalRank,
    survivedCount: pool.filter((member) => member.alive).length,
    /* 풀을 다시 세면 통계와 갈라질 수 있다. 한쪽만 본다. */
    diedCount: campaign.statistics.totalDeaths,
    zeroTrustCount: pool.filter((member) => member.alive && member.trust === 0).length,
    triggerCount: ending.triggerCharacterIds.length,
    /*
     * 정복한 던전 수와 클리어한 원정 수는 다른 값이다.
     *
     * 한 던전을 두 번 만에 깰 수 있으므로 원정 횟수가 더 많을 수 있다. "던전 N곳
     * 정복" 은 던전을 세야 한다.
     */
    clearedDungeonCount: campaign.dungeons.filter((one) => one.status === "cleared").length,
    finalReputation: campaign.reputation,
    cumulativeGold: campaign.cumulativeGold,
    wipedExpeditions: campaign.statistics.wipedExpeditions,
    clearedExpeditions: campaign.statistics.clearedExpeditions,
    totalExpeditions: campaign.statistics.totalExpeditions,
    triggerNames: names.join(" · "),
  };
}

interface EndingProse {
  readonly subtitle: string;
  /** 판정 근거 뒤에 오는 두 줄. 이야기를 짓는 자리다. */
  readonly narrative: readonly [string, string];
  readonly report: readonly string[];
  readonly consequences: readonly U6EndingNote[];
  readonly chronicleSummary: string;
}

const PROSE: Readonly<Record<EndingKind, (facts: EndingFacts) => EndingProse>> = {
  completed: (facts) => ({
    subtitle: "당신은 길을 안내했을 뿐이다. 걸어간 것은 그들이었다.",
    narrative: [
      `${facts.totalExpeditions}번의 원정에서 ${facts.diedCount}명을 묻고 ${facts.survivedCount}명과 함께 돌아왔습니다.`,
      "길드는 당신의 이름을 기록에 남겼고, 아무도 그 대가를 세지 않았습니다.",
    ],
    report: [
      `던전 ${facts.clearedDungeonCount}곳 정복`,
      `최종 등급 ${facts.finalRank}`,
      `전멸한 원정 ${facts.wipedExpeditions}회`,
      `누적 골드 ${facts.cumulativeGold}`,
    ],
    consequences: [
      { label: "완주", detail: `던전 ${facts.clearedDungeonCount}곳을 남김없이 지나왔다.` },
      { label: "생환", detail: `${facts.survivedCount}명이 마지막까지 살아남았다.` },
      { label: "대가", detail: `${facts.diedCount}명이 돌아오지 못했다.` },
      { label: "등급", detail: `길잡이 등급 ${facts.finalRank} 에 이르렀다.` },
    ],
    chronicleSummary:
      "처음에는 아무도 당신의 말을 믿지 않았고, 나중에는 아무도 묻지 않고 따랐습니다. 그 변화가 무엇을 뜻하는지는 마지막 던전을 나선 뒤에야 알게 됩니다.",
  }),
  distrust: (facts) => ({
    subtitle: "믿음은 한 번에 무너지지 않는다. 조금씩, 조언 하나마다 깎여 나간다.",
    narrative: [
      "돌아온 이들은 당신의 말을 더 듣지 않기로 했습니다.",
      "다음 원정에 그들을 다시 부를 수 없습니다.",
    ],
    report: [
      "원정 생존자 전원 신뢰 0",
      `신뢰 0 인 원정 생존자 ${facts.triggerCount}명`,
      `최종 명성 ${facts.finalReputation}`,
      `전멸한 원정 ${facts.wipedExpeditions}회`,
    ],
    consequences: [
      { label: "불신", detail: `살아 돌아온 ${facts.triggerCount}명이 모두 등을 돌렸다.` },
      { label: "고립", detail: "조언을 받아들일 사람이 남지 않았다." },
      { label: "명성", detail: `명성은 ${facts.finalReputation} 에서 멈췄다.` },
      { label: "기록", detail: "길드는 원인을 묻지 않고 계약을 정리했다." },
    ],
    chronicleSummary:
      "당신의 조언은 매번 맞았을 수도 있고, 한 번도 맞지 않았을 수도 있습니다. 그들이 아는 것은 몇 명이 돌아오지 못했다는 사실뿐이었습니다.",
  }),
  denounced: (facts) => ({
    subtitle: "한 사람의 침묵은 견딜 수 있다. 다섯 사람의 증언은 그렇지 않다.",
    narrative: [
      facts.triggerNames === ""
        ? "돌아온 이들이 길드에 같은 말을 했습니다."
        : `${facts.triggerNames} 가 길드에 같은 말을 했습니다.`,
      "길드는 그 말을 기록으로 남겼고, 당신의 이름을 명부에서 지웠습니다.",
    ],
    report: [
      `불신을 증언한 용사 ${facts.triggerCount}명`,
      `살아 있는 용사 ${facts.survivedCount}명`,
      `사망한 용사 ${facts.diedCount}명`,
      `최종 명성 ${facts.finalReputation}`,
    ],
    consequences: [
      { label: "고발", detail: `${facts.triggerCount}명이 같은 증언을 남겼다.` },
      { label: "박탈", detail: "길잡이 자격이 회수되었다." },
      { label: "명성", detail: `쌓아 둔 명성 ${facts.finalReputation} 은 소용이 없었다.` },
      { label: "이후", detail: "그들은 다른 길잡이와 다시 원정을 나선다." },
    ],
    chronicleSummary:
      "고발은 한 번에 오지 않았습니다. 돌아온 이들이 하나씩 말을 옮겼고, 다섯 번째 증언에서 길드가 움직였습니다.",
  }),
  exhausted: (facts) => ({
    subtitle: "던전은 그대로 있다. 들어갈 사람이 없을 뿐이다.",
    narrative: [
      `${facts.diedCount}명을 잃고 나니 서로 다른 직업 셋을 채울 수 없습니다.`,
      "공고는 그대로 걸려 있지만 계약할 수 없습니다.",
    ],
    report: [
      "서로 다른 직업 3명을 편성할 수 없음",
      `사망한 용사 ${facts.diedCount}명`,
      `남은 용사 ${facts.survivedCount}명`,
      `전멸한 원정 ${facts.wipedExpeditions}회`,
    ],
    consequences: [
      { label: "소진", detail: `${facts.diedCount}명이 돌아오지 못했다.` },
      { label: "정지", detail: "편성할 파티가 없어 원정이 멈췄다." },
      { label: "잔고", detail: `골드 ${facts.cumulativeGold} 은 쓸 곳이 없다.` },
      { label: "이후", detail: "길드는 다른 길잡이에게 남은 던전을 넘긴다." },
    ],
    chronicleSummary:
      "전멸은 매번 다른 이유로 일어났지만 결과는 같았습니다. 마지막에 남은 것은 채울 수 없는 세 자리였습니다.",
  }),
  unemployed: (facts) => ({
    subtitle: "게시판은 매일 채워진다. 당신이 읽을 수 있는 줄이 없을 뿐이다.",
    narrative: [
      `등급 ${facts.finalRank} 로는 남은 공고를 하나도 계약할 수 없습니다.`,
      "명성을 더 쌓을 원정이 없으므로 등급도 오르지 않습니다.",
    ],
    report: [
      "남은 공고가 전부 등급 미달",
      `길잡이 등급 ${facts.finalRank}`,
      `최종 명성 ${facts.finalReputation}`,
      `누적 골드 ${facts.cumulativeGold}`,
    ],
    consequences: [
      { label: "정체", detail: `등급 ${facts.finalRank} 에서 더 나아가지 못했다.` },
      { label: "봉쇄", detail: "계약할 수 있는 공고가 남지 않았다." },
      { label: "명성", detail: `명성 ${facts.finalReputation} 은 승급에 모자랐다.` },
      { label: "이후", detail: "길드는 조용히 당신의 자리를 비웠다." },
    ],
    chronicleSummary:
      "실패한 원정마다 던전의 위험도가 올랐습니다. 어느 날 게시판을 보니 읽을 수 있는 공고가 한 줄도 남아 있지 않았습니다.",
  }),
};

const TURNING_POINT_LABEL: Readonly<Record<TurningPoint["kind"], string>> = {
  firstCharacterDeath: "첫 사망",
  bossBreakthrough: "보스 돌파",
  trustCollapse: "신뢰 붕괴",
  campaignEnded: "종료",
};

/*
 * 전환점은 `C8-B` 가 고른다.
 *
 * 화면이 이력을 훑어 "가장 큰 사건" 을 다시 판단하지 않는다. 규칙이 이미 순위를
 * 정해 뒀고, 화면은 그것을 몇 회차 일인지와 함께 옮겨 적을 뿐이다.
 */
function turningPointFor(campaign: CampaignState) {
  const point = selectHighlightedTurningPoint(campaign.history.turningPoints);
  if (point === null) return null;
  return { label: TURNING_POINT_LABEL[point.kind], detail: `${point.campaignTurn}회차` };
}

export function createU6EndingView(campaign: CampaignState, ending: CampaignEnding): U6EndingView {
  const facts = endingFactsFor(campaign, ending);
  const prose = PROSE[ending.kind](facts);

  return {
    kind: ending.kind,
    subtitle: prose.subtitle,
    /*
     * 첫 줄은 `C6` 가 쓴 판정 근거다. 화면이 다시 쓰지 않는다.
     *
     * 규칙이 문턱을 바꿔도 화면이 옛 문장을 들고 있지 않도록, 판정의 이유는
     * 규칙에서 그대로 온다. 나머지 두 줄은 그 사실 위에 얹는 이야기다.
     */
    reasons: [ending.reason, ...prose.narrative],
    report: prose.report,
    consequences: prose.consequences,
    chronicleSummary: prose.chronicleSummary,
    finalRank: ending.finalRank,
    survivedCount: facts.survivedCount,
    diedCount: facts.diedCount,
    zeroTrustCount: facts.zeroTrustCount,
    zeroTrustPartySize: facts.triggerCount,
    finalReputation: facts.finalReputation,
    cumulativeGold: facts.cumulativeGold,
    /*
     * 조언만 센다. 이력 전체를 세면 보스전이 조언 수에 섞인다.
     *
     * 한 캠페인에서 이력 87건 중 조언은 76건이었고, 엔딩은 87 이라 적고 있었다.
     */
    adviceTotal: campaign.history.events.filter((one) => one.type === "ADVICE_RESOLVED").length,
    totalExpeditions: campaign.statistics.totalExpeditions,
    clearedExpeditions: facts.clearedExpeditions,
    wipedExpeditions: facts.wipedExpeditions,
    highestDungeonCleared: campaign.statistics.highestDungeonCleared,
    turningPoint: turningPointFor(campaign),
  };
}
