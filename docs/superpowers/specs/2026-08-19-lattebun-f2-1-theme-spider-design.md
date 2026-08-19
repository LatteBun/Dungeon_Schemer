# F2-1 테마 콘텐츠·거미굴 설계

작성 도구: Claude Code (Opus 5)

## 이 문서의 지위

[캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)의 `F2-1`을 구현한다. 규칙의 근거는 [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)와 [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)에 있다.

`F2`는 애초에 테마 3종 전부를 한 항목으로 두고 있었으나, 거미굴을 먼저 완성해 검증 패턴을 잡은 뒤 사막·묘지로 넘어가기로 하고 배정표를 `F2-1`·`F2-2`로 나눴다. 이 문서는 `F2-1`(거미굴)만 다룬다. 사막·묘지는 `F2-2`의 몫이다.

## 이번에 함께 정한 것

거미굴 콘텐츠를 구체화하는 과정에서 설정집 자체가 두 군데 바뀌었다. 이미 커밋했다.

- **테마 이름**: `폐광`을 `사막`으로 바꿨다(`mine` → `desert`). 거미굴이 불·빛·진동, 묘지가 빛·소리·매장물을 축으로 쓰는 것과 나란히 사막은 더위·물·발자국을 축으로 잡는다
- **보스 수**: 테마당 보스 1종을 **위험도 구간별 4종**으로 바꿨다. 한 보스가 테마 전체(던전 5개)를 대표하면 위험도가 올라도 상대가 그대로라 체감이 약하다. `BossDef`에 `minRiskLevel`을 추가하고, 그 값 이상인 초기 위험도의 던전이 그 보스를 만난다. `길잡이 등급`과 이름이 겹치지 않도록 `C`·`B`·`A`·`S` 글자는 쓰지 않는다
- **테마별 위험도 분포**: 캠페인 전체 초기 위험도 3/4/4/3/1을 테마 3종이 어떻게 나눠 갖는지 고정했다(거미굴 2/1/1/1/0, 사막 1/2/1/1/0, 묘지 0/1/2/1/1). 거미굴에는 ★5 던전이 없어, `minRiskLevel: 4`인 보스는 거미굴에서 항상 ★4 던전으로만 등장한다

## 타입 변경

`lib/domain/dungeon.ts`를 고친다.

```typescript
export interface BossDef {
  id: BossId;
  theme: ThemeId;
  name: string;
  description: string;
  /** 이 값 이상인 초기 위험도의 던전이 이 보스를 만난다. 1·2·3·4 중 하나. */
  minRiskLevel: RiskLevel;
  baseDamage: number;
  maxHp: number;
}

export interface ThemeContent {
  id: ThemeId;
  name: string;
  rules: readonly EcologyRule[];
  monsters: readonly MonsterDef[];
  /** minRiskLevel 1·2·3·4 오름차순 4개. */
  bosses: readonly BossDef[];
}
```

`CampaignDungeon.bossId`는 고치지 않는다. 단수 필드 그대로 두고, C1이 던전을 생성할 때 `selectThemeBoss`로 한 번 골라 저장한다. 초기 위험도가 캠페인 동안 바뀌지 않으므로 다시 고를 이유가 없다.

## 콘텐츠 모듈 구조

```text
lib/content/
  themes.ts             THEMES 배열과 selectThemeBoss
  theme-validation.ts   수량·중복·빈 문구 검증
  theme-validation.test.ts
```

옛 `lib/content/validation.ts`가 쓰던 `RuleError("INVALID_GENERATION", message, details)` 패턴을 그대로 따른다.

### `selectThemeBoss`

```typescript
export function selectThemeBoss(theme: ThemeContent, riskLevel: RiskLevel): BossDef {
  // bosses는 minRiskLevel 오름차순이므로 조건을 만족하는 마지막 것을 고른다.
}
```

이 함수를 F2가 갖는 이유가 있다. 보스 선택 로직이 C1과 E4 양쪽에서 각자 구현되면 조용히 갈라질 수 있다. 콘텐츠와 그 콘텐츠를 고르는 규칙을 한곳에 두면 그럴 일이 없다.

### 검증기가 확인하는 것

`docs/systems/DUNGEON_THEMES_AND_ECOLOGY.md`의 「생성 오류」를 그대로 코드로 옮긴다. `F2-1` 시점에는 거미굴 하나만 검증 대상이므로, 검증기는 **테마 배열을 받아 각 테마에 대해** 아래를 확인하는 형태로 짠다. 나중에 `F2-2`가 배열에 사막·묘지를 추가해도 검증기를 다시 쓰지 않는다.

- 테마마다 규칙 6개·몬스터 5종·보스 4종
- 보스의 `minRiskLevel`이 1·2·3·4를 빠짐없이 정확히 담음 (중복도 없음)
- 테마에 조건부 규칙이 1개 이상
- 규칙·몬스터·보스의 식별자가 테마 안에서 중복되지 않음
- 규칙 `text`, 몬스터 `name`, 보스 `name`·`description`이 비어 있지 않음

카드 진위 조합(활성 규칙마다 진실·거짓·중립 2장 이상)은 `F3`이 카드 풀을 만들기 전까지 검증할 수 없다. `F2-1`의 검증기는 이 항목을 다루지 않는다. `F3`이 카드 풀 검증기를 만들 때 이 항목을 가져간다.

