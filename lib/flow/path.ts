import type { NodeId, RunState } from "@/lib/domain";

/**
 * 입구부터 현재 위치까지, 로그의 nodeId 순서로 방문 경로를 재구성한다.
 *
 * P1 상태 머신은 이벤트 완료와 경로 선택을 모두 로그에 남기므로, 연속
 * 중복만 걷어내면 방문 순서가 나온다. RunState에 방문 목록을 따로 두지
 * 않는 이유다. U3 지도가 지나온 경로를 그리고 R5 정산이 방문 노드를
 * 집계할 때 쓴다.
 * docs/superpowers/specs/2026-08-13-sbh3821-game-state-machine-design.md
 */
export function reconstructPath(run: RunState): NodeId[] {
  const path: NodeId[] = [run.dungeon.entryNodeId];
  for (const record of run.log) {
    if (record.nodeId !== path[path.length - 1]) {
      path.push(record.nodeId);
    }
  }
  return path;
}
