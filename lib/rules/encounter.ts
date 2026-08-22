import { RuleError } from "@/lib/domain";
import type { EncounterDefinition, EncounterEnemyGroup, EncounterModifier, MonsterId } from "@/lib/domain";

export interface ResolvedEncounter {
  readonly groups: readonly EncounterEnemyGroup[];
  readonly avoidCombat: boolean;
}

export interface BattleEnemy {
  readonly id: string;
  readonly monsterId: MonsterId;
  readonly maxHp: number;
  readonly hp: number;
  readonly baseDamage: number;
}

function invalid(message: string, details: Record<string, unknown>): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

function validateGroups(groups: readonly EncounterEnemyGroup[], label: string): void {
  const seen = new Set<string>();
  for (const group of groups) {
    if (seen.has(group.monsterId)) invalid(`${label}에 MonsterId가 중복된다: ${group.monsterId}`, { label, monsterId: group.monsterId });
    if (!Number.isInteger(group.count) || group.count <= 0) invalid(`${label} count가 유효하지 않다: ${group.monsterId}`, { label, count: group.count });
    seen.add(group.monsterId);
  }
}

export function resolveEncounter(input: {
  base: EncounterDefinition;
  modifier: EncounterModifier;
  activeMonsterIds: readonly MonsterId[];
}): ResolvedEncounter {
  validateGroups(input.base.enemies, "base");
  validateGroups(input.modifier.removeEnemies ?? [], "remove");
  validateGroups(input.modifier.addEnemies ?? [], "add");
  if (input.modifier.avoidCombat && ((input.modifier.addEnemies?.length ?? 0) > 0 || (input.modifier.removeEnemies?.length ?? 0) > 0)) {
    invalid("avoidCombat은 encounter 수정과 함께 사용할 수 없다", { modifier: input.modifier });
  }
  const active = new Set(input.activeMonsterIds);
  for (const group of [...input.base.enemies, ...(input.modifier.addEnemies ?? [])]) {
    if (!active.has(group.monsterId)) invalid(`활성 몬스터가 아니다: ${group.monsterId}`, { monsterId: group.monsterId });
  }
  const remove = new Map((input.modifier.removeEnemies ?? []).map((group) => [group.monsterId, group.count]));
  const groups: EncounterEnemyGroup[] = [];
  for (const group of input.base.enemies) {
    const next = group.count - (remove.get(group.monsterId) ?? 0);
    if (next < 0) invalid(`기본 그룹보다 많이 제거한다: ${group.monsterId}`, { monsterId: group.monsterId, count: group.count, remove: remove.get(group.monsterId) });
    if (next > 0) groups.push({ ...group, count: next });
  }
  for (const group of input.modifier.addEnemies ?? []) {
    const existing = groups.find((candidate) => candidate.monsterId === group.monsterId);
    if (existing !== undefined) {
      const index = groups.indexOf(existing);
      groups[index] = { ...existing, count: existing.count + group.count };
    } else {
      groups.push({ ...group });
    }
  }
  return { groups, avoidCombat: input.base.avoidCombat === true || input.modifier.avoidCombat === true };
}

export function expandEncounter(input: ResolvedEncounter): readonly BattleEnemy[] {
  if (input.avoidCombat) return [];
  return input.groups.flatMap((group) => Array.from({ length: group.count }, (_, index) => ({
    id: `${group.monsterId}#${index + 1}`,
    monsterId: group.monsterId,
    maxHp: 1,
    hp: 1,
    baseDamage: 1,
  })));
}
