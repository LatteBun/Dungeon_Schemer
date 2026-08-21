import { RuleError } from "@/lib/domain";
import { validateThemes } from "@/lib/content/theme-validation";
import type {
  BossDef,
  BossId,
  BossRuleId,
  EcologyProfile,
  EcologyProfileId,
  EcologyRule,
  EnvironmentTagDefinition,
  MonsterDef,
  MonsterId,
  PublicEnvironmentTagId,
  RiskLevel,
  RuleId,
  ThemeId,
  ThemeContent,
} from "@/lib/domain";

function ecologyProfile(
  theme: ThemeId,
  id: string,
  initialRiskLevel: RiskLevel,
  activeRuleIds: readonly string[],
  activeMonsterIds: readonly string[],
  publicEnvironmentTagId: string,
): EcologyProfile {
  return {
    id: id as EcologyProfileId,
    theme,
    initialRiskLevel,
    activeRuleIds: activeRuleIds.map((ruleId) => ruleId as RuleId),
    activeMonsterIds: activeMonsterIds.map((monsterId) => monsterId as MonsterId),
    publicEnvironmentTagId: publicEnvironmentTagId as PublicEnvironmentTagId,
  };
}

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

const SPIDER_PUBLIC_ENVIRONMENT_TAGS: readonly EnvironmentTagDefinition[] = [
  {
    id: "spider-vibration-alert" as PublicEnvironmentTagId,
    label: "진동 경계",
    evidenceMonsterTraits: ["진동 감지"],
  },
  {
    id: "spider-carrion-trace" as PublicEnvironmentTagId,
    label: "시체 흔적",
    evidenceMonsterTraits: ["부패한 시체를 먹음"],
  },
  {
    id: "spider-dark-ambush" as PublicEnvironmentTagId,
    label: "어둠 잠복",
    evidenceMonsterTraits: ["어둠 속에서만 활동"],
  },
];

const SPIDER_ECOLOGY_PROFILES: readonly EcologyProfile[] = [
  ecologyProfile(
    "spider",
    "spider-shallow-a",
    1,
    ["spider-fire", "spider-vibration", "spider-carrion"],
    ["spider-cave", "spider-corpse"],
    "spider-vibration-alert",
  ),
  ecologyProfile(
    "spider",
    "spider-shallow-b",
    1,
    ["spider-fire", "spider-vibration", "spider-shadow"],
    ["spider-cave", "spider-shadow"],
    "spider-dark-ambush",
  ),
  ecologyProfile(
    "spider",
    "spider-carrion-route",
    2,
    ["spider-fire", "spider-carrion", "spider-shadow"],
    ["spider-corpse", "spider-shadow"],
    "spider-carrion-trace",
  ),
  ecologyProfile(
    "spider",
    "spider-dark-passage",
    3,
    ["spider-vibration", "spider-carrion", "spider-shadow"],
    ["spider-cave", "spider-corpse", "spider-shadow"],
    "spider-dark-ambush",
  ),
  ecologyProfile(
    "spider",
    "spider-queens-forecourt",
    4,
    ["spider-brood-light", "spider-armor-vibration", "spider-shadow"],
    ["spider-hatchling", "spider-armored", "spider-shadow"],
    "spider-dark-ambush",
  ),
];

/**
 * 거미굴 보스 4종. minRiskLevel 오름차순.
 *
 * 수치는 개편 이전 등급별 보스가 쓰던 값을 그대로 가져왔다. 3인 파티
 * 공격력 합 30 안팎을 전제로 1구간 약 3턴·4구간 약 8턴이 되도록 잡혀
 * 있던 수치라, 등급제에서 위험도 구간제로 바뀌어도 턴수 설계 의도는
 * 유효하다. 잠정 수치이며 B1 백테스트에서 조정한다.
 */
