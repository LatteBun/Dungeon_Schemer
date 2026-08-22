"use client";

import { useMemo, useState } from "react";
import type { NodeId } from "@/lib/domain";
import { U4DungeonMapScreen } from "./U4DungeonMapScreen";
import { createU4PreviewData } from "./u4-preview-data";

export interface U4PreviewProps {
  deadPreview?: boolean;
}

export function U4Preview({ deadPreview = false }: U4PreviewProps) {
  const preview = useMemo(
    () => createU4PreviewData({ deadPreview }),
    [deadPreview],
  );
  const [selectedNextNodeId, setSelectedNextNodeId] = useState<NodeId | null>(
    preview.selectedNextNodeId,
  );
  const [feedback, setFeedback] = useState("");

  return (
    <div
      className="u4-preview"
      style={{ height: "100%", minHeight: 0, position: "relative" }}
    >
      <U4DungeonMapScreen
        status={preview.status}
        dungeonName={preview.dungeonName}
        riskLevel={preview.riskLevel}
        nodes={preview.nodes}
        layout={preview.layout}
        party={preview.party}
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
          style={{
            position: "absolute",
            right: "0.75rem",
            bottom: "0.75rem",
            zIndex: 50,
            margin: 0,
            border: "1px solid #7c6536",
            background: "#15100b",
            color: "#d8c49c",
            padding: "0.4rem 0.65rem",
            fontSize: "0.72rem",
          }}
        >
          {feedback}
        </p>
      )}
    </div>
  );
}
