import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CharacterId } from "@/lib/domain";
import type { TopStatusView } from "./TopStatusBar";
import type { U3BoardView, U3OfferDetailView } from "./u3-board-model";
import type { U3PromotionView } from "./u3-promotion-model";
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
  { id: "character-1" as CharacterId, name: "아델", classLabel: "전사", personalityLabel: "신중한", hp: 40, maxHp: 45, trust: 72, gold: 24, portraitSrc: "/assets/characters/adel.webp" },
  { id: "character-2" as CharacterId, name: "보른", classLabel: "도적", personalityLabel: "의심 많은", hp: 27, maxHp: 32, trust: 61, gold: 31 },
  { id: "character-3" as CharacterId, name: "세라", classLabel: "성직자", personalityLabel: "정의로운", hp: 28, maxHp: 28, trust: 80, gold: 20, battleAbilityStatus: { label: "치유", remaining: 2, total: 2 } },
] as const;

function detail(offerId: string, dungeonName: string, locked: boolean): U3OfferDetailView {
  return {
    offerId,
    dungeonId: `dungeon-${offerId}`,
    dungeonName,
    theme: offerId === "offer-2" ? "spider" : "desert",
    themeLabel: offerId === "offer-2" ? "거미굴" : "사막",
    riskLevel: locked ? 3 : 2,
    reputationReward: locked ? 15 : 10,
    goldReward: locked ? 32 : 20,
    locked,
    lockReasonLabel: locked ? "현재 C급은 ★3 던전에 진입할 수 없습니다. (최대 ★2)" : null,
    party,
    contractOutcomes: [
      { survivors: 3, label: "전원 생존 시", reputation: 10, gold: 20, reputationLoss: 0 },
      { survivors: 2, label: "2명 생존 시", reputation: 6, gold: 12, reputationLoss: 0 },
      { survivors: 1, label: "1명 생존 시", reputation: 3, gold: 6, reputationLoss: 0 },
      { survivors: 0, label: "전원 사망 시", reputation: 0, gold: 0, reputationLoss: 10 },
    ],
  };
}

const first = detail("offer-1", "모래 협곡", false);
const second = detail("offer-2", "검은 거미 소굴", true);
const board: U3BoardView = {
  notices: [first, second],
  detailsByOfferId: { [first.offerId]: first, [second.offerId]: second },
};

const promotion: U3PromotionView = {
  eligibility: {
    fromRank: "C",
    toRank: "B",
    newlyUnlockedRiskLevel: 3,
    reputationRequired: 60,
    goldRequired: 150,
    currentReputation: 60,
    currentGold: 120,
    canPromoteByReputation: true,
    canPromoteByGold: false,
  },
  result: null,
  isOpen: false,
};

function render(
  selectedOfferId: string,
  overrides: { status?: TopStatusView; promotion?: U3PromotionView } = {},
): string {
  return renderToStaticMarkup(createElement(U3BoardScreen, {
    status: overrides.status ?? status,
    board,
    selectedOfferId,
    promotion: overrides.promotion ?? promotion,
    onSelectOffer: () => undefined,
    onContract: () => undefined,
    onOpenPromotion: () => undefined,
    onCancelPromotion: () => undefined,
    onConfirmPromotion: () => undefined,
    onDismissPromotionResult: () => undefined,
  }));
}

