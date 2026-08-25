import Image from "next/image";
import type { U5PartyMemberView } from "./u5-progress-model";

export interface U5NonBattlePartySceneProps {
  readonly party: readonly U5PartyMemberView[];
}

export function U5NonBattlePartyScene({ party }: U5NonBattlePartySceneProps): React.ReactNode {
  return (
    <div className="u5-scene-party" data-testid="u5-nonbattle-party" aria-hidden="true">
      {Array.from({ length: 3 }, (_, index) => {
        const member = party[index];

        return (
          <span
            key={member?.id ?? `empty-${index}`}
            className="u5-scene-party__slot"
            data-u5-party-scene-slot={index}
          >
            {member?.portraitSrc === undefined ? null : (
              <Image
                className="u5-scene-party__image"
                src={member.portraitSrc}
                alt=""
                fill
                sizes="12rem"
              />
            )}
          </span>
        );
      })}
    </div>
  );
}
