import Link from "next/link";
import { DungeonMap } from "@/components/game/DungeonMap";
import { Panel } from "@/components/ui/Panel";
import { MOCK_EVENTS, MOCK_RUN } from "@/lib/mock";

export default function MapPage() {
  const visitedNodeIds = MOCK_RUN.log.map((record) => record.nodeId);
  return <Panel title="던전 분기 지도" aside={<Link href="/play/result" className="text-xs text-muted underline hover:text-parchment">결과 화면 보기</Link>}>
    <p className="mb-3 text-sm text-muted">입구는 맨 아래 한 곳이다. 어떤 길을 골라도 맨 위의 보스방으로 모인다. 당신이 길을 고른다.</p>
    <DungeonMap dungeon={MOCK_RUN.dungeon} events={MOCK_EVENTS} currentNodeId={MOCK_RUN.currentNodeId} visitedNodeIds={visitedNodeIds} />
  </Panel>;
}
