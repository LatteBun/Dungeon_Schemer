"use client";

import { useMemo, useState } from "react";
import type { NodeId, ThemeId } from "@/lib/domain";
import { U4DungeonMapScreen } from "./U4DungeonMapScreen";
import { createU4PreviewData } from "./u4-preview-data";

export interface U4PreviewProps {
  deadPreview?: boolean;
  themeId?: ThemeId;
}

export function U4Preview({ deadPreview = false, themeId }: U4PreviewProps) {
  const preview = useMemo(
    () => createU4PreviewData({ deadPreview }),
    [deadPreview],
  );
  const [selectedNextNodeId, setSelectedNextNodeId] = useState<NodeId | null>(
    preview.selectedNextNodeId,
  );
  const [feedback, setFeedback] = useState("");

  return (
    <div className="u4-preview">
      <U4DungeonMapScreen
        status={preview.status}
        dungeonName={preview.dungeonName}
        riskLevel={preview.riskLevel}
        nodes={preview.nodes}
        layout={preview.layout}
        party={preview.party}
        themeId={themeId}
        selectedNextNodeId={selectedNextNodeId}
        onSelectNextNode={(nodeId) => {
          setSelectedNextNodeId(nodeId);
          setFeedback("");
        }}
        onMove={(nodeId) => {
          const node = preview.nodes.find((candidate) => candidate.id === nodeId);
          setFeedback(
            node === undefined
              ? "선택한 지점을 찾지 못했습니다."
              : `${preview.dungeonName}의 다음 지점 이동이 준비되었습니다.`,
          );
        }}
      />
      {feedback === "" ? null : (
        <p
          className="u4-preview__feedback"
          role="status"
          aria-live="polite"
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
