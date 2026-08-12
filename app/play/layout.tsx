import type { ReactNode } from "react";
import { PartySidebar } from "@/components/game/PartySidebar";
import { ResourceBar } from "@/components/game/ResourceBar";
import { MOCK_CLASSES, MOCK_RUN, findNode } from "@/lib/mock";

export default function PlayLayout({ children }: { children: ReactNode }) {
  const currentDepth = findNode(MOCK_RUN.currentNodeId)?.depth ?? 0;
  const latestChanges = MOCK_RUN.log.at(-1)?.trustChanges ?? [];
  return <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
    <ResourceBar resources={MOCK_RUN.resources} phase={MOCK_RUN.phase} depth={currentDepth} />
    <div className="flex flex-1 flex-col gap-3 lg:flex-row">
      <main className="flex flex-1 flex-col gap-3">{children}</main>
      <PartySidebar party={MOCK_RUN.party} classes={MOCK_CLASSES} latestChanges={latestChanges} className="lg:w-72 lg:shrink-0" />
    </div>
  </div>;
}