describe("U3BoardScreen", () => {
  it("공고에서 환경 특성과 불필요한 옛 정보를 노출하지 않는다", () => {
    const html = render("offer-1");
    expect(html).toContain("길드 게시판");
    expect((html.match(/data-testid=\"u3-notice\"/g) ?? [])).toHaveLength(2);
    expect((html.match(/data-testid=\"u3-notice-environment\"/g) ?? [])).toHaveLength(0);
    for (const hidden of ["열기 노출", "진동 경계", "환경 특성", "의뢰 갱신", "소요 시간", "계약 기간", "중도 포기", "실패 패널티", "답사 기록", "정찰 보고"]) {
      expect(html).not.toContain(hidden);
    }
  });

  it("압정과 위험도 별은 유지하고 던전은 보드에서 자른 직사각형 장면으로 표시한다", () => {
    const html = render("offer-1");
    expect((html.match(/data-testid=\"u3-notice-pin\"/g) ?? [])).toHaveLength(2);
    expect(html).toContain("/assets/u3/extracted/board-pin.png");
    expect((html.match(/data-testid=\"u3-notice-theme-scene\"/g) ?? [])).toHaveLength(2);
    expect(html).toContain("u3-theme-scene--desert");
    expect(html).toContain("u3-theme-scene--spider");
    expect(html).toContain("/assets/u3/extracted/risk-star.png");
    expect(html).not.toContain("/assets/u3/extracted/theme-desert.png");
    expect(html).not.toContain("/assets/u3/extracted/theme-spider.png");
  });

  it("활성 위험도 별은 내부가 채워진 별 에셋을 사용한다", () => {
    const html = render("offer-1");
    expect(html).toContain("/assets/u3/risk-star-filled.svg");
    expect(html).toContain("/assets/u3/extracted/risk-star.png");
  });

  it("파티 초상 매핑 슬롯과 기존 골드 SVG를 데이터 행에 재사용한다", () => {
    const html = render("offer-1");
    expect(html).toContain("/assets/characters/adel.webp");
    expect((html.match(/class="party-card__gold"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("/assets/u2/status-gold.svg");
  });

  it("계약 상세의 성직자 카드에만 시작 횟수를 n회로 표시한다", () => {
    const html = render("offer-1");

    expect((html.match(/party-card__ability/g) ?? [])).toHaveLength(1);
    expect(html).toContain("치유 2회");
    expect(html).not.toContain("치유 2/2");
    const notices = html.match(/<div class="u3-guild-board"[\s\S]*?<\/div><\/div>/)?.[0] ?? "";
    expect(notices).not.toContain("치유");
  });

  /* 공용 카드로 옮기며 라벨 문구를 없앴다. 아이콘과 금액이 붙어 있으면 읽힌다. */
  it("파티 소지 골드는 라벨 문구 없이 아이콘과 금액으로 표시한다", () => {
    const html = render("offer-1");
    expect((html.match(/class="party-card__gold"/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain(">소지 골드<");
  });

  it("계약 CTA는 작은 계약 인장과 화살표를 같은 중심선에 둔다", () => {
    const html = render("offer-1");
    expect(html).toContain("/assets/u3/extracted/contract-emblem.png");
    expect(html).toContain("/assets/u3/extracted/arrow-right.png");
    expect(html).toContain('class="u3-contract-button__seal"');
    expect(html).toContain('width="40"');
    expect(html).toContain('class="u3-contract-button__arrow"');
    expect(html).toContain('width="70"');
  });

  it("계약 조건의 명성과 골드는 한 줄 보상 묶음으로 렌더링한다", () => {
    const html = render("offer-1");
    expect((html.match(/class=\"u3-contract-outcome__reward\"/g) ?? [])).toHaveLength(3);
  });

  it("선택한 공고의 실제 파티 3명과 생존 인원별 계약 조건을 보여준다", () => {
    const html = render("offer-1");
    expect(html).toContain("aria-pressed=\"true\"");
    expect((html.match(/data-testid=\"u3-party-member\"/g) ?? [])).toHaveLength(3);
    expect(html).toContain("아델");
    expect(html).toContain("40 / 45");
    expect(html).toContain("<dt>신뢰</dt><dd>72</dd>");
    expect(html).toContain("소지 골드");
    expect(html).toContain(">24<");
    expect(html).toContain("전원 생존 시");
    expect(html).toContain("2명 생존 시");
    expect(html).toContain("1명 생존 시");
    expect(html).toContain("전원 사망 시");
    expect(html).toContain("이 공고 계약하기");
  });

  it("계약 상세는 테마 배경 modifier와 scrim 없이 정보만 렌더링한다", () => {
    const html = render("offer-1");

    expect(html).toContain('class="u3-detail-section u3-contract-card"');
    expect(html).not.toContain("u3-contract-card--desert");
    expect(html).not.toContain("u3-contract-card--spider");
    expect(html).not.toContain("u3-contract-card__scrim");
    expect(html).toContain("모래 협곡");
    expect(html).toContain("전원 생존 시");
  });

  it("진입 불가 공고도 상세를 볼 수 있지만 계약은 비활성화한다", () => {
    const html = render("offer-2");
    expect(html).toContain("진입 불가");
    expect(html).toContain("현재 C급은 ★3 던전에 진입할 수 없습니다. (최대 ★2)");
    expect(html).toMatch(/disabled=\"\"/);
  });

  it("게시판 상단 등급 버튼과 승급 결과 dialog를 렌더링한다", () => {
    const html = renderToStaticMarkup(createElement(U3BoardScreen, {
      status: { ...status, canPromote: true },
      board,
      selectedOfferId: "offer-1",
      promotion: {
        ...promotion,
        isOpen: true,
        result: {
          fromRank: "C",
          toRank: "B",
          method: "reputation",
          reputationBefore: 60,
          reputationAfter: 60,
          goldBefore: 120,
          goldAfter: 120,
          newlyUnlockedRiskLevel: 3,
        },
      },
      onSelectOffer: () => undefined,
      onContract: () => undefined,
      onOpenPromotion: () => undefined,
      onCancelPromotion: () => undefined,
      onConfirmPromotion: () => undefined,
      onDismissPromotionResult: () => undefined,
    }));

    expect(html).toContain('data-testid="u3-promotion-trigger"');
    expect(html).toContain('data-testid="u3-promotion-dialog"');
    expect(html).toContain("★3 던전 계약이 해금되었습니다.");
    expect(html).toContain('aria-modal="true"');
  });

  it("조건 미달이어도 두 승급 경로의 부족량을 보여주고 취소에 포커스를 둔다", () => {
    const html = renderToStaticMarkup(createElement(U3BoardScreen, {
      status: {
        ...status,
        canPromote: false,
      },
      board,
      selectedOfferId: "offer-1",
      promotion: {
        ...promotion,
        isOpen: true,
        eligibility: {
          ...promotion.eligibility!,
          currentReputation: 30,
          currentGold: 10,
          canPromoteByReputation: false,
          canPromoteByGold: false,
        },
      },
      onSelectOffer: () => undefined,
      onContract: () => undefined,
      onOpenPromotion: () => undefined,
      onCancelPromotion: () => undefined,
      onConfirmPromotion: () => undefined,
      onDismissPromotionResult: () => undefined,
    }));

    expect(html).toContain("명성 60 / 현재 30");
    expect(html).toContain("골드 150 / 현재 10");
    expect(html).toContain("명성 부족");
    expect(html).toContain("골드 부족");
    expect(html.match(/disabled=""/g)).toHaveLength(2);
    expect(html).toMatch(/class="u3-promotion-dialog__cancel"[^>]*autofocus=""/);
  });

  it("S등급은 승급 진입 버튼과 선택 dialog를 제공하지 않는다", () => {
    const html = renderToStaticMarkup(createElement(U3BoardScreen, {
      status: {
        ...status,
        rank: "S",
        nextPromotion: undefined,
      },
      board,
      selectedOfferId: "offer-1",
      promotion: { eligibility: null, isOpen: false, result: null },
      onSelectOffer: () => undefined,
      onContract: () => undefined,
      onOpenPromotion: () => undefined,
      onCancelPromotion: () => undefined,
      onConfirmPromotion: () => undefined,
      onDismissPromotionResult: () => undefined,
    }));

    expect(html).not.toContain('data-testid="u3-promotion-trigger"');
    expect(html).not.toContain('data-testid="u3-promotion-dialog"');
  });

  it("승급 결과를 닫으면 결과 dialog만 사라지고 게시판은 남는다", () => {
    const withResult = render("offer-1", {
      promotion: {
        ...promotion,
        isOpen: false,
        result: {
          fromRank: "C",
          toRank: "B",
          method: "reputation",
          reputationBefore: 60,
          reputationAfter: 60,
          goldBefore: 120,
          goldAfter: 120,
          newlyUnlockedRiskLevel: 3,
        },
      },
    });
    const afterDismiss = render("offer-1", {
      promotion: { ...promotion, isOpen: false, result: null },
    });

    expect(withResult).toContain("승급 완료!");
    expect(withResult).toContain("게시판으로 돌아가기");
    expect(afterDismiss).not.toContain('data-testid="u3-promotion-dialog"');
    expect(afterDismiss).toContain("길드 게시판");
  });
});
