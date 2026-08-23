"use client";

import { useState } from "react";
import { U6EndingScreen } from "./U6EndingScreen";
import { U6SettlementScreen } from "./U6SettlementScreen";
import { U6_PREVIEW_ENTRIES, type U6PreviewId } from "./u6-preview-data";

export interface U6PreviewProps {
  initialId?: U6PreviewId;
}

export function U6Preview({ initialId = "settlement-partial" }: U6PreviewProps) {
  const [selectedId, setSelectedId] = useState<U6PreviewId>(initialId);
  const entry =
    U6_PREVIEW_ENTRIES.find((candidate) => candidate.id === selectedId) ?? U6_PREVIEW_ENTRIES[0];

  return (
    <div className="u6-preview">
      <nav className="u6-preview__nav" aria-label="U6 프리뷰 화면">
        {U6_PREVIEW_ENTRIES.map((candidate) => (
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

      {entry.settlement ? (
        <U6SettlementScreen
          status={entry.status}
          settlement={entry.settlement}
        />
      ) : null}
      {entry.ending ? <U6EndingScreen ending={entry.ending} /> : null}
    </div>
  );
}
