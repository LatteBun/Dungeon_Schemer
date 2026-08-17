import { Panel } from "@/components/ui/Panel";
import type { CauseChainLinkView } from "./settlement-view-model";

interface CauseChainBandProps {
  links: CauseChainLinkView[];
}

/** 고리 사이의 `→`는 장식이 아니라 인과의 방향이다. */
export function CauseChainBand({ links }: CauseChainBandProps) {
  return (
    <Panel title="원인 사슬">
      <ol className="flex flex-wrap items-stretch gap-2 text-xs">
        {links.map((link, index) => (
          <li key={link.label} className="flex items-center gap-2">
            <div className="rounded border border-edge px-2 py-1">
              <p className="text-muted">{link.label}</p>
              <p className="text-parchment">{link.value}</p>
            </div>
            {index === links.length - 1 ? null : (
              <span aria-hidden="true" className="text-muted">→</span>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}
