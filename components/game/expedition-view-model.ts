import { CLASSES } from "@/lib/content/classes";
import { EVENT_KIND_RISK_SUMMARY } from "@/lib/content/events";
import type { MapIconKind } from "./MapNodeIcon";
import type {
  CampaignMember,
  CardId,
  ChoiceId,
  ClassId,
  DungeonEvent,
  EventId,
  EventKind,
  GeneratedMap,
  Grade,
  InfoCard,
  InfoReaction,
  ItemDef,
  ItemId,
  MapNode,
  MemberId,
  NodeId,
  PendingInfo,
  TruthType,
} from "@/lib/domain";
import type { PartyInfoCardEvaluation } from "@/lib/rules/info";
import {
  EVENT_KIND_LABELS,
  EVENT_KIND_MARKS,
  PERSONALITY_LABELS,
  TRUTH_TYPE_LABELS,
} from "./labels";
import { layoutMap } from "./map-layout";
import type { MapLayoutEdge } from "./map-layout";

const MAP_CAPTION = "공개 지도는 결과를 숨기지 않지만 사건의 정확한 수치는 숨긴다.";

const TRUTH_MARKS: Readonly<Record<TruthType, string>> = {
  truth: "✓",
  lie: "!",
  neutral: "?",
};

const EXPECTED_NOTE: Readonly<Record<TruthType, string>> = {
  truth: "안정적 전술 효과 · 검증 가능",
  lie: "큰 전술 왜곡 · 사후 검증",
  neutral: "약한 정보 효과 · 즉시 신뢰 변화 없음",
};

const REACTION_LABELS: Readonly<Record<InfoReaction, string>> = {
  accepted: "수용",
  suspected: "의심",
  exposed: "적발",
};

const REACTION_MARKS: Readonly<Record<InfoReaction, string>> = {
  accepted: "✓",
  suspected: "?",
  exposed: "!",
};

const REACTION_NOTES: Readonly<Record<InfoReaction, string>> = {
  accepted: "효과 적용 · 미검증 기록",
  suspected: "효과 없음 · 의심 검증 기록",
  exposed: "효과 없음 · 기만 적발 기록",
};

function classNameOf(classId: ClassId): string {
  return CLASSES.find((klass) => klass.id === classId)?.name ?? "직업 미정";
}

// --- 지도 ---

export type MapNodeState = "current" | "visited" | "selectable" | "inactive";

export interface MapNodeView {
  id: NodeId;
  x: number;
  y: number;
  categoryLabel: string;
  categoryMark: string;
  hasInfo: boolean;
  state: MapNodeState;
  isBoss: boolean;
  riskSummary: string;
  /** 지점에 그릴 아이콘. 범례를 찾지 않아도 무엇인지 읽히게 한다. */
  icon: MapIconKind | "boss";
  /** 보스방일 때 어느 보스인지. 등급마다 실루엣이 다르다. */
  grade: Grade;
}

export interface MapView {
  viewWidth: number;
  viewHeight: number;
  edges: MapLayoutEdge[];
  nodes: MapNodeView[];
  bossNodeId: NodeId;
  caption: string;
}

export function toMapView(
  map: GeneratedMap,
  currentNodeId: NodeId,
  visitedNodeIds: readonly NodeId[],
  eventKindById: (eventId: EventId) => EventKind,
): MapView {
  const layout = layoutMap(map);
  const positionById = new Map(layout.nodes.map((node) => [node.id, node]));
  const currentNode = map.nodes.find((node) => node.id === currentNodeId);
  const nextIds = new Set<string>(currentNode?.nextNodeIds ?? []);
  const visited = new Set<string>(visitedNodeIds);

  const nodes = map.nodes.map((node): MapNodeView => {
    const position = positionById.get(node.id);
    const x = position?.x ?? 0;
    const y = position?.y ?? 0;
    const isBoss = node.id === map.bossNodeId;
    const isEntry = node.id === map.entryNodeId;

    let state: MapNodeState;
    if (node.id === currentNodeId) {
      state = "current";
    } else if (visited.has(node.id)) {
      state = "visited";
    } else if (nextIds.has(node.id)) {
      state = "selectable";
    } else {
      state = "inactive";
    }

    // 입구는 전용 사건을 쓰고 일반 풀에 없다. 분류를 물으면 조회가 실패한다.
    const kind = isBoss || isEntry ? null : eventKindById(node.eventId);
    const icon: MapIconKind | "boss" = isBoss
      ? "boss"
      : isEntry
        ? "entry"
        : (kind as EventKind);
    const categoryLabel = isBoss
      ? "보스방"
      : isEntry
        ? "입구"
        : EVENT_KIND_LABELS[kind as EventKind];
    const categoryMark = isBoss ? "★" : kind === null ? "" : EVENT_KIND_MARKS[kind];

    return {
      id: node.id,
      x,
      y,
      categoryLabel,
      categoryMark,
      hasInfo: node.hasInfoOpportunity,
      state,
      isBoss,
      riskSummary: node.riskSummary,
      icon,
      grade: map.grade,
    };
  });

  return {
    viewWidth: layout.viewWidth,
    viewHeight: layout.viewHeight,
    edges: layout.edges,
    nodes,
    bossNodeId: map.bossNodeId,
    caption: MAP_CAPTION,
  };
}

