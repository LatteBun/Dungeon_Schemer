"use client";

import type { ReactNode } from "react";
import { PartySidebar } from "@/components/game/PartySidebar";
import { ResourceBar } from "@/components/game/ResourceBar";
import { CLASSES } from "@/lib/content/classes";
import { useRunStore } from "@/lib/stores/game-store-provider";

/** 네 화면 모두에 놓이는 ① 현재 위치·상태와 ④ 파티·개인 신뢰다. */
export function PlayChrome({ children }: { children: ReactNode }) {
  const run = useRunStore((store) => store.run);
  const currentDepth =
    run.dungeon.nodes.find((node) => node.id === run.currentNodeId)?.depth ?? 0;
  const latestChanges = run.log.at(-1)?.trustChanges ?? [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
      <ResourceBar
        resources={run.resources}
        phase={run.phase}
        depth={currentDepth}
      />
      <div className="flex flex-1 flex-col gap-3 lg:flex-row">
        <main className="flex flex-1 flex-col gap-3">{children}</main>
        <PartySidebar
          party={run.party}
          classes={[...CLASSES]}
          latestChanges={latestChanges}
          className="lg:w-72 lg:shrink-0"
        />
      </div>
    </div>
  );
}
