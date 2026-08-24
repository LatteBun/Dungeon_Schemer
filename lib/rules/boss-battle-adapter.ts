import { createRng } from "@/lib/rng";
import { CAMPAIGN_BALANCE } from "@/lib/balance/campaign-balance";
import { combatMultipliersForAdvicePressure } from "@/lib/rules/advice-pressure";
import { consumePendingMerchantEffect } from "@/lib/rules/merchant";
import { evaluateTrust } from "@/lib/rules/trust";
import { resolveBattle } from "@/lib/rules/battle-engine";
import {
  BOSS_INFO_CUE_AXIS_PRIORITY,
  bossTraitForRule,
  clampBossInfoMultiplier,
  modifierForBossInfo,
} from "@/lib/content/boss-traits";
import { RuleError } from "@/lib/domain";
import type {
  BossDef,
  BattleActionRecord,
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
  AdvicePressure,
  InfoRecord,
  PendingMerchantEffect,
  RiskLevel,
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
  readonly advicePressure: AdvicePressure;
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

export function balancedBossStats(
  boss: BossDef,
  initialRiskLevel: RiskLevel,
): { readonly maxHp: number; readonly baseDamage: number } {
  const multiplier = CAMPAIGN_BALANCE.bossBaseStatMultiplierByInitialRisk[initialRiskLevel];
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

function appliesToAction(application: BossInfoApplication, action: BattleActionRecord): boolean {
  return application.axis === "outgoingDamage"
    ? action.actorSide === "party" && action.actorId === application.characterId
    : action.actorSide === "enemy" && action.targetId === application.characterId;
}

function compareApplications(left: BossInfoApplication, right: BossInfoApplication): number {
  return BOSS_INFO_CUE_AXIS_PRIORITY[left.axis] - BOSS_INFO_CUE_AXIS_PRIORITY[right.axis]
    || left.characterId.localeCompare(right.characterId)
    || left.bossRuleId.localeCompare(right.bossRuleId)
    || left.eventId.localeCompare(right.eventId)
    || left.adviceId.localeCompare(right.adviceId);
}

function actionFor(record: InfoRecord): BossInfoVerificationAction {
  if (record.reaction === "accepted") return record.outcome === "help" ? "adviceHelped" : "adviceHarmed";
  if (record.reaction === "suspected") {
    return record.outcome === "help" ? "suspicionWasCostly" : "suspicionWasCorrect";
  }
  invalid("적발된 보스 정보는 사후 검증할 수 없다", {
    record: recordKey(record),
    characterId: record.characterId,
    reaction: record.reaction,
  });
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
    if (record.reaction === "exposed") {
      invalid("적발된 보스 정보는 E4 지연 기록이 될 수 없다", {
        record: key,
        characterId: record.characterId,
        reaction: record.reaction,
      });
    }
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

  const stats = balancedBossStats(boss, input.dungeon.initialRiskLevel);
  const targetWeightMultiplierByMemberId: Record<string, number> = {};
  const incomingDamageMultiplierByMemberId: Record<string, number> = {};
  const outgoingDamageMultiplierByMemberId: Record<string, number> = {};
  const merchantIncoming = consumed.nextBattle?.incomingDamageMultiplier;
  const merchantOutgoing = consumed.nextBattle?.partyDamageMultiplier;
  const pressure = combatMultipliersForAdvicePressure(input.advicePressure);
  for (const member of aliveMembers) {
    multiplyRawAxis(axisMultipliers, member.id, "incomingDamage", pressure.incomingDamageMultiplier);
    multiplyRawAxis(axisMultipliers, member.id, "outgoingDamage", pressure.outgoingDamageMultiplier);
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
  if (battle.termination === "roundLimit") {
    invalid("보스전이 50턴 안에 종료되지 않았다", {
      bossId: boss.id,
      termination: battle.termination,
      rounds: battle.rounds,
      livingPartyIds: battle.party.filter((member) => member.hp > 0).map((member) => member.id),
      livingEnemyIds: battle.enemies.filter((enemy) => enemy.hp > 0).map((enemy) => enemy.id),
    });
  }

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

  const cues: BossInfoPresentationCue[] = battle.actions.flatMap((action, actionIndex) => {
    const application = applications
      .filter((candidate) => appliesToAction(candidate, action))
      .toSorted(compareApplications)[0];
    if (application === undefined) return [];
    return [{
      actionIndex,
      bossRuleId: application.bossRuleId,
      characterId: application.characterId,
      timing: timingFor(application.axis),
      axis: application.axis,
      direction: application.direction,
      presentationKey: `boss-info.${application.axis}.${application.direction}`,
    }];
  });
  const finalMembers = input.members.map((member) => resolvedById.get(member.id) ?? member);
  const survivorIds = finalMembers.filter((member) => member.alive).map((member) => member.id);
  const status = battle.termination === "defeatedEnemies" && survivorIds.length > 0
    ? "cleared"
    : battle.termination === "partyWipe" && survivorIds.length === 0
      ? "wiped"
      : invalid("보스전 결과와 생존자 상태가 모순된다", {
        termination: battle.termination,
        survivorIds,
      });
  const bossResult: BossResult = {
    battle,
    survivorIds,
    status,
    applications,
    verifications: [...verificationByRecord.values()],
    cues,
  };
  return { bossResult, members: finalMembers, trustChanges, pendingMerchantEffect: consumed.pendingMerchantEffect };
}
