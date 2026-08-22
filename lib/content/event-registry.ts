import { SHARED_EVENTS } from "@/lib/content/shared-events";
import { DESERT_EVENTS } from "@/lib/content/events/desert-events";
import { GRAVEYARD_EVENTS } from "@/lib/content/events/graveyard-events";
import { SPIDER_EVENTS } from "@/lib/content/events/spider-events";
import { THEMES } from "@/lib/content/themes";
import type {
  EncounterDefinition,
  EncounterModifier,
  EventKind,
  ImmediateEventEffect,
  SituationEvent,
  ThemeId,
} from "@/lib/domain";
import type { MonsterId } from "@/lib/domain";

const THEMED_EVENTS: Readonly<Record<ThemeId, readonly SituationEvent[]>> = {
  spider: SPIDER_EVENTS,
  desert: DESERT_EVENTS,
  graveyard: GRAVEYARD_EVENTS,
};

function defaultEffect(kind: EventKind): ImmediateEventEffect | undefined {
  return kind === "rest" ? { kind: "hp", hpDeltaPerMember: 0 } : undefined;
}

function normalizeEvent(event: SituationEvent, themeId?: ThemeId): SituationEvent {
  if (event.kind !== "monster" && event.kind !== "rest" && event.kind !== "special") return event;
  const theme = themeId === undefined ? undefined : THEMES.find((candidate) => candidate.id === themeId);
  if (event.kind !== "monster") {
    return {
      ...event,
      defaultEffect: event.defaultEffect ?? { kind: "hp", hpDeltaPerMember: 0 },
      advice: event.advice.map((option) => ({ ...option, immediateEffect: option.immediateEffect ?? { kind: "hp", hpDeltaPerMember: 0 } })),
    };
  }
  const monsterId = theme?.monsters[0]?.id as MonsterId | undefined;
  if (monsterId === undefined) return event;
  const encounter: EncounterDefinition = event.encounter ?? { enemies: [{ monsterId, count: 1 }] };
  const encounterModifier: EncounterModifier = event.encounterModifier ?? {};
  const firstEnemy = encounter.enemies[0];
  return {
    ...event,
    encounter,
    encounterModifier,
    defaultEncounterModifier: event.defaultEncounterModifier ?? {},
    advice: event.advice.map((option) => ({
      ...option,
      encounterModifier: option.encounterModifier ?? (option.outcome === "help"
        ? { avoidCombat: true }
        : option.outcome === "harm" && firstEnemy !== undefined
          ? { addEnemies: [{ ...firstEnemy, count: 1 }] }
          : {}),
    })),
  };
}

function normalizeShared(event: SituationEvent): SituationEvent {
  if (event.kind === "merchant") return event;
  return normalizeEvent({ ...event, defaultEffect: event.defaultEffect ?? defaultEffect(event.kind) });
}

export function eventsForTheme(themeId: ThemeId): readonly SituationEvent[] {
  const themed = THEMED_EVENTS[themeId].map((event) => normalizeEvent(event, themeId));
  const shared = SHARED_EVENTS.map(normalizeShared);
  return [...shared, ...themed];
}

export function allSituationEvents(): readonly SituationEvent[] {
  return [
    ...SHARED_EVENTS.map(normalizeShared),
    ...THEMES.flatMap((theme) => THEMED_EVENTS[theme.id].map((event) => normalizeEvent(event, theme.id))),
  ];
}