## 거미굴 콘텐츠

### 생태 규칙 6개

세 축(불·빛 / 진동 / 냄새·어둠)으로 나누고, 각 축에서 일반 규칙과 그 예외(조건부)를 한 쌍씩 둔다. 조건부 2개로 계약의 "1개 이상"을 여유 있게 만족한다.

| `id` | `text` | `conditional` |
| --- | --- | :-: |
| `spider-fire` | 거미는 불을 피한다 | — |
| `spider-brood-light` | 새끼거미 떼는 오히려 불빛에 몰려든다 | O |
| `spider-vibration` | 동굴거미는 발소리와 진동에 민감하게 반응해 다가오는 것을 먼저 알아챈다 | — |
| `spider-armor-vibration` | 철갑거미는 두꺼운 겉껍질 때문에 진동을 거의 느끼지 못해 다가와도 알아채지 못한다 | O |
| `spider-carrion` | 시체 냄새가 나는 곳에는 시체거미가 몰려든다 | — |
| `spider-shadow` | 그림자거미는 빛이 없는 곳에서만 모습을 드러낸다 | — |

`spider-fire`만 아는 플레이어는 횃불을 권하는 카드를 진실로 읽는다. 그 지점의 몬스터가 새끼거미 떼라면 `spider-brood-light`가 활성 규칙일 때 같은 카드가 모순이 된다. `spider-vibration`과 `spider-armor-vibration`도 같은 구조다 — 조용히 접근하라는 조언은 동굴거미에게는 참이고 철갑거미에게는 거짓이다.

### 몬스터 5종

| `id` | `name` | `traits` |
| --- | --- | --- |
| `spider-hatchling` | 새끼거미 | 무리, 불빛에 이끌림 |
| `spider-corpse` | 시체거미 | 부패한 시체를 먹음, 냄새에 민감 |
| `spider-cave` | 동굴거미 | 진동 감지, 좁은 통로 서식 |
| `spider-armored` | 철갑거미 | 두꺼운 겉껍질, 진동 둔감 |
| `spider-shadow` | 그림자거미 | 어둠 속에서만 활동, 빛을 피함 |

`spider-shadow`는 몬스터 ID와 규칙 ID가 같은 문자열(`spider-shadow`)이다. 몬스터와 규칙은 서로 다른 ID 네임스페이스(`MonsterId` / `RuleId`)이므로 브랜드 타입이 섞이지 않는다. 검증기의 중복 검사도 규칙과 몬스터를 따로 검사하므로 충돌이 아니다.

### 보스 4종

| `minRiskLevel` | `name` | `description` | `baseDamage` | `maxHp` |
| ---: | --- | --- | ---: | ---: |
| 1 | 거대거미 라그나 | 거미굴 얕은 층을 지키는 거대한 개체로, 위협보다는 존재감으로 압도한다 | 14 | 100 |
| 2 | 고치관리자 모르칸 | 포획한 먹잇감을 고치로 감싸 보관하며 침입자를 끈질기게 얽맨다 | 19 | 150 |
| 3 | 아라크네 세리나 | 여러 갈래의 거미줄을 동시에 조종해 도주로를 차단하는 노련한 사냥꾼이다 | 25 | 210 |
| 4 | 거미여왕 아라크샤 | 거미굴 가장 깊은 곳을 지배하는 여왕으로, 굴 전체의 거미들을 부린다 | 32 | 280 |

수치는 개편 이전 등급별 보스가 쓰던 값(14/19/25/32, 100/150/210/280)을 그대로 가져왔다. 3인 파티 공격력 합이 대략 30 안팎이라는 전제로 1구간은 약 3턴, 4구간은 약 8턴의 전투가 되도록 잡혀 있던 수치이고, 위험도 구간제로 바뀌어도 그 턴수 설계 의도는 유효하다. 잠정 수치이며 `B1` 백테스트에서 조정한다.

## 검증

- `pnpm typecheck`·`pnpm lint`·`pnpm build` 통과
- `theme-validation.test.ts`: 정상 콘텐츠 통과, 그리고 계약 위반마다(규칙 수 부족, `minRiskLevel` 중복, 조건부 없음, ID 중복, 빈 문구) `RuleError("INVALID_GENERATION")`을 던지는지 각각 확인
- `selectThemeBoss` 테스트: ★1~★5 각각에 대해 올바른 보스를 고르는지, 특히 ★4와 ★5가 같은 보스(구간 4)로 묶이는지 확인
- 컴파일 타임 계약이 필요하면 `lib/domain/__checks__.ts`에 더한다. 다만 `bosses` 배열의 `minRiskLevel` 조합은 런타임 데이터라 타입으로 고정할 수 없으므로 검증기가 담당한다

## 이번 범위 밖

- 사막·묘지 콘텐츠 → `F2-2`
- 카드 풀과 진위 조합 검증 → `F3`
- 사건·아이템 콘텐츠 → `F5`
- 보스 선택을 실제로 캠페인 초기화에 연결하는 것 → `C1`
- 활성 규칙 추첨과 카드 정합·모순 판정 → `E2`
- 보스전 턴 진행과 피해 계산 → `E4`

## 관련 문서

- [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)
- [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
- [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
- [F1 도메인 계약 재정의 설계](2026-08-19-lattebun-f1-domain-contract-design.md)
