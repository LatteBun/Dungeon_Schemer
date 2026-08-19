import { RuleError } from "@/lib/domain";
import { validateThemes } from "@/lib/content/theme-validation";
import type {
  BossDef,
  BossId,
  EcologyRule,
  MonsterDef,
  MonsterId,
  RiskLevel,
  RuleId,
  ThemeContent,
} from "@/lib/domain";

/**
 * 거미굴 생태 규칙 6개.
 *
 * 불·빛, 진동, 냄새·어둠 세 축으로 나누고 축마다 일반 규칙과 조건부 예외를
 * 한 쌍씩 둔다. 조건부 2개로 계약의 "1개 이상"을 여유 있게 만족한다.
 * docs/superpowers/specs/2026-08-19-lattebun-f2-1-theme-spider-design.md
 */
const SPIDER_RULES: readonly EcologyRule[] = [
  {
    id: "spider-fire" as RuleId,
    theme: "spider",
    text: "거미는 불을 피한다",
    conditional: false,
  },
  {
    id: "spider-brood-light" as RuleId,
    theme: "spider",
    text: "새끼거미 떼는 오히려 불빛에 몰려든다",
    conditional: true,
  },
  {
    id: "spider-vibration" as RuleId,
    theme: "spider",
    text: "동굴거미는 발소리와 진동에 민감하게 반응해 다가오는 것을 먼저 알아챈다",
    conditional: false,
  },
  {
    id: "spider-armor-vibration" as RuleId,
    theme: "spider",
    text: "철갑거미는 두꺼운 겉껍질 때문에 진동을 거의 느끼지 못해 다가와도 알아채지 못한다",
    conditional: true,
  },
  {
    id: "spider-carrion" as RuleId,
    theme: "spider",
    text: "시체 냄새가 나는 곳에는 시체거미가 몰려든다",
    conditional: false,
  },
  {
    id: "spider-shadow" as RuleId,
    theme: "spider",
    text: "그림자거미는 빛이 없는 곳에서만 모습을 드러낸다",
    conditional: false,
  },
];

const SPIDER_MONSTERS: readonly MonsterDef[] = [
  {
    id: "spider-hatchling" as MonsterId,
    theme: "spider",
    name: "새끼거미",
    traits: ["무리", "불빛에 이끌림"],
  },
  {
    id: "spider-corpse" as MonsterId,
    theme: "spider",
    name: "시체거미",
    traits: ["부패한 시체를 먹음", "냄새에 민감"],
  },
  {
    id: "spider-cave" as MonsterId,
    theme: "spider",
    name: "동굴거미",
    traits: ["진동 감지", "좁은 통로 서식"],
  },
  {
    id: "spider-armored" as MonsterId,
    theme: "spider",
    name: "철갑거미",
    traits: ["두꺼운 겉껍질", "진동 둔감"],
  },
  {
    id: "spider-shadow" as MonsterId,
    theme: "spider",
    name: "그림자거미",
    traits: ["어둠 속에서만 활동", "빛을 피함"],
  },
];

/**
 * 거미굴 보스 4종. minRiskLevel 오름차순.
 *
 * 수치는 개편 이전 등급별 보스가 쓰던 값을 그대로 가져왔다. 3인 파티
 * 공격력 합 30 안팎을 전제로 1구간 약 3턴·4구간 약 8턴이 되도록 잡혀
 * 있던 수치라, 등급제에서 위험도 구간제로 바뀌어도 턴수 설계 의도는
 * 유효하다. 잠정 수치이며 B1 백테스트에서 조정한다.
 */
const SPIDER_BOSSES: readonly BossDef[] = [
  {
    id: "boss-spider-1" as BossId,
    theme: "spider",
    name: "거대거미 라그나",
    description: "거미굴 얕은 층을 지키는 거대한 개체로, 위협보다는 존재감으로 압도한다",
    minRiskLevel: 1,
    baseDamage: 14,
    maxHp: 100,
  },
  {
    id: "boss-spider-2" as BossId,
    theme: "spider",
    name: "고치관리자 모르칸",
    description: "포획한 먹잇감을 고치로 감싸 보관하며 침입자를 끈질기게 얽맨다",
    minRiskLevel: 2,
    baseDamage: 19,
    maxHp: 150,
  },
  {
    id: "boss-spider-3" as BossId,
    theme: "spider",
    name: "아라크네 세리나",
    description: "여러 갈래의 거미줄을 동시에 조종해 도주로를 차단하는 노련한 사냥꾼이다",
    minRiskLevel: 3,
    baseDamage: 25,
    maxHp: 210,
  },
  {
    id: "boss-spider-4" as BossId,
    theme: "spider",
    name: "거미여왕 아라크샤",
    description: "거미굴 가장 깊은 곳을 지배하는 여왕으로, 굴 전체의 거미들을 부린다",
    minRiskLevel: 4,
    baseDamage: 32,
    maxHp: 280,
  },
];

const SPIDER_THEME: ThemeContent = {
  id: "spider",
  name: "거미굴",
  rules: SPIDER_RULES,
  monsters: SPIDER_MONSTERS,
  bosses: SPIDER_BOSSES,
};

/**
 * 테마 콘텐츠 전체. F2-2가 사막·묘지를 더하면 이 배열이 3개가 된다.
 * docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
 */
export const THEMES: readonly ThemeContent[] = [SPIDER_THEME];

validateThemes(THEMES);

/**
 * 던전의 초기 위험도로 그 테마의 보스를 고른다.
 *
 * 보스 선택 로직이 C1과 E4 양쪽에서 각자 구현되면 조용히 갈라질 수 있다.
 * 콘텐츠와 그 콘텐츠를 고르는 규칙을 한곳에 두면 그럴 일이 없다.
 */
export function selectThemeBoss(theme: ThemeContent, riskLevel: RiskLevel): BossDef {
  const candidates = theme.bosses.filter((boss) => boss.minRiskLevel <= riskLevel);
  const chosen = candidates.at(-1);
  if (chosen === undefined) {
    throw new RuleError("UNKNOWN_ID", `위험도 ${riskLevel}를 담당하는 보스가 없다`, {
      theme: theme.id,
      riskLevel,
    });
  }
  return chosen;
}
