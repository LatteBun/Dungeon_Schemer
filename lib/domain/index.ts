export type {
  Brand,
  BossId,
  BossRuleId,
  CardId,
  CharacterId,
  CampaignEventId,
  CampaignEventSourceKey,
  ChoiceId,
  ClaimId,
  ClueId,
  ClassId,
  DungeonId,
  EcologyProfileId,
  EventId,
  MonsterId,
  NodeId,
  OfferId,
  RuleId,
} from "./ids";

export { canDeploy, canDeployEmergency, PERSONALITIES, TRUST_MAX, TRUST_MIN } from "./character";
export type { Character, ClassDef, Personality, TrustChange } from "./character";

export {
  CHARACTER_POOL_SIZE,
  CHARACTERS_PER_CLASS,
  CHARACTERS_PER_PERSONALITY,
  EXPEDITION_PARTY_SIZE,
} from "./pool";
export type { CharacterPool, ExpeditionParty } from "./pool";

export {
  ACTIVE_ECOLOGY_RULES,
  CAMPAIGN_DUNGEON_ORDERS,
  ECOLOGY_RULES_PER_THEME,
  RISK_LEVEL_MAX,
  RISK_LEVELS,
  THEME_IDS,
} from "./dungeon";
export type {
  BossDef,
  CampaignDungeonOrder,
  BossRule,
  CampaignDungeon,
  DungeonLayer,
  DungeonNode,
  DungeonStatus,
  EcologyRule,
  EcologyProfile,
  GeneratedMap,
  MonsterDef,
  NodeKind,
  RiskLevel,
  ThemeContent,
  ThemeId,
} from "./dungeon";

export {
  BOARD_OFFER_MAX,
  CAMPAIGN_DUNGEON_COUNT,
  CAMPAIGN_PHASES,
  DENOUNCE_THRESHOLD,
  ENDING_ORDER,
  GOLD_START,
  GUIDE_RANKS,
  PROMOTION_GOLD,
  PROMOTION_REPUTATION,
  RANK_RISK_LIMIT,
  REPUTATION_MIN,
  REPUTATION_START,
} from "./campaign";

export {
  FULL_SURVIVOR_REWARDS,
  rewardForSurvivors,
} from "./settlement";
export type {
  Reward,
  SettlementCauseInputs,
  SettlementMemberChange,
  SettlementResult,
  SettlementSnapshot,
} from "./settlement";
export { createCampaignStatistics } from "./statistics";
export type { CampaignStatistics, SettlementSummary } from "./statistics";
export { createCampaignHistory } from "./history";
export type {
  AdviceResolvedEvent,
  BossBattleResolvedEvent,
  CampaignEndedEvent,
  CampaignEvent,
  CampaignEventDraft,
  CampaignEventIdentity,
  CampaignEventSource,
  CampaignHistory,
  ExpeditionSettledEvent,
  GuidePromotedEvent,
  TrustCollapsedEvent,
  TurningPoint,
  TurningPointKind,
} from "./history";
export type {
  ActiveExpeditionContext,
  ExpeditionOutcome,
  ExpeditionRecord,
  CampaignTransition,
  CampaignTransitionContext,
  CampaignTransitionResult,
} from "./campaign-transition";
export { createCampaignTransitionContext } from "./campaign-transition";
export type {
  BoardOffer,
  CampaignEnding,
  CampaignPhase,
  CampaignState,
  EndingKind,
  GuideRank,
  OfferLockReason,
  PromotionEligibility,
  PromotionExecution,
  PromotionMethod,
  PromotionResult,
} from "./campaign";

export {
  BACKGROUND_HP_FLOOR,
  FORCED_REST_HP_RATIO,
  GRAVELY_WOUNDED_HP_RATIO,
  REST_RECOVERY_MIN,
  REST_RECOVERY_RATIO,
  WORLD_TURN_ACTIVITIES,
  runWorldTurn,
} from "./worldturn";
export { CAMPAIGN_BALANCE } from "../balance/campaign-balance";
export type { AdvicePressure } from "../balance/campaign-balance";
export type {
  WorldTurnExecution,
  WorldTurnActivity,
  WorldTurnAssignment,
  WorldTurnOutcome,
  WorldTurnResult,
} from "./worldturn";

export type {
  BossResult,
  BossInfoApplication,
  BossInfoAxis,
  BossInfoDirection,
  BossInfoPresentationCue,
  BossInfoTiming,
  BossInfoVerification,
  BossInfoVerificationAction,
  ExpeditionResult,
  ExpeditionState,
  ExpeditionStatus,
  PendingMerchantEffect,
  PreparedExpeditionEvents,
  PreparedNodePlan,
  BossInfoCut,
  StrongLinkPlan,
  MaterializedNodeEvent,
  HiddenNodeRole,
} from "./expedition";

export type {
  BattleActionRecord,
  BattleEnemyInput,
  BattlePartyMember,
  BattleResolution,
} from "./battle";

export { ADVICE_OUTCOMES, ECOLOGY_RELATIONS } from "./info";
export type {
  AdviceOutcome,
  EcologyRelation,
  EventTarget,
  InfoReaction,
  InfoRecord,
  Target,
} from "./info";
export type {
  AdviceDecision,
  AdviceFeedback,
  AdviceResolution,
  MemberReaction,
  PresentedAdviceOption,
} from "./info";

export { EVENT_EFFECT_TAGS, EVENT_KINDS } from "./content";
export type {
  AdviceOption,
  AdviceSource,
  AdviceUpgrade,
  BaseAdviceOption,
  EventEffectTag,
  EventKind,
  MerchantAdviceOption,
  MerchantEffect,
  MerchantSituationEvent,
  NextBattleMerchantEffect,
  NonMerchantAdviceOption,
  NonMerchantSituationEvent,
  SituationEvent,
  EncounterDefinition,
  EncounterEnemyGroup,
  EncounterModifier,
  ImmediateEventEffect,
} from "./content";

export { SEED_STREAMS } from "./seeds";
export type { SeedStream } from "./seeds";

export { RuleError } from "./errors";
export type { RuleErrorCode, RuleErrorDetails } from "./errors";