export const SPIDER_BOSSES: readonly BossDef[] = [
  {
    id: "boss-spider-1" as BossId,
    theme: "spider",
    name: "거대거미 라그나",
    description: "거미굴 얕은 층을 지키는 거대한 개체로, 위협보다는 존재감으로 압도한다",
    minRiskLevel: 1,
    baseDamage: 14,
    maxHp: 100,
    rules: [
      { id: "boss-ragna-turning" as BossRuleId, text: "큰 몸 때문에 급하게 방향을 바꾸기 어렵다." },
      { id: "boss-ragna-crouch" as BossRuleId, text: "큰 공격을 하기 직전에 몸을 낮춘다." },
    ],
  },
  {
    id: "boss-spider-2" as BossId,
    theme: "spider",
    name: "고치관리자 모르칸",
    description: "포획한 먹잇감을 고치로 감싸 보관하며 침입자를 끈질기게 얽맨다",
    minRiskLevel: 2,
    baseDamage: 19,
    maxHp: 150,
    rules: [
      { id: "boss-morkan-cocoon-side" as BossRuleId, text: "모르칸이 만든 고치는 한쪽 면이 더 얇다." },
      { id: "boss-morkan-spin-pause" as BossRuleId, text: "새 거미줄을 만들 때 잠깐 움직임이 둔해진다." },
    ],
  },
  {
    id: "boss-spider-3" as BossId,
    theme: "spider",
    name: "아라크네 세리나",
    description: "여러 갈래의 거미줄을 동시에 조종해 도주로를 차단하는 노련한 사냥꾼이다",
    minRiskLevel: 3,
    baseDamage: 25,
    maxHp: 210,
    rules: [
      { id: "boss-serina-web-hub" as BossRuleId, text: "여러 거미줄을 한꺼번에 당긴다." },
      { id: "boss-serina-block-retreat" as BossRuleId, text: "공격하기 전에 상대의 퇴로부터 막는다." },
    ],
  },
  {
    id: "boss-spider-4" as BossId,
    theme: "spider",
    name: "거미여왕 아라크샤",
    description: "거미굴 가장 깊은 곳을 지배하는 여왕으로, 굴 전체의 거미들을 부린다",
    minRiskLevel: 4,
    baseDamage: 32,
    maxHp: 280,
    rules: [
      { id: "boss-araksha-swarm-follow" as BossRuleId, text: "주변 새끼거미가 여왕의 움직임을 따라 움직인다." },
      { id: "boss-araksha-summon-first" as BossRuleId, text: "여왕이 위협받으면 직접 달려들기 전에 주변 거미를 먼저 불러들인다." },
    ],
  },
];

export const SPIDER_THEME: ThemeContent = {
  id: "spider",
  name: "거미굴",
  rules: SPIDER_RULES,
  monsters: SPIDER_MONSTERS,
  publicEnvironmentTags: SPIDER_PUBLIC_ENVIRONMENT_TAGS,
  ecologyProfiles: SPIDER_ECOLOGY_PROFILES,
  bosses: SPIDER_BOSSES,
};

/**
 * 사막 생태 규칙 6개.
 *
 * 열기·물·발자국 세 축으로 나누고 열기·물 축에는 일반 규칙과 조건부
 * 예외를 한 쌍씩 둔다.
 * docs/superpowers/specs/2026-08-19-lattebun-f2-2-theme-desert-graveyard-design.md
 */
const DESERT_RULES: readonly EcologyRule[] = [
  {
    id: "desert-heat" as RuleId,
    theme: "desert",
    text: "사막코브라는 낮의 열기를 피해 그늘에서만 움직인다",
    conditional: false,
  },
  {
    id: "desert-lizard-heat" as RuleId,
    theme: "desert",
    text: "모래도마뱀은 오히려 뜨거운 모래 위에서 몸을 데운 뒤 낮에도 활발히 움직인다",
    conditional: true,
  },
  {
    id: "desert-water" as RuleId,
    theme: "desert",
    text: "사막전갈은 물기가 있는 곳 근처에 굴을 파고 숨어 있다",
    conditional: false,
  },
  {
    id: "desert-spirit-dry" as RuleId,
    theme: "desert",
    text: "모래정령은 물기가 전혀 없는 완전한 건조 지대에서만 나타난다",
    conditional: true,
  },
  {
    id: "desert-mummy-silent" as RuleId,
    theme: "desert",
    text: "미이라는 발소리 없이 미끄러지듯 움직여 발자국을 남기지 않는다",
    conditional: false,
  },
  {
    id: "desert-wind-track" as RuleId,
    theme: "desert",
    text: "사막에서는 바람이 발자국을 금방 지운다",
    conditional: false,
  },
];

