import type { ClassDef, ClassId } from "@/lib/domain";
import { validateClasses } from "@/lib/content/class-validation";

/**
 * 초기 직업 5종.
 *
 * 수치는 백테스트로 조정될 시작값이다. docs/systems/CHARACTERS_AND_TRUST.md
 */
export const CLASSES: readonly ClassDef[] = [
  {
    id: "warrior" as ClassId,
    name: "전사",
    description: "앞에서 버티며 꾸준히 피해를 준다",
    maxHp: 45,
    attack: 8,
    hitWeight: 3,
  },
  {
    id: "archer" as ClassId,
    name: "궁수",
    description: "멀리서 정확하게 노린다",
    maxHp: 30,
    attack: 10,
    hitWeight: 1,
  },
  {
    id: "cleric" as ClassId,
    name: "성직자",
    description: "부상자를 치유해 파티를 지탱하지만 스스로는 약하다",
    maxHp: 28,
    attack: 5,
    hitWeight: 1,
    battleAbility: {
      kind: "emergencyHeal",
      name: "치유 기도",
      healTargetMaxHpPercent: 25,
      usesPerExpedition: 2,
      triggerAtOrBelowHpPercent: 50,
    },
  },
  {
    id: "mage" as ClassId,
    name: "마법사",
    description: "큰 피해를 주지만 쉽게 무너진다",
    maxHp: 24,
    attack: 12,
    hitWeight: 1,
  },
  {
    id: "rogue" as ClassId,
    name: "도적",
    description: "빠르지만 오래 버티지 못한다",
    maxHp: 32,
    attack: 9,
    hitWeight: 2,
  },
] as const;

validateClasses(CLASSES);
