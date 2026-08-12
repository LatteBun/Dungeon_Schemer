import type { ClassId, MemberId, PartyMember } from "@/lib/domain";

/** 성격 넷이 서로 다르다. 신뢰도 서로 다르게 벌려 두었다. */
export const MOCK_PARTY: PartyMember[] = [
  { id: "m-garon" as MemberId, name: "가론", classId: "c-warrior" as ClassId, personality: "impulsive", trust: 72, alive: true },
  { id: "m-rien" as MemberId, name: "리엔", classId: "c-cleric" as ClassId, personality: "righteous", trust: 41, alive: true },
  { id: "m-beka" as MemberId, name: "베카", classId: "c-rogue" as ClassId, personality: "greedy", trust: 58, alive: true },
  { id: "m-is" as MemberId, name: "이스", classId: "c-mage" as ClassId, personality: "suspicious", trust: 30, alive: true },
];