const DESERT_MONSTERS: readonly MonsterDef[] = [
  {
    id: "desert-scorpion" as MonsterId,
    theme: "desert",
    name: "사막전갈",
    traits: ["물가 근처에 굴을 팜", "밤에 활동"],
  },
  {
    id: "desert-lizard" as MonsterId,
    theme: "desert",
    name: "모래도마뱀",
    traits: ["열을 저장함", "낮에 활동"],
  },
  {
    id: "desert-cobra" as MonsterId,
    theme: "desert",
    name: "사막코브라",
    traits: ["그늘 선호", "열기에 예민"],
  },
  {
    id: "desert-spirit" as MonsterId,
    theme: "desert",
    name: "모래정령",
    traits: ["건조 지대 서식", "물기를 꺼림"],
  },
  {
    id: "desert-mummy" as MonsterId,
    theme: "desert",
    name: "미이라",
    traits: ["발자국을 남기지 않음", "무덤 수호"],
  },
];

const DESERT_PUBLIC_ENVIRONMENT_TAGS: readonly EnvironmentTagDefinition[] = [
  {
    id: "desert-heat-exposure" as PublicEnvironmentTagId,
    label: "열기 노출",
    evidenceMonsterTraits: ["열기에 예민", "열을 저장함"],
  },
  {
    id: "desert-water-zone" as PublicEnvironmentTagId,
    label: "수분 지대",
    evidenceMonsterTraits: ["물가 근처에 굴을 팜"],
  },
  {
    id: "desert-erased-tracks" as PublicEnvironmentTagId,
    label: "발자국 소실",
    evidenceMonsterTraits: ["발자국을 남기지 않음"],
  },
];

const DESERT_ECOLOGY_PROFILES: readonly EcologyProfile[] = [
  ecologyProfile(
    "desert",
    "desert-scorched-well",
    1,
    ["desert-heat", "desert-water", "desert-mummy-silent"],
    ["desert-cobra", "desert-scorpion", "desert-mummy"],
    "desert-water-zone",
  ),
  ecologyProfile(
    "desert",
    "desert-wind-well",
    2,
    ["desert-heat", "desert-water", "desert-wind-track"],
    ["desert-cobra", "desert-scorpion"],
    "desert-heat-exposure",
  ),
  ecologyProfile(
    "desert",
    "desert-buried-trail",
    2,
    ["desert-heat", "desert-mummy-silent", "desert-wind-track"],
    ["desert-cobra", "desert-mummy"],
    "desert-erased-tracks",
  ),
  ecologyProfile(
    "desert",
    "desert-dry-trail",
    3,
    ["desert-water", "desert-mummy-silent", "desert-wind-track"],
    ["desert-scorpion", "desert-mummy"],
    "desert-water-zone",
  ),
  ecologyProfile(
    "desert",
    "desert-burning-waste",
    4,
    ["desert-lizard-heat", "desert-spirit-dry", "desert-wind-track"],
    ["desert-lizard", "desert-spirit"],
    "desert-heat-exposure",
  ),
];

