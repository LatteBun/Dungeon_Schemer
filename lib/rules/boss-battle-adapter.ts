import { createRng } from "@/lib/rng";
import { consumePendingMerchantEffect } from "@/lib/rules/merchant";
import { evaluateTrust } from "@/lib/rules/trust";
import { resolveBattle } from "@/lib/rules/battle-engine";
import {
  bossTraitForRule,
  clampBossInfoMultiplier,
  modifierForBossInfo,
} from "@/lib/content/boss-traits";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  BossInfoApplication,
  BossInfoAxis,
  BossInfoDirection,
  BossInfoPresentationCue,
  BossInfoTiming,
  BossInfoVerification,
  BossInfoVerificationAction,
  BossResult,
  CampaignDungeon,
  Character,
  ClassDef,
  InfoRecord,
  PendingMerchantEffect,
  ThemeContent,
  TrustChange,
} from "@/lib/domain";

export interface BossBattleInput {
  readonly dungeon: CampaignDungeon;
  readonly theme: ThemeContent;
  readonly members: readonly Character[];
  readonly classDefs: readonly ClassDef[];
  readonly infoRecords: readonly InfoRecord[];
  readonly seed: string;
  readonly pendingMerchantEffect: PendingMerchantEffect | null;
}

export interface BossBattleResolution {
  readonly bossResult: BossResult;
  readonly members: readonly Character[];
  readonly trustChanges: readonly TrustChange[];
  readonly pendingMerchantEffect: null;
}

function invalid(message: string, details: Record<string, unknown> = {}): never {
  throw new RuleError("INVALID_GENERATION", message, details);
}

export function retryBossStats(
  boss: BossDef,
  dungeon: Pick<CampaignDungeon, "initialRiskLevel" | "riskLevel">,
): { readonly maxHp: number; readonly baseDamage: number } {
  const riskIncrease = dungeon.riskLevel - dungeon.initialRiskLevel;
  if (!Number.isInteger(riskIncrease) || riskIncrease < 0 || riskIncrease > 4) {
    invalid("보스 scaling 위험도 차이가 유효하지 않다", {
      initialRiskLevel: dungeon.initialRiskLevel,
      riskLevel: dungeon.riskLevel,
    });
  }
  const multiplier = 1 + riskIncrease * 0.1;
  return {
    maxHp: Math.max(1, Math.round(boss.maxHp * multiplier)),
    baseDamage: Math.max(1, Math.round(boss.baseDamage * multiplier)),
  };
}

function recordKey(record: InfoRecord): string {
  return `${record.eventId}/${record.adviceId}/${record.characterId}`;
}

function compareInfoRecords(left: InfoRecord, right: InfoRecord): number {
  return left.characterId.localeCompare(right.characterId)
    || left.bossRuleId.localeCompare(right.bossRuleId)
    || left.eventId.localeCompare(right.eventId)
    || left.adviceId.localeCompare(right.adviceId);
}

function directionFor(outcome: "help" | "harm"): BossInfoDirection {
  return outcome === "help" ? "beneficial" : "harmful";
}

function timingFor(axis: BossInfoAxis): BossInfoTiming {
  switch (axis) {
    case "targetWeight": return "beforeTarget";
    case "incomingDamage": return "beforeDamage";
    case "outgoingDamage": return "afterDamage";
  }
}

function actionFor(record: InfoRecord): BossInfoVerificationAction {
  if (record.reaction === "accepted") return record.outcome === "help" ? "adviceHelped" : "adviceHarmed";
  return record.outcome === "help" ? "suspicionWasCostly" : "suspicionWasCorrect";
}

function sortedRecords(records: readonly InfoRecord[]): readonly InfoRecord[] {
  return [...records].sort(compareInfoRecords);
}

function multiplyRawAxis(map: Map<string, number>, memberId: string, axis: BossInfoAxis, value: number): void {
  const key = `${memberId}:${axis}`;
  map.set(key, (map.get(key) ?? 1) * value);
}

function finalAxisValue(map: ReadonlyMap<string, number>, memberId: string, axis: BossInfoAxis): number {
  return clampBossInfoMultiplier(map.get(`${memberId}:${axis}`) ?? 1);
}

