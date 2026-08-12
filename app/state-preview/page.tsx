import {
  createPreviewRun,
  PREVIEW_INITIAL_SEED,
} from "@/app/state-preview/preview-run";
import { StatePreviewPanel } from "@/app/state-preview/state-preview-panel";
import { GameStoreProvider } from "@/lib/stores/game-store-provider";

export default function StatePreviewPage() {
  return (
    <GameStoreProvider initialRun={createPreviewRun(PREVIEW_INITIAL_SEED)}>
      <StatePreviewPanel />
    </GameStoreProvider>
  );
}