/** 보스 수치는 SPIDER_BOSSES와 같은 위험도 구간별 값을 그대로 재사용한다. */
const DESERT_BOSSES: readonly BossDef[] = [
  {
    id: "boss-desert-1" as BossId,
    theme: "desert",
    name: "거대 전갈 자카르",
    description: "모래 아래 숨어 있다가 지나가는 발소리에 튀어나오는 거대 전갈이다",
    minRiskLevel: 1,
    baseDamage: 14,
    maxHp: 100,
    rules: [
      { id: "boss-zakar-burrow-trace" as BossRuleId, text: "자카르가 숨어 있는 모래 위에는 꼬리 끝이 지나간 가느다란 홈이 남는다." },
      { id: "boss-zakar-emerge-gap" as BossRuleId, text: "자카르는 모래에서 튀어나온 직후 몸을 다시 가다듬느라 잠깐 움직임이 멈춘다." },
    ],
  },
  {
    id: "boss-desert-2" as BossId,
    theme: "desert",
    name: "샌드웜 카르둠",
    description: "모래 바다를 헤엄치듯 이동하며 진동으로 사냥감을 좇는다",
    minRiskLevel: 2,
    baseDamage: 19,
    maxHp: 150,
    rules: [
      { id: "boss-kardum-sand-ridge" as BossRuleId, text: "카르둠이 땅속에서 이동하면 실제 몸보다 조금 앞쪽의 모래가 먼저 솟아오른다." },
      { id: "boss-kardum-landing-pause" as BossRuleId, text: "카르둠은 모래 밖으로 크게 뛰쳐나온 뒤 다시 파고들기까지 잠깐 시간이 걸린다." },
    ],
  },
  {
    id: "boss-desert-3" as BossId,
    theme: "desert",
    name: "모래거신 오벨론",
    description: "무너진 신전의 돌더미가 뭉쳐 일어난 거대한 존재다",
    minRiskLevel: 3,
    baseDamage: 25,
    maxHp: 210,
    rules: [
      { id: "boss-obelon-leg-collapse" as BossRuleId, text: "오벨론은 다리의 돌 배열이 흐트러지면 거대한 몸의 균형을 쉽게 잃는다." },
      { id: "boss-obelon-rebuild-stones" as BossRuleId, text: "몸에서 떨어져 나온 돌들은 잠시 뒤 다시 오벨론 쪽으로 끌려간다." },
    ],
  },
  {
    id: "boss-desert-4" as BossId,
    theme: "desert",
    name: "스핑크스 네프리스",
    description: "사막 깊은 곳의 마지막 관문을 지키며 답을 요구한다",
    minRiskLevel: 4,
    baseDamage: 32,
    maxHp: 280,
    rules: [
      { id: "boss-nephris-question-still" as BossRuleId, text: "네프리스는 질문을 던진 뒤 답을 들을 때까지 먼저 움직이지 않는다." },
      { id: "boss-nephris-wrong-answer-tell" as BossRuleId, text: "틀린 답을 들으면 공격하기 직전에 목의 장식과 눈이 먼저 빛난다." },
    ],
  },
];

export const DESERT_THEME: ThemeContent = {
  id: "desert",
  name: "사막",
  rules: DESERT_RULES,
  monsters: DESERT_MONSTERS,
  publicEnvironmentTags: DESERT_PUBLIC_ENVIRONMENT_TAGS,
  ecologyProfiles: DESERT_ECOLOGY_PROFILES,
  bosses: DESERT_BOSSES,
};

/**
 * 묘지 생태 규칙 6개.
 *
 * 소리·빛·매장물 세 축으로 나누고 소리·빛 축에는 일반 규칙과 조건부
 * 예외를 한 쌍씩 둔다.
 * docs/superpowers/specs/2026-08-19-lattebun-f2-2-theme-desert-graveyard-design.md
 */
