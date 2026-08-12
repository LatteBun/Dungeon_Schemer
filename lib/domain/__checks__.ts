// 이 파일은 컴파일에 성공하는 것 자체가 검사다.
// 런타임에 실행하지 않으며 애플리케이션이 가져오지 않는다.
// 모든 값을 export하는 이유는 no-unused-vars 규칙을 피하기 위함이다.
import type {
  CardId,
  ClaimId,
  ClassId,
  EventId,
  MemberId,
  NodeId,
} from "./ids";
import {
  PARTY_SIZE_MAX,
  PARTY_SIZE_MIN,
  PERSONALITIES,
  TRUST_MAX,
  TRUST_MIN,
} from "./party";
import type { ClassDef, PartyMember, Personality } from "./party";
import { TRUTH_TYPES } from "./info";
import type { InfoCard, InfoClaim, Target } from "./info";
import { EVENT_KINDS } from "./dungeon";
import type { DungeonEvent, DungeonNode, DungeonState } from "./dungeon";

export const memberId = "m1" as MemberId;
export const nodeId = "n1" as NodeId;

// 브랜드가 동작하면 NodeId를 MemberId 자리에 넣을 수 없다.
// @ts-expect-error NodeId는 MemberId에 대입할 수 없다
export const wrongId: MemberId = nodeId;

// 상수의 개수와 값이 설정집과 맞는지 확인한다.
export const personalityCount: 5 = PERSONALITIES.length;
export const partySizeRange: [3, 5] = [PARTY_SIZE_MIN, PARTY_SIZE_MAX];
export const trustRange: [0, 100] = [TRUST_MIN, TRUST_MAX];

export const sampleClass: ClassDef = {
  id: "warrior" as ClassId,
  name: "전사",
  description: "앞에서 버티며 파티의 피해를 받아낸다.",
};

export const sampleMember: PartyMember = {
  id: memberId,
  name: "라스",
  classId: sampleClass.id,
  personality: "righteous",
  trust: 55,
  alive: true,
};

// 목록에 없는 성격은 대입할 수 없다.
// @ts-expect-error brave는 확정된 성격 다섯에 없다
export const wrongPersonality: Personality = "brave";

export const truthTypeCount: 3 = TRUTH_TYPES.length;
export const eventKindCount: 4 = EVENT_KINDS.length;

export const sampleTargetMember: Target = { kind: "member", id: memberId };
export const sampleTargetBoss: Target = { kind: "boss" };

export const sampleCard: InfoCard = {
  id: "card-boss-weakness-fire" as CardId,
  truthType: "truth",
  topic: "보스 약점",
  text: "보스는 화염에 약하다.",
};

export const sampleClaim: InfoClaim = {
  id: "claim-1" as ClaimId,
  cardId: sampleCard.id,
  target: sampleTargetMember,
  toldAt: 0,
};

export const sampleEvent: DungeonEvent = {
  id: "event-goblin-ambush" as EventId,
  kind: "monster",
  title: "고블린 매복",
  description: "좁은 길에서 고블린 세 마리가 튀어나온다.",
};

export const bossNode: DungeonNode = {
  id: "n-boss" as NodeId,
  depth: 2,
  eventId: sampleEvent.id,
  nextNodeIds: [],
};

export const entryNode: DungeonNode = {
  id: nodeId,
  depth: 0,
  eventId: sampleEvent.id,
  nextNodeIds: [bossNode.id],
};

export const sampleDungeon: DungeonState = {
  nodes: [entryNode, bossNode],
  entryNodeId: entryNode.id,
  bossNodeId: bossNode.id,
};

// 목록에 없는 이벤트 분류는 대입할 수 없다.
// @ts-expect-error trap은 확정된 이벤트 분류 넷에 없다
export const wrongEventKind: DungeonEvent["kind"] = "trap";