export function resolveBossBattle(input: BossBattleInput): BossBattleResolution {
  if (input.dungeon.theme !== input.theme.id) {
    invalid("보스전 던전과 테마가 다르다", { dungeonTheme: input.dungeon.theme, theme: input.theme.id });
  }
  const boss = input.theme.bosses.find((candidate) => candidate.id === input.dungeon.bossId);
  if (boss === undefined) invalid("현재 던전의 보스 정의가 없다", { bossId: input.dungeon.bossId });
  if (boss.rules.length !== 2) invalid("보스 특징이 정확히 2개가 아니다", { bossId: boss.id, actual: boss.rules.length });

  const classById = new Map(input.classDefs.map((classDef) => [classDef.id, classDef]));
  const memberById = new Map<string, Character>();
  for (const member of input.members) {
    if (memberById.has(member.id)) invalid("보스전 파티 캐릭터 ID가 중복된다", { characterId: member.id });
    memberById.set(member.id, member);
  }
  const seenRecords = new Set<string>();
  const rules = new Set(boss.rules.map((rule) => rule.id));
  const axisMultipliers = new Map<string, number>();
  const applications: BossInfoApplication[] = [];
  const eligibleRecords: InfoRecord[] = [];

  for (const record of sortedRecords(input.infoRecords)) {
    const key = recordKey(record);
    if (seenRecords.has(key)) invalid("보스 정보 지연 기록을 두 번 소비하려 한다", { record: key });
    seenRecords.add(key);
    if (!rules.has(record.bossRuleId)) invalid("현재 보스에 없는 BossRuleId 정보다", { bossId: boss.id, bossRuleId: record.bossRuleId });
    const member = memberById.get(record.characterId);
    if (member === undefined) invalid("보스 정보 대상 캐릭터가 참가자가 아니다", { characterId: record.characterId });
    if (!member.alive) continue;
    if (record.pendingVerification !== true) invalid("미검증 보스 정보 기록이 아니다", { record: key });
    if (record.outcome === "neutral") continue;
    const trait = bossTraitForRule(record.bossRuleId);
    eligibleRecords.push(record);
    if (record.reaction !== "accepted") continue;
    const direction = directionFor(record.outcome);
    multiplyRawAxis(axisMultipliers, record.characterId, trait.axis, modifierForBossInfo(trait.axis, record.outcome));
    applications.push({
      eventId: record.eventId,
      adviceId: record.adviceId,
      characterId: record.characterId,
      bossRuleId: record.bossRuleId,
      axis: trait.axis,
      direction,
    });
  }

  const consumed = consumePendingMerchantEffect(input.pendingMerchantEffect);
  const aliveMembers = input.members.filter((member) => member.alive);
  const party = aliveMembers.map((member) => {
    const classDef = classById.get(member.classId);
    if (classDef === undefined) invalid("보스전 파티의 직업 정의가 없다", { classId: member.classId });
    return { id: member.id, classId: member.classId, hp: member.hp, maxHp: member.maxHp, attack: classDef.attack, hitWeight: classDef.hitWeight };
  });
  if (party.length === 0) invalid("보스전에 살아 있는 파티원이 없다");

  const stats = retryBossStats(boss, input.dungeon);
  const targetWeightMultiplierByMemberId: Record<string, number> = {};
  const incomingDamageMultiplierByMemberId: Record<string, number> = {};
  const outgoingDamageMultiplierByMemberId: Record<string, number> = {};
  const merchantIncoming = consumed.nextBattle?.incomingDamageMultiplier;
  const merchantOutgoing = consumed.nextBattle?.partyDamageMultiplier;
  for (const member of aliveMembers) {
    if (merchantIncoming !== undefined) multiplyRawAxis(axisMultipliers, member.id, "incomingDamage", merchantIncoming);
    if (merchantOutgoing !== undefined) multiplyRawAxis(axisMultipliers, member.id, "outgoingDamage", merchantOutgoing);
    targetWeightMultiplierByMemberId[member.id] = finalAxisValue(axisMultipliers, member.id, "targetWeight");
    incomingDamageMultiplierByMemberId[member.id] = finalAxisValue(axisMultipliers, member.id, "incomingDamage");
    outgoingDamageMultiplierByMemberId[member.id] = finalAxisValue(axisMultipliers, member.id, "outgoingDamage");
  }

  const battle = resolveBattle({
    seed: input.seed,
    party,
    enemies: [{ id: boss.id, monsterId: boss.id, hp: stats.maxHp, maxHp: stats.maxHp, baseDamage: stats.baseDamage }],
    targetWeightMultipliers: boss.targetWeightMultipliers,
    targetWeightMultiplierByMemberId,
    incomingDamageMultiplierByMemberId,
    outgoingDamageMultiplierByMemberId,
  });

  const battleMembers = new Map(battle.party.map((member) => [member.id, member]));
  const resolvedMembers = input.members.map((member) => {
    const battleMember = battleMembers.get(member.id);
    return battleMember === undefined ? member : { ...member, hp: battleMember.hp, alive: battleMember.hp > 0 };
  });
  const resolvedById = new Map(resolvedMembers.map((member) => [member.id, member]));
  const verificationByRecord = new Map<string, BossInfoVerification>();
  const trustChanges: TrustChange[] = [];
  for (const record of eligibleRecords) {
    const action = actionFor(record);
    verificationByRecord.set(recordKey(record), {
      eventId: record.eventId,
      adviceId: record.adviceId,
      characterId: record.characterId,
      bossRuleId: record.bossRuleId,
      action,
      applied: record.reaction === "accepted",
    });
    const member = resolvedById.get(record.characterId);
    if (member === undefined || !member.alive) continue;
    const evaluated = evaluateTrust(member, action, createRng(`${input.seed}:boss-info:${recordKey(record)}:${action}`).derive("trust"));
    resolvedById.set(member.id, evaluated.member);
    trustChanges.push(evaluated.change);
  }

  const cues: BossInfoPresentationCue[] = applications.map((application) => ({
    bossRuleId: application.bossRuleId,
    characterId: application.characterId,
    timing: timingFor(application.axis),
    axis: application.axis,
    direction: application.direction,
    presentationKey: `boss-info.${application.axis}.${application.direction}`,
  }));
  const finalMembers = input.members.map((member) => resolvedById.get(member.id) ?? member);
  const survivorIds = finalMembers.filter((member) => member.alive).map((member) => member.id);
  const bossResult: BossResult = {
    battle,
    survivorIds,
    status: survivorIds.length > 0 && battle.status === "victory" ? "cleared" : "wiped",
    applications,
    verifications: [...verificationByRecord.values()],
    cues,
  };
  return { bossResult, members: finalMembers, trustChanges, pendingMerchantEffect: consumed.pendingMerchantEffect };
}
