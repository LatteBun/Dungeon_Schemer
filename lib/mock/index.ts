import type { DungeonEvent, DungeonNode, EventId } from "@/lib/domain";
import { MOCK_DUNGEON } from "./dungeon";
import { MOCK_EVENTS } from "./events";

export { MOCK_CARDS } from "./cards";
export { MOCK_CLASSES } from "./classes";
export { MOCK_DUNGEON } from "./dungeon";
export { MOCK_EVENTS } from "./events";
export { MOCK_PARTY } from "./party";
export { MOCK_RUN } from "./run";

export function findEvent(eventId: EventId): DungeonEvent {
  const found = MOCK_EVENTS.find((event) => event.id === eventId);
  if (found === undefined) throw new Error(`목 이벤트를 찾을 수 없다: ${eventId}`);
  return found;
}

export function findNode(nodeId: string): DungeonNode | undefined {
  return MOCK_DUNGEON.nodes.find((node) => node.id === nodeId);
}
