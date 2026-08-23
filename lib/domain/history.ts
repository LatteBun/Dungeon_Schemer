import type { CampaignEnding, GuideRank, PromotionMethod } from "./campaign";
import type { CharacterId, ChoiceId, DungeonId, EventId } from "./ids";
import type { BossId } from "./ids";
import type { ExpeditionStatus } from "./expedition";
import type { AdviceOutcome, MemberReaction } from "./info";
import type { CampaignEventId, CampaignEventSourceKey } from "./ids";

export interface CampaignEventIdentity {
  readonly id: CampaignEventId;
  readonly campaignTurn: number;
  readonly sequence: number;
}

export interface CampaignEventSource {
  readonly sourceKey: CampaignEventSourceKey;
}

export interface AdviceResolvedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "ADVICE_RESOLVED";
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly sourceEventId: EventId;
  readonly adviceId: ChoiceId;
  readonly outcome: AdviceOutcome;
  readonly executed: boolean;
  readonly reactions: readonly MemberReaction[];
}

export interface BossBattleResolvedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "BOSS_BATTLE_RESOLVED";
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly bossId: BossId;
  readonly status: ExpeditionStatus;
  readonly survivorIds: readonly CharacterId[];
  readonly verificationCount: number;
}

export interface ExpeditionSettledEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "EXPEDITION_SETTLED";
  readonly expeditionId: string;
  readonly dungeonId: DungeonId;
  readonly status: ExpeditionStatus;
  readonly deceasedCharacterIds: readonly CharacterId[];
}

export interface GuidePromotedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "GUIDE_PROMOTED";
  readonly fromRank: GuideRank;
  readonly toRank: GuideRank;
  readonly method: PromotionMethod;
}

export interface TrustCollapsedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "TRUST_COLLAPSED";
  readonly expeditionId: string;
  readonly triggerCharacterIds: readonly CharacterId[];
}

export interface CampaignEndedEvent extends CampaignEventIdentity, CampaignEventSource {
  readonly type: "CAMPAIGN_ENDED";
  readonly ending: CampaignEnding;
}

export type CampaignEvent =
  | AdviceResolvedEvent
  | BossBattleResolvedEvent
  | ExpeditionSettledEvent
  | GuidePromotedEvent
  | TrustCollapsedEvent
  | CampaignEndedEvent;

type WithoutCampaignEventIdentity<T extends CampaignEvent> =
  T extends CampaignEventIdentity
    ? Omit<T, keyof CampaignEventIdentity>
    : never;

export type CampaignEventDraft = WithoutCampaignEventIdentity<CampaignEvent>;

export type TurningPointKind =
  | "firstCharacterDeath"
  | "bossBreakthrough"
  | "trustCollapse"
  | "campaignEnded";

export interface TurningPoint {
  readonly eventId: CampaignEventId;
  readonly kind: TurningPointKind;
  readonly campaignTurn: number;
  readonly sequence: number;
}

export interface CampaignHistory {
  readonly events: readonly CampaignEvent[];
  readonly turningPoints: readonly TurningPoint[];
}

export function createCampaignHistory(): CampaignHistory {
  return { events: [], turningPoints: [] };
}
