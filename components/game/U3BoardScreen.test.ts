import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TopStatusView } from "./TopStatusBar";
import type { U3BoardView, U3OfferDetailView } from "./u3-board-model";
import { U3BoardScreen } from "./U3BoardScreen";

const status: TopStatusView = {
  rank: "C",
  reputation: 30,
  gold: 10,
  canPromote: false,
  remainingDungeons: 15,
  nextPromotion: { rank: "B", reputationRequired: 60 },
};

const party = [
  {
    id: "character-1",
    name: "아델",
    classLabel: "전사",
    personalityLabel: "신중한",
    hp: 40,
    maxHp: 45,
    trust: 72,
    gold: 24,
  },
  {
    id: "character-2",
    name: "보른",
    classLabel: "도적",
    personalityLabel: "의심 많은",
    hp: 27,
    maxHp: 32,
    trust: 61,
    gold: 31,
  },
  {
    id: "character-3",
    name: "세라",
    classLabel: "성직자",
    personalityLabel: "정의로운",
    hp: 28,
    maxHp: 28,
    trust: 80,
    gold: 20,
  },
] as const;

function detail(
  offerId: string,
  dungeonName: string,
  environmentLabel: string,
  locked: boolean,
): U3OfferDetailView {
  return {
    offerId,
    dungeonId: `dungeon-${offerId}`,
    dungeonName,
    theme: offerId === "offer-2" ? "spider" : "desert",
    themeLabel: offerId === "offer-2" ? "거미굴" : "사막",
    riskLevel: locked ? 3 : 2,
    environmentLabel,
    reputationReward: locked ? 15 : 10,
    goldReward: locked ? 32 : 20,
    locked,
    lockReasonLabel: locked
      ? "현재 C급은 ★3 던전에 진입할 수 없습니다. (최대 ★2)"
      : null,
    scoutedRules: locked
      ? ["거미는 진동에 민감하다.", "어둠 속 개체는 빛을 피한다."]
      : [
          "열기에 오래 노출되면 움직임이 둔해진다.",
          "물가 근처에는 굴 흔적이 남는다.",
          "미이라는 조용한 움직임에 반응이 늦다.",
        ],
    party,
    contractOutcomes: [
      { survivors: 3, label: "전원 생존 시", reputation: 10, gold: 20, reputationLoss: 0 },
      { survivors: 2, label: "2명 생존 시", reputation: 6, gold: 12, reputationLoss: 0 },
      { survivors: 1, label: "1명 생존 시", reputation: 3, gold: 6, reputationLoss: 0 },
      { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: 10 },
    ],
  };
}

const first = detail("offer-1", "모래 협곡", "열기 노출", false);
const second = detail("offer-2", "검은 거미 소굴", "진동 경계", true);

const board: U3BoardView = {
  notices: [first, second],
  detailsByOfferId: {
    [first.offerId]: first,
    [second.offerId]: second,
  },
};

function render(selectedOfferId: string): string {
  return renderToStaticMarkup(
    createElement(U3BoardScreen, {
      status,
      board,
      selectedOfferId,
      onSelectOffer: () => undefined,
      onContract: () => undefined,
    }),
  );
}

describe("U3BoardScreen", () => {
  it("공고마다 환경 특성 하나만 보여주고 불필요한 옛 정보를 노출하지 않는다", () => {
    const html = render("offer-1");

    expect(html).toContain("길드 게시판");
    expect((html.match(/data-testid=\"u3-notice\"/g) ?? [])).toHaveLength(2);
    expect((html.match(/data-testid=\"u3-notice-environment\"/g) ?? [])).toHaveLength(2);
    expect(html).toContain("열기 노출");
    expect(html).toContain("진동 경계");
    expect(html).not.toContain("의뢰 갱신");
    expect(html).not.toContain("소요 시간");
    expect(html).not.toContain("계약 기간");
    expect(html).not.toContain("중도 포기");
    expect(html).not.toContain("실패 패널티");
  });

  it("선택한 공고의 답사 기록을 문장 목록으로 보여준다", () => {
    const html = render("offer-1");

    expect(html).toContain("답사 기록");
    expect(html).toContain("열기에 오래 노출되면 움직임이 둔해진다.");
    expect(html).toContain("물가 근처에는 굴 흔적이 남는다.");
    expect(html).toContain("미이라는 조용한 움직임에 반응이 늦다.");
  });

  it("선택한 공고의 실제 파티 3명과 생존 인원별 계약 조건을 보여준다", () => {
    const html = render("offer-1");

    expect(html).toContain("aria-pressed=\"true\"");
    expect((html.match(/data-testid=\"u3-party-member\"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("아델");
    expect(html).toContain("40 / 45");
    expect(html).toContain("신뢰 72");
    expect(html).toContain("소지 골드 24");
    expect(html).toContain("전원 생존 시");
    expect(html).toContain("2명 생존 시");
    expect(html).toContain("1명 생존 시");
    expect(html).toContain("전원 사망 시");
    expect(html).toContain("이 공고 계약하기");
  });

  it("진입 불가 공고도 상세를 볼 수 있지만 계약은 비활성화한다", () => {
    const html = render("offer-2");

    expect(html).toContain("진입 불가");
    expect(html).toContain("현재 C급은 ★3 던전에 진입할 수 없습니다. (최대 ★2)");
    expect(html).toMatch(/disabled=\"\"/);
  });
});