const GRAVEYARD_RULES: readonly EcologyRule[] = [
  {
    id: "graveyard-silence" as RuleId,
    theme: "graveyard",
    text: "썩은 좀비는 소리에 둔감해 조용히 지나가도 쉽게 알아채지 못한다",
    conditional: false,
  },
  {
    id: "graveyard-ghoul-sound" as RuleId,
    theme: "graveyard",
    text: "구울은 아주 작은 소리에도 민감하게 반응해 숨죽여도 쉽게 들킨다",
    conditional: true,
  },
  {
    id: "graveyard-light" as RuleId,
    theme: "graveyard",
    text: "해골 마법사는 빛을 향해 다가온다",
    conditional: false,
  },
  {
    id: "graveyard-archer-light" as RuleId,
    theme: "graveyard",
    text: "스켈레톤 궁수는 빛에 노출되면 오히려 그림자 속으로 숨어버린다",
    conditional: true,
  },
  {
    id: "graveyard-guard" as RuleId,
    theme: "graveyard",
    text: "부장품이 그대로 남아 있는 무덤은 스켈레톤 병사가 지키고 있을 가능성이 크다",
    conditional: false,
  },
  {
    id: "graveyard-desecration" as RuleId,
    theme: "graveyard",
    text: "매장물을 훔쳐 가면 그 무덤을 지키던 존재가 더 사납게 반응한다",
    conditional: false,
  },
];

const GRAVEYARD_MONSTERS: readonly MonsterDef[] = [
  {
    id: "graveyard-zombie" as MonsterId,
    theme: "graveyard",
    name: "썩은 좀비",
    traits: ["소리에 둔감", "느림"],
  },
  {
    id: "graveyard-ghoul" as MonsterId,
    theme: "graveyard",
    name: "구울",
    traits: ["소리에 민감", "시체를 먹음"],
  },
  {
    id: "graveyard-soldier" as MonsterId,
    theme: "graveyard",
    name: "스켈레톤 병사",
    traits: ["부장품 수호", "정지 상태로 매복"],
  },
  {
    id: "graveyard-archer" as MonsterId,
    theme: "graveyard",
    name: "스켈레톤 궁수",
    traits: ["빛을 피함", "원거리 공격"],
  },
  {
    id: "graveyard-mage" as MonsterId,
    theme: "graveyard",
    name: "해골 마법사",
    traits: ["빛에 이끌림", "원거리 마법"],
  },
];

const GRAVEYARD_PUBLIC_ENVIRONMENT_TAGS: readonly EnvironmentTagDefinition[] = [
  {
    id: "graveyard-sound-alert" as PublicEnvironmentTagId,
    label: "소리 경계",
    evidenceMonsterTraits: ["소리에 민감"],
  },
  {
    id: "graveyard-light-exposure" as PublicEnvironmentTagId,
    label: "빛 노출",
    evidenceMonsterTraits: ["빛에 이끌림"],
  },
  {
    id: "graveyard-burial-guard" as PublicEnvironmentTagId,
    label: "매장물 수호",
    evidenceMonsterTraits: ["부장품 수호"],
  },
];

const GRAVEYARD_ECOLOGY_PROFILES: readonly EcologyProfile[] = [
  ecologyProfile(
    "graveyard",
    "graveyard-quiet-guard",
    2,
    ["graveyard-silence", "graveyard-light", "graveyard-guard"],
    ["graveyard-zombie", "graveyard-mage", "graveyard-soldier"],
    "graveyard-burial-guard",
  ),
  ecologyProfile(
    "graveyard",
    "graveyard-dim-crypt",
    3,
    ["graveyard-silence", "graveyard-light", "graveyard-desecration"],
    ["graveyard-zombie", "graveyard-mage"],
    "graveyard-light-exposure",
  ),
  ecologyProfile(
    "graveyard",
    "graveyard-grave-robber",
    3,
    ["graveyard-silence", "graveyard-guard", "graveyard-desecration"],
    ["graveyard-zombie", "graveyard-soldier"],
    "graveyard-burial-guard",
  ),
  ecologyProfile(
    "graveyard",
    "graveyard-hunters",
    4,
    ["graveyard-ghoul-sound", "graveyard-archer-light", "graveyard-guard"],
    ["graveyard-ghoul", "graveyard-archer", "graveyard-soldier"],
    "graveyard-sound-alert",
  ),
  ecologyProfile(
    "graveyard",
    "graveyard-blighted-tomb",
    5,
    ["graveyard-ghoul-sound", "graveyard-archer-light", "graveyard-desecration"],
    ["graveyard-ghoul", "graveyard-archer"],
    "graveyard-sound-alert",
  ),
];

