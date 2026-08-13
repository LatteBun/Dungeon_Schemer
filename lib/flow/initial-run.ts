import type { DungeonEvent, Resources, RunState } from "@/lib/domain";
import { createRng } from "@/lib/rng";
import { generateDungeon } from "@/lib/rules/dungeon";
import { generateParty } from "@/lib/rules/party";

/**
 * 잠정값. 자원의 공식 초기값은 아직 확정 전이다(CORE_GAME_LOOP.md).
 * 확정되면 이 상수를 교체한다.
 */
export const INITIAL_RESOURCES: Resources = { gold: 10, food: 5, reputation: 0 };

export interface CreateInitialRunOptions {
  /** 초기 자원. 생략하면 잠정 기본값을 쓴다. */
  readonly resources?: Resources;
}

export interface InitialRun {
  readonly run: RunState;
  readonly events: DungeonEvent[];
}

/**
 * R1 파티 생성과 R4 던전 생성을 묶어 partyIntro 시작 상태를 만든다.
 * 같은 시드는 같은 시작 상태를 재현한다. events는 transitionRun의
 * RunMachineContext로 그대로 넘긴다.
 */
export function createInitialRun(
  seed: string,
  options: CreateInitialRunOptions = {},
): InitialRun {
  const rng = createRng(seed);
  const party = generateParty(rng.derive("party"));
  const { dungeon, events } = generateDungeon(rng.derive("dungeon"));

  return {
    run: {
      seed,
      phase: "partyIntro",
      party,
      dungeon,
      currentNodeId: dungeon.entryNodeId,
      resources: { ...(options.resources ?? INITIAL_RESOURCES) },
      pendingClaims: [],
      log: [],
    },
    events,
  };
}
