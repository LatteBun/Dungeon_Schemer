import type { ClassDef, ClassId } from "@/lib/domain";

/**
 * 초기 직업 5종. 직업은 열린 목록이므로 여기에 행을 추가하면
 * 규칙 수정 없이 새 직업이 파티 생성에 포함된다.
 *
 * `attack`과 `hitWeight`는 반비례한다. 전사는 적게 때리고 많이 맞으며 마법사는
 * 많이 때리고 적게 맞는다. 전사가 없는 파티는 화력이 높은 대신 피해가 후열로
 * 분산되므로, 어떤 파티를 어느 던전에 보낼지가 무거운 결정이 된다.
 * docs/systems/PARTY_AND_TRUST.md
 * docs/superpowers/specs/2026-08-17-sbh3821-turn-based-boss-fight-design.md
 */
export const CLASSES: readonly ClassDef[] = [
  {
    id: "warrior" as ClassId,
    name: "전사",
    description: "전면에서 파티를 지키는 근접 전투원.",
    attack: 9,
    hitWeight: 4,
  },
  {
    id: "archer" as ClassId,
    name: "궁수",
    description: "거리를 두고 위협을 제거하는 원거리 공격수.",
    attack: 14,
    hitWeight: 1,
  },
  {
    id: "cleric" as ClassId,
    name: "성직자",
    description: "파티를 치유하고 사기를 지탱하는 신앙인.",
    attack: 7,
    hitWeight: 1,
  },
  {
    id: "mage" as ClassId,
    name: "마법사",
    description: "지식과 주문으로 상황을 뒤집는 술사.",
    attack: 15,
    hitWeight: 1,
  },
  {
    id: "rogue" as ClassId,
    name: "도적",
    description: "함정과 은밀한 일에 밝은 그림자 전문가.",
    attack: 12,
    hitWeight: 2,
  },
] as const;
