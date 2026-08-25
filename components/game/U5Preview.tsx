"use client";

import { useState } from "react";
import { U5ProgressScreen } from "./U5ProgressScreen";
import { useU5BattlePlaybackRate } from "./use-u5-battle-playback";
import { U5_PREVIEW_ENTRIES, type U5PreviewId } from "./u5-preview-data";

export interface U5PreviewProps {
  initialId?: U5PreviewId;
}

export function U5Preview({ initialId = "monster-before" }: U5PreviewProps) {
  const [selectedId, setSelectedId] = useState<U5PreviewId>(initialId);
  const playbackRateControl = useU5BattlePlaybackRate();
  const entry =
    U5_PREVIEW_ENTRIES.find((candidate) => candidate.id === selectedId) ?? U5_PREVIEW_ENTRIES[0];

  return (
    <div className="u5-preview">
      <nav className="u5-preview__nav" aria-label="U5 프리뷰 화면">
        {U5_PREVIEW_ENTRIES.map((candidate) => (
          <button
            key={candidate.id}
            type="button"
            className={candidate.id === entry.id ? "is-active" : ""}
            aria-pressed={candidate.id === entry.id}
            onClick={() => setSelectedId(candidate.id)}
          >
            {candidate.label}
          </button>
        ))}
      </nav>

      <U5ProgressScreen
        key={entry.id}
        status={entry.status}
        progress={entry.progress}
        log={entry.log}
        ecology={entry.ecology}
        playbackRate={playbackRateControl.playbackRate}
        onTogglePlaybackRate={playbackRateControl.togglePlaybackRate}
        initialMode={entry.initialMode}
        initialFilter={entry.initialFilter}
      />
    </div>
  );
}