// --- 정보 기회 ---

export interface InfoCardView {
  cardId: CardId;
  truthType: TruthType;
  truthLabel: string;
  truthMark: string;
  topic: string;
  text: string;
  expectedNote: string;
  dashed: boolean;
}

export interface InfoSceneView {
  sceneText: string;
  riskSummary: string;
  memberNames: { id: MemberId; name: string; alive: boolean }[];
}

export interface InfoOpportunityView {
  scene: InfoSceneView;
  cards: InfoCardView[];
}

export function toInfoOpportunityView(
  pendingInfo: PendingInfo,
  cardById: (cardId: CardId) => InfoCard,
  sceneNode: MapNode,
  event: DungeonEvent,
  party: readonly CampaignMember[],
): InfoOpportunityView {
  const cards = pendingInfo.cardIds.map((cardId): InfoCardView => {
    const card = cardById(cardId);
    return {
      cardId: card.id,
      truthType: card.truthType,
      truthLabel: TRUTH_TYPE_LABELS[card.truthType],
      truthMark: TRUTH_MARKS[card.truthType],
      topic: card.topic,
      text: card.text,
      expectedNote: EXPECTED_NOTE[card.truthType],
      dashed: card.truthType === "lie",
    };
  });

  return {
    scene: {
      sceneText: event.title,
      riskSummary: `공개 위험: ${sceneNode.riskSummary}`,
      memberNames: party.map((member) => ({
        id: member.id,
        name: member.name,
        alive: member.alive,
      })),
    },
    cards,
  };
}

// --- 개인별 반응 ---

export interface MemberReactionView {
  memberId: MemberId;
  name: string;
  className: string;
  personalityLabel: string;
  reaction: InfoReaction;
  reactionLabel: string;
  reactionMark: string;
  trustDelta: number;
  currentHp: number;
  maxHp: number;
  trust: number;
  note: string;
}

export function toInfoReactionsView(
  evaluation: PartyInfoCardEvaluation<CampaignMember>,
): MemberReactionView[] {
  return evaluation.memberResults.map((result): MemberReactionView => {
    const member = result.member;
    const evaluated = result.trustEvaluation?.member ?? member;
    return {
      memberId: member.id,
      name: member.name,
      className: classNameOf(member.classId),
      personalityLabel: PERSONALITY_LABELS[member.personality],
      reaction: result.reaction,
      reactionLabel: REACTION_LABELS[result.reaction],
      reactionMark: REACTION_MARKS[result.reaction],
      trustDelta: result.trustEvaluation?.change.delta ?? 0,
      currentHp: member.currentHp,
      maxHp: member.maxHp,
      trust: evaluated.trust,
      note: REACTION_NOTES[result.reaction],
    };
  });
}

// --- 사건 행동 ---

export interface EventChoiceView {
  choiceId: ChoiceId;
  label: string;
  expectedGain: string;
  knownRisk: string;
  disabled: boolean;
  disabledReason: string | null;
}

export interface EventView {
  title: string;
  kindLabel: string;
  description: string;
  riskSummary: string;
  choices: EventChoiceView[];
}

export function toEventView(
  event: DungeonEvent,
  currentGold: number,
  itemById: (itemId: ItemId) => ItemDef | undefined,
): EventView {
  const choices = event.choices.map((choice): EventChoiceView => {
    let disabled = false;
    let disabledReason: string | null = null;
    if (choice.effectTags.includes("trade") && choice.itemId !== undefined) {
      const item = itemById(choice.itemId);
      if (item !== undefined && item.price > currentGold) {
        disabled = true;
        disabledReason = `골드 부족(${item.price}G)`;
      }
    }
    return {
      choiceId: choice.id,
      label: choice.label,
      expectedGain: choice.expectedGain,
      knownRisk: choice.knownRisk,
      disabled,
      disabledReason,
    };
  });

  return {
    title: event.title,
    kindLabel: EVENT_KIND_LABELS[event.kind],
    description: event.description,
    riskSummary: `공개 위험: ${EVENT_KIND_RISK_SUMMARY[event.kind]}`,
    choices,
  };
}

// --- 파티 상태 ---

export interface MemberStatusView {
  memberId: MemberId;
  name: string;
  className: string;
  alive: boolean;
  currentHp: number;
  maxHp: number;
  trust: number;
  trustDelta: number;
  carriedGold: number;
  memoryNote: string;
}

export function toPartyStatusView(
  members: readonly CampaignMember[],
  trustDeltaById: Readonly<Record<string, number>> = {},
): MemberStatusView[] {
  return members.map((member): MemberStatusView => ({
    memberId: member.id,
    name: member.name,
    className: classNameOf(member.classId),
    alive: member.alive,
    currentHp: member.currentHp,
    maxHp: member.maxHp,
    trust: member.trust,
    trustDelta: trustDeltaById[member.id] ?? 0,
    carriedGold: member.carriedGold,
    memoryNote:
      member.memory.length === 0
        ? "최근 변화 없음"
        : member.memory[member.memory.length - 1].summary,
  }));
}
