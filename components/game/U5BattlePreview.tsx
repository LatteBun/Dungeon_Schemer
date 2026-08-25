"use client";

import { useState } from "react";
import { useAppBattlePlaybackRate } from "./AppBattlePlaybackRateProvider";
import { U5ProgressScreen } from "./U5ProgressScreen";
import {
  U5_BATTLE_PREVIEW_ENTRIES,
  type U5BattlePreviewId,
} from "./u5-battle-preview-data";

export function U5BattlePreview() {
  const [selectedId, setSelectedId] = useState<U5BattlePreviewId>("e3-monster");
  const playbackRateControl = useAppBattlePlaybackRate();
  const entry = U5_BATTLE_PREVIEW_ENTRIES.find((candidate) => candidate.id === selectedId)
    ?? U5_BATTLE_PREVIEW_ENTRIES[0];

  if (entry === undefined) return null;

  return (
    <div className="u5-battle-preview">
      <nav className="u5-battle-preview__selector" aria-label="U5-2 전투 프리뷰">
        {U5_BATTLE_PREVIEW_ENTRIES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            aria-pressed={candidate.id === entry.id}
            onClick={() => setSelectedId(candidate.id)}
          >
            <strong>{candidate.label}</strong>
            <span>{candidate.sourceLabel}</span>
          </button>
        ))}
      </nav>

      <U5ProgressScreen
        status={entry.status}
        progress={entry.progress}
        log={entry.log}
        ecology={entry.ecology}
        battleReplay={entry.replay}
        playbackRate={playbackRateControl.playbackRate}
        onTogglePlaybackRate={playbackRateControl.togglePlaybackRate}
        combatFeedback={entry.feedback}
        previewPlaybackControls
      />
    </div>
  );
}
