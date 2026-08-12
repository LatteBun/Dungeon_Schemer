import type { ClassDef, ClassId } from "@/lib/domain";

/**
 * 초기 직업 5종. 직업은 열린 목록이므로 여기에 행을 추가하면
 * 규칙 수정 없이 새 직업이 파티 생성에 포함된다.
 * docs/systems/PARTY_AND_TRUST.md
 */
export const CLASSES: readonly ClassDef[] = [
  {
    id: "warrior" as ClassId,
    name: "전사",
    description: "전면에서 파티를 지키는 근접 전투원.",
  },
  {
    id: "archer" as ClassId,
    name: "궁수",
    description: "거리를 두고 위협을 제거하는 원거리 공격수.",
  },
  {
    id: "cleric" as ClassId,
    name: "성직자",
    description: "파티를 치유하고 사기를 지탱하는 신앙인.",
  },
  {
    id: "mage" as ClassId,
    name: "마법사",
    description: "지식과 주문으로 상황을 뒤집는 술사.",
  },
  {
    id: "rogue" as ClassId,
    name: "도적",
    description: "함정과 은밀한 일에 밝은 그림자 전문가.",
  },
] as const;
