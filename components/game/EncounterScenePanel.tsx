import { Panel } from "@/components/ui/Panel";
import type { MemberId } from "@/lib/domain";

interface EncounterScenePanelProps {
  title: string;
  sceneText: string;
  riskSummary: string;
  memberNames: { id: MemberId; name: string; alive: boolean }[];
}

/** 와이어프레임의 관람 영역. 정보 전달과 사건이 같은 머리 영역을 쓴다. */
export function EncounterScenePanel({
  title,
  sceneText,
  riskSummary,
  memberNames,
}: EncounterScenePanelProps) {
  return (
    <Panel title={`관람 영역 · ${title}`}>
      <ul className="flex flex-wrap gap-2">
        {memberNames.map((member) => (
          <li
            key={member.id}
            className={`rounded-full border px-3 py-1 text-xs ${
              member.alive
                ? "border-edge text-parchment"
                : "border-dashed border-trust-down text-trust-down"
            }`}
          >
            {member.name}
            {member.alive ? null : " · 사망"}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-parchment">{sceneText}</p>
      <p className="mt-1 text-xs text-trust-down">{riskSummary}</p>
    </Panel>
  );
}
