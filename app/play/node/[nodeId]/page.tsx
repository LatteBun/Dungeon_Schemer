import Link from "next/link";
import { notFound } from "next/navigation";
import { ChoiceList } from "@/components/game/ChoiceList";
import { SceneStage } from "@/components/game/SceneStage";
import { Panel } from "@/components/ui/Panel";
import { MOCK_CARDS, MOCK_DUNGEON, MOCK_RUN, findEvent, findNode } from "@/lib/mock";

export function generateStaticParams() {
  return MOCK_DUNGEON.nodes.map((node) => ({ nodeId: node.id }));
}

export default async function NodePage({ params }: { params: Promise<{ nodeId: string }> }) {
  const { nodeId } = await params;
  const node = findNode(nodeId);
  if (node === undefined) notFound();
  const event = findEvent(node.eventId);
  const isBoss = node.id === MOCK_DUNGEON.bossNodeId;
  return <><SceneStage party={MOCK_RUN.party} event={event} isBoss={isBoss} /><Panel title={isBoss ? "보스전" : "이벤트와 선택"} aside={<Link href="/play/map" className="text-xs text-muted underline hover:text-parchment">지도로 돌아가기</Link>} className="flex-1"><ChoiceList event={event} party={MOCK_RUN.party} cards={MOCK_CARDS} /></Panel></>;
}