/** 보스 수치는 SPIDER_BOSSES와 같은 위험도 구간별 값을 그대로 재사용한다. */
const GRAVEYARD_BOSSES: readonly BossDef[] = [
  {
    id: "boss-graveyard-1" as BossId,
    theme: "graveyard",
    name: "스켈레톤 장군 바르칸",
    description: "부하 해골들을 정렬시켜 무덤 입구를 지키는 지휘관이다",
    minRiskLevel: 1,
    baseDamage: 14,
    maxHp: 100,
    rules: [
      { id: "boss-barkan-command-blade" as BossRuleId, text: "부하 해골들은 바르칸이 검으로 가리킨 방향으로 먼저 움직인다." },
      { id: "boss-barkan-reform-line" as BossRuleId, text: "부하 진형이 무너지면 바르칸은 공격보다 대열을 다시 세우는 일을 먼저 한다." },
    ],
  },
  {
    id: "boss-graveyard-2" as BossId,
    theme: "graveyard",
    name: "리치 모르비안",
    description: "죽음의 마법으로 주변 시체를 조종하는 언데드 마법사다",
    minRiskLevel: 2,
    baseDamage: 19,
    maxHp: 150,
    rules: [
      { id: "boss-morbian-staff-link" as BossRuleId, text: "모르비안이 시체를 조종하는 동안 지팡이 끝의 푸른 불빛이 시체들의 눈과 함께 깜빡인다." },
      { id: "boss-morbian-death-tell" as BossRuleId, text: "큰 죽음 마법을 쓰기 직전 주변의 촛불과 혼불이 한꺼번에 꺼진다." },
    ],
  },
  {
    id: "boss-graveyard-3" as BossId,
    theme: "graveyard",
    name: "사신 아즈라엘",
    description: "정해진 자를 거두러 온다는 소문이 도는 존재다",
    minRiskLevel: 3,
    baseDamage: 25,
    maxHp: 210,
    rules: [
      { id: "boss-azrael-marked-prey" as BossRuleId, text: "아즈라엘은 낫끝으로 한 사람을 가리킨 뒤 한동안 그 사람만 집요하게 쫓는다." },
      { id: "boss-azrael-scythe-mist" as BossRuleId, text: "큰 횡베기 직전 주변의 검은 안개가 낫날 쪽으로 빨려 들어간다." },
    ],
  },
  {
    id: "boss-graveyard-4" as BossId,
    theme: "graveyard",
    name: "데스나이트 발드라크",
    description: "생전의 맹세에 묶여 무덤 가장 깊은 곳을 떠나지 못하는 기사다",
    minRiskLevel: 4,
    baseDamage: 32,
    maxHp: 280,
    rules: [
      { id: "boss-valdrak-oath-boundary" as BossRuleId, text: "발드라크는 생전의 맹세 때문에 가장 깊은 무덤의 돌문 경계를 넘어 오래 추격하지 못한다." },
      { id: "boss-valdrak-tomb-priority" as BossRuleId, text: "누군가 안쪽 석관에 가까워지면 발드라크는 현재 상대보다 석관을 지키는 일을 우선한다." },
    ],
  },
];

export const GRAVEYARD_THEME: ThemeContent = {
  id: "graveyard",
  name: "묘지",
  rules: GRAVEYARD_RULES,
  monsters: GRAVEYARD_MONSTERS,
  publicEnvironmentTags: GRAVEYARD_PUBLIC_ENVIRONMENT_TAGS,
  ecologyProfiles: GRAVEYARD_ECOLOGY_PROFILES,
  bosses: GRAVEYARD_BOSSES,
};

/**
 * 테마 콘텐츠 전체.
 * docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md
 */
export const THEMES: readonly ThemeContent[] = [SPIDER_THEME, DESERT_THEME, GRAVEYARD_THEME];

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
