import { notFound } from "next/navigation";
import { createPreviewRun } from "@/app/state-preview/preview-run";
import { StatePreviewPanel } from "@/app/state-preview/state-preview-panel";
import { GameStoreProvider } from "@/lib/stores/game-store-provider";

export default function StatePreviewPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <GameStoreProvider initialRun={createPreviewRun("f2-preview-initial")}>
      <StatePreviewPanel />
    </GameStoreProvider>
  );
}
