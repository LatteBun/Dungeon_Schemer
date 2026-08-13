import type { ReactNode } from "react";
import { PartySidebar } from "@/components/game/PartySidebar";
import { ResourceBar } from "@/components/game/ResourceBar";
import { MOCK_CLASSES, MOCK_RUN, findNode } from "@/lib/mock";
import { PERSONALITY_PROFILES } from "@/lib/rules/personality-profile";
import { recentTrustChanges } from "@/lib/rules/trust-history";
import { UiStoreProvider } from "@/lib/stores/game-store-provider";

export default function PlayLayout({ children }: { children: ReactNode }) {
  const currentDepth = findNode(MOCK_RUN.currentNodeId)?.depth ?? 0;
  const latestChanges = MOCK_RUN.log.at(-1)?.trustChanges ?? [];
  // 클라이언트 컴포넌트로 넘어가므로 직렬화 가능한 평범한 객체로 만든다.
  const history = Object.fromEntries(
    MOCK_RUN.party.map((member) => [member.id, recentTrustChanges(MOCK_RUN.log, member.id)] as const),
  );
  return <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-3 p-3">
    <ResourceBar resources={MOCK_RUN.resources} phase={MOCK_RUN.phase} depth={currentDepth} />
    <div className="flex flex-1 flex-col gap-3 lg:flex-row">
      <main className="flex flex-1 flex-col gap-3">{children}</main>
      <UiStoreProvider>
        <PartySidebar party={MOCK_RUN.party} classes={MOCK_CLASSES} latestChanges={latestChanges}
          profiles={PERSONALITY_PROFILES} history={history} className="lg:w-72 lg:shrink-0" />
      </UiStoreProvider>
    </div>
  </div>;
}
