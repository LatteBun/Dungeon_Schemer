import type { CardId, ClaimId, DecisionRecord, InfoClaim, MemberId, NodeId, RunState } from "@/lib/domain";
import { MOCK_DUNGEON } from "./dungeon";
import { MOCK_PARTY } from "./party";

const MOCK_CLAIMS: InfoClaim[] = [
  { id: "claim-empty-path" as ClaimId, cardId: "card-empty-path" as CardId, target: { kind: "member", id: "m-is" as MemberId }, toldAt: 1 },
];

const MOCK_LOG: DecisionRecord[] = [
  { at: 0, nodeId: "n-entry" as NodeId, summary: "리엔에게 이 층의 소문을 사실대로 말했다.", trustChanges: [{ memberId: "m-rien" as MemberId, delta: 4, reason: "정의로운 성격: 숨기지 않은 답변" }] },
  { at: 1, nodeId: "n-a2" as NodeId, summary: "이스에게 왼쪽 길이 비어 있다고 말했다.", trustChanges: [{ memberId: "m-is" as MemberId, delta: -6, reason: "의심 많은 성격: 근거를 물었으나 답하지 못함" }] },
];

/** 화면이 읽는 단일 출처다. 실제 상태가 붙으면 app의 import만 바뀐다. */
export const MOCK_RUN: RunState = {
  seed: "mock-shell-0001", phase: "event", party: MOCK_PARTY, dungeon: MOCK_DUNGEON,
  currentNodeId: "n-a2" as NodeId,
  resources: { gold: 12, food: 4, reputation: 7 },
  pendingClaims: MOCK_CLAIMS,
  log: MOCK_LOG,
};
