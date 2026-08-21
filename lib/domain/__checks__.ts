/**
 * 컴파일 타임 도메인 계약.
 *
 * 이 파일에는 실행되는 코드가 없다. 타입 검사만으로 계약을 고정하는 것이
 * 목적이다. `F1`은 규칙도 화면도 만들지 않으므로 런타임 테스트로 잡을 것이
 * 거의 없다. 대신 닫힌 목록이 실제로 닫혀 있는지를 여기서 붙잡는다.
 *
 * 새 엔딩이나 새 단계를 추가하면서 순서 배열을 빠뜨리면 타입 검사가 먼저
 * 깨진다. 런타임 테스트만 두면 그 조합을 지나는 시드가 나올 때까지 모른다.
 *
 * `RANK_RISK_LIMIT`처럼 선언 자리에서 `Record<GuideRank, ...>`로 이미 강제되는
 * 것은 여기 다시 적지 않는다. 같은 계약을 두 곳에 두면 한쪽만 고쳐진다.
 */
import type {
  ADVICE_OUTCOMES,
  CAMPAIGN_PHASES,
  ECOLOGY_RELATIONS,
  ENDING_ORDER,
  GUIDE_RANKS,
  PERSONALITIES,
  RISK_LEVELS,
  SEED_STREAMS,
  THEME_IDS,
  WORLD_TURN_ACTIVITIES,
} from "./index";
import type {
  AdviceOption,
  AdviceOutcome,
  CampaignPhase,
  ChoiceId,
  EcologyRelation,
  EndingKind,
  EventId,
  GuideRank,
  MerchantAdviceOption,
  MerchantEffect,
  MerchantSituationEvent,
  NextBattleMerchantEffect,
  NonMerchantSituationEvent,
  PendingMerchantEffect,
  Personality,
  RiskLevel,
  SeedStream,
  ThemeId,
  WorldTurnActivity,
} from "./index";

/** 배열이 그 유니온의 모든 값을 담고 있으면 true, 빠뜨렸으면 false다. */
type IsExhaustive<TUnion, TList extends readonly unknown[]> =
  Exclude<TUnion, TList[number]> extends never ? true : false;

/** false가 들어오면 제약을 만족하지 못해 타입 검사가 실패한다. */
type Assert<T extends true> = T;
type DomainExports = typeof import("./index");

export type EndingOrderCoversEveryEnding = Assert<
  IsExhaustive<EndingKind, typeof ENDING_ORDER>
>;
export type PhaseListCoversEveryPhase = Assert<
  IsExhaustive<CampaignPhase, typeof CAMPAIGN_PHASES>
>;
export type RankListCoversEveryRank = Assert<
  IsExhaustive<GuideRank, typeof GUIDE_RANKS>
>;
export type ThemeListCoversEveryTheme = Assert<
  IsExhaustive<ThemeId, typeof THEME_IDS>
>;
export type PersonalityListCoversEveryPersonality = Assert<
  IsExhaustive<Personality, typeof PERSONALITIES>
>;
export type OutcomeListCoversEveryOutcome = Assert<
  IsExhaustive<AdviceOutcome, typeof ADVICE_OUTCOMES>
>;
export type RelationListCoversEveryRelation = Assert<
  IsExhaustive<EcologyRelation, typeof ECOLOGY_RELATIONS>
>;
export type StreamListCoversEveryStream = Assert<
  IsExhaustive<SeedStream, typeof SEED_STREAMS>
>;
export type ActivityListCoversEveryActivity = Assert<
  IsExhaustive<WorldTurnActivity, typeof WORLD_TURN_ACTIVITIES>
>;
export type RiskListCoversEveryLevel = Assert<
  IsExhaustive<RiskLevel, typeof RISK_LEVELS>
>;
export type MerchantAdviceOptionIsExported = MerchantAdviceOption;
export type MerchantEffectIsExported = MerchantEffect;
export type MerchantEventIsExported = MerchantSituationEvent;
export type NextBattleMerchantEffectIsExported = NextBattleMerchantEffect;
export type PendingMerchantEffectIsExported = PendingMerchantEffect;
export type ItemIdIsNotExported = Assert<
  "ItemId" extends keyof DomainExports ? false : true
>;

declare const checkChoiceId: ChoiceId;
declare const checkEventId: EventId;
declare function acceptAdviceOption(option: AdviceOption): void;
declare function acceptNonMerchantEvent(event: NonMerchantSituationEvent): void;

export const exactMerchantEventContract: MerchantSituationEvent = {
  id: checkEventId,
  kind: "merchant",
  title: "상인 사건",
  description: "상인이 거래를 제안한다.",
  advice: [
    {
      id: checkChoiceId,
      label: "치료를 사세요",
      line: "지금 골드를 써서 회복하자고 하세요.",
      outcome: "help",
      relation: "unrelated",
      effectTags: ["trade"],
      resultText: "상인이 상처를 봉합한다.",
      goldCost: 5,
      merchantEffect: { immediateHpDeltaPerMember: 2 },
    },
    {
      id: checkChoiceId,
      label: "수상한 약을 사세요",
      line: "강한 약이라며 사 보자고 하세요.",
      outcome: "harm",
      relation: "unrelated",
      effectTags: ["trade"],
      resultText: "상인이 독한 약을 건넨다.",
      goldCost: 5,
      merchantEffect: { nextBattle: { incomingDamageMultiplier: 1.1 } },
    },
    {
      id: checkChoiceId,
      label: "거래하지 마세요",
      line: "지금은 지나가자고 하세요.",
      outcome: "neutral",
      relation: "unrelated",
      effectTags: ["trade"],
      resultText: "상인이 어깨를 으쓱한다.",
      goldCost: 0,
    },
  ],
  defaultResultText: "파티가 거래하지 않고 지나간다.",
};

acceptAdviceOption({
  id: checkChoiceId,
  label: "공용 조언",
  line: "그냥 지나가자고 하세요.",
  outcome: "neutral",
  relation: "unrelated",
  effectTags: ["observe"],
  resultText: "아무 일도 없다.",
  // @ts-expect-error nonmerchant advice must reject merchant-only fields
  goldCost: 0,
});

acceptNonMerchantEvent({
  id: checkEventId,
  kind: "rest",
  title: "휴식 사건",
  description: "부상자를 돌볼 틈이 생겼다.",
  // @ts-expect-error nonmerchant event must reject merchant advice payloads
  advice: [exactMerchantEventContract.advice[0], exactMerchantEventContract.advice[1], exactMerchantEventContract.advice[2]],
  defaultResultText: "파티가 알아서 쉬어 간다.",
});
