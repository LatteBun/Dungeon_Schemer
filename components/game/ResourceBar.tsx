import { StatValue } from "@/components/ui/StatValue";
import type { Resources, RunPhase } from "@/lib/domain";
import { PHASE_LABELS } from "./labels";

interface ResourceBarProps { resources: Resources; phase: RunPhase; depth: number; className?: string }

export function ResourceBar({ resources, phase, depth, className }: ResourceBarProps) {
  return <div className={`flex flex-wrap items-baseline gap-x-4 gap-y-1 rounded border border-edge bg-panel px-3 py-2${className === undefined ? "" : ` ${className}`}`}>
    <span className="text-sm font-semibold text-parchment">{depth + 1}층</span>
    <span className="text-xs text-muted">{PHASE_LABELS[phase]}</span>
    <span className="flex flex-wrap gap-x-3 gap-y-1"><StatValue label="사례금" value={resources.gold} /><StatValue label="식량" value={resources.food} /><StatValue label="명성" value={resources.reputation} /></span>
  </div>;
}
