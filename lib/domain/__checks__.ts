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
  AdviceOutcome,
  CampaignPhase,
  EcologyRelation,
  EndingKind,
  GuideRank,
  MerchantAdviceOption,
  MerchantEffect,
  MerchantSituationEvent,
  NextBattleMerchantEffect,
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
