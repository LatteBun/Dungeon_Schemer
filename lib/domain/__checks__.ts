// 이 파일은 컴파일에 성공하는 것 자체가 검사다.
// 런타임에 실행하지 않으며 애플리케이션이 가져오지 않는다.
// 모든 값을 export하는 이유는 no-unused-vars 규칙을 피하기 위함이다.
import type {
  CardId,
  ChoiceId,
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
import type {
  DungeonEvent,
  DungeonNode,
  DungeonState,
  EventChoice,
} from "./dungeon";
import { RUN_PHASES } from "./run";
import type {
  DecisionRecord,
  Resources,
  RunState,
  TrustChange,
} from "./run";
import * as domain from "@/lib/domain";

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

export const sampleChoice: EventChoice = {
  id: "choice-help-heroes" as ChoiceId,
  label: "용사를 지원한다",
  target: sampleTargetMember,
  expectedGain: "성직자의 신뢰를 얻는다",
  knownRisk: "보스와의 관계가 나빠진다",
};

// target은 선택 사항이다. 파티 전체나 상황 자체를 향하는 행동이 있다.
export const sampleChoiceWithoutTarget: EventChoice = {
  id: "choice-watch" as ChoiceId,
  label: "관망한다",
  expectedGain: "관계 변화를 줄인다",
  knownRisk: "기회를 잃는다",
};

export const sampleEvent: DungeonEvent = {
  id: "event-goblin-ambush" as EventId,
  kind: "monster",
  title: "고블린 매복",
  description: "좁은 길에서 고블린 세 마리가 튀어나온다.",
  choices: [sampleChoice, sampleChoiceWithoutTarget],
};

// 브랜드가 동작하면 ChoiceId를 NodeId 자리에 넣을 수 없다.
// @ts-expect-error ChoiceId는 NodeId에 대입할 수 없다
export const wrongChoiceId: NodeId = sampleChoice.id;

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

export const runPhaseCount: 6 = RUN_PHASES.length;

export const sampleResources: Resources = {
  gold: 20,
  food: 3,
  reputation: 0,
};

export const sampleTrustChange: TrustChange = {
  memberId,
  delta: -8,
  reason: "정의로운 성격: 거짓 정보가 발각됨",
};

export const sampleRecord: DecisionRecord = {
  at: 0,
  nodeId: entryNode.id,
  summary: "성직자에게 보스 약점을 사실대로 알렸다.",
  trustChanges: [sampleTrustChange],
};

// 필수 필드가 모두 있는 완전한 런 상태다.
// 필드를 하나라도 빼면 컴파일이 실패한다.
export const sampleRunState: RunState = {
  seed: "seed-0001",
  phase: "pathChoice",
  party: [sampleMember],
  dungeon: sampleDungeon,
  currentNodeId: entryNode.id,
  resources: sampleResources,
  pendingClaims: [sampleClaim],
  log: [sampleRecord],
};

// 목록에 없는 단계는 대입할 수 없다.
// @ts-expect-error growth는 확정된 진행 단계 여섯에 없다
export const wrongPhase: RunState["phase"] = "growth";

// 배럴이 모든 공개 타입과 상수를 내보내는지 확인한다.
// 다른 작업은 개별 파일이 아니라 이 경로에서 가져온다.
export const barrelHasAllConstants: [5, 4, 3, 6, 3, 5, 0, 100] = [
  domain.PERSONALITIES.length,
  domain.EVENT_KINDS.length,
  domain.TRUTH_TYPES.length,
  domain.RUN_PHASES.length,
  domain.PARTY_SIZE_MIN,
  domain.PARTY_SIZE_MAX,
  domain.TRUST_MIN,
  domain.TRUST_MAX,
];

export const barrelRunState: domain.RunState = sampleRunState;
export const barrelMember: domain.PartyMember = sampleMember;
export const barrelCard: domain.InfoCard = sampleCard;
export const barrelClaim: domain.InfoClaim = sampleClaim;
export const barrelNode: domain.DungeonNode = entryNode;
export const barrelRecord: domain.DecisionRecord = sampleRecord;
export const barrelClassDef: domain.ClassDef = sampleClass;
export const barrelTarget: domain.Target = sampleTargetBoss;
export const barrelEvent: domain.DungeonEvent = sampleEvent;
export const barrelDungeon: domain.DungeonState = sampleDungeon;
export const barrelResources: domain.Resources = sampleResources;
export const barrelTrustChange: domain.TrustChange = sampleTrustChange;
export const barrelChoice: domain.EventChoice = sampleChoice;
export const barrelChoiceId: domain.ChoiceId = sampleChoice.id;
