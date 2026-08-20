export type {
  Brand,
  BossId,
  CardId,
  CharacterId,
  ChoiceId,
  ClaimId,
  ClassId,
  DungeonId,
  EcologyProfileId,
  EventId,
  ItemId,
  MonsterId,
  NodeId,
  OfferId,
  RuleId,
} from "./ids";

export { canDeploy, PERSONALITIES, TRUST_MAX, TRUST_MIN } from "./character";
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
  ECOLOGY_RULES_PER_THEME,
  RISK_LEVEL_MAX,
  RISK_LEVELS,
  THEME_IDS,
} from "./dungeon";
export type {
  BossDef,
  CampaignDungeon,
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
export type {
  BoardOffer,
  CampaignEnding,
  CampaignPhase,
  CampaignState,
  EndingKind,
  GuideRank,
  OfferLockReason,
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
export type {
  WorldTurnExecution,
  WorldTurnActivity,
  WorldTurnAssignment,
  WorldTurnOutcome,
  WorldTurnResult,
} from "./worldturn";

export type {
  BossResult,
  BossTurnRecord,
  ExpeditionResult,
  ExpeditionState,
  ExpeditionStatus,
} from "./expedition";

export { INFO_SUBJECTS, TRUTH_TYPES } from "./info";
export type {
  EventTarget,
  InfoCard,
  InfoClaim,
  InfoReaction,
  InfoRecord,
  InfoSubject,
  Target,
  TruthType,
} from "./info";

export { EVENT_EFFECT_TAGS, EVENT_KINDS, ITEM_KINDS } from "./content";
export type {
  DungeonEvent,
  EventChoice,
  EventEffectTag,
  EventKind,
  ItemDef,
  ItemKind,
} from "./content";

export { SEED_STREAMS } from "./seeds";
export type { SeedStream } from "./seeds";

export { RuleError } from "./errors";
export type { RuleErrorCode, RuleErrorDetails } from "./errors";
