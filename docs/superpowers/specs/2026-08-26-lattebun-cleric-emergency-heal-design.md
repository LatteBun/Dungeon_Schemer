# 성직자 응급 치유 설계

- 작성자: LatteBun
- 작성 도구: ChatGPT
- 작업 분류: 직업 전투 능력 · 원정 자원 · U5 전투 재생 · 밸런스 변경
- 상태: 사용자 재설계 승인 및 구현 완료

## 1. 목적

현재 다섯 직업은 최대 HP, 공격력, 피격 가중치만 다르고 자동 전투에서는 모두 같은
방식으로 공격한다. 특히 성직자는 설명상 파티를 지탱하는 직업이지만 실제로는 가장
낮은 공격력으로 공격만 하므로, 약점은 있으나 고유한 강점은 없는 상태다.

성직자에게 자동 응급 치유를 추가해 다음을 달성한다.

- 성직자가 포함된 파티에 눈에 보이는 생존 강점을 준다.
- 플레이어가 전투 버튼을 직접 누르지 않아도 직업 조합의 의미를 키운다.
- 치유가 공격 행동을 대신하게 해 공짜 생존 보너스가 되지 않게 한다.
- 원정당 2회 자원으로 경로 길이와 라운드 수에 따라 회복 횟수가 무한히 늘지 않게
  하되, 대상의 최대 HP에 비례한 회복으로 직업별 체력 차이를 반영한다.
- 일반 몬스터전부터 보스전까지 남은 횟수를 하나의 원정 자원으로 이어 간다.

이 기능은 플레이어를 전투원으로 바꾸지 않는다. 성직자의 행동은 rules 계층이
결정하고, U5는 이미 확정된 공격·치유 기록을 순차 재생한다. 따라서
`GAME_PRINCIPLES.md`의 「플레이어는 전투원이 아니라 길잡이다」와 자동 전투
표현 계층 분리 원칙을 유지한다.

## 2. 목표와 비목표

### 목표

- 성직자는 조건을 만족하면 공격 대신 `치유 기도`를 자동 사용한다.
- 치유는 원정당 2회만 사용할 수 있으며 전투별 추가 제한은 두지 않는다.
- 생존자 중 HP가 최대 HP의 50% 이하인 인원이 있을 때만 발동한다.
- 대상은 HP 비율이 가장 낮은 생존자이며 성직자 자신도 포함한다.
- 회복량은 대상 최대 HP의 25%를 반올림한 값이고 최대 HP를 넘지 않는다.
- 일반 몬스터전에서 남은 횟수가 보스전까지 이어지고 새 원정에서는 2회로
  초기화된다.
- 공격과 치유를 서로 다른 전투 행동 기록으로 남겨 U5가 수치·동작·문장을
  올바르게 재생한다.
- 같은 시드와 같은 입력 상태는 같은 대상, 같은 행동 순서, 같은 최종 상태를 만든다.
- 성직자가 없거나 치유 조건이 성립하지 않는 전투는 새 선택 필드 외의 기존 공격
  행동·대상 RNG·피해·최종 HP를 그대로 유지한다.

### 비목표

- 플레이어가 치유 시점이나 대상을 직접 고르는 버튼을 만들지 않는다.
- 부활, 상태 이상 해제, 보호막, 광역 회복, 지속 회복, 전투 밖 회복을 만들지 않는다.
- MP, 마나, 쿨다운, 스킬 슬롯, 장비나 인벤토리를 만들지 않는다.
- 한 직업에 여러 능력을 넣는 범용 스킬 프레임워크를 만들지 않는다.
- 전사·궁수·마법사·도적의 고유 능력을 이번 변경에 추가하지 않는다.
- 성직자의 최대 HP·공격력·피격 가중치나 몬스터·보스·휴식 수치를 함께 조정하지
  않는다.
- 치유가 신뢰, 조언 수용, 적발, 조언 압력, 계약 보상에 직접 영향을 주지 않는다.
- 전용 캐릭터 이미지, 다프레임 스프라이트, 파티클, 카메라 연출을 추가하지 않는다.
- 기존 전체 밸런스 부채를 이번 기능 하나로 해결하려 하지 않는다.

## 3. 확정된 성직자 규칙

성직자의 기존 수치는 유지한다.

| 항목 | 값 |
| --- | ---: |
| 최대 HP | 28 |
| 공격력 | 5 |
| 피격 가중치 | 1 |

추가 능력은 다음과 같다.

| 항목 | 확정 규칙 |
| --- | --- |
| 표시 이름 | `치유 기도` |
| 안정 식별자 | `emergencyHeal` |
| 조작 방식 | rules 계층이 자동 판정. 플레이어 직접 조작 없음 |
| 원정당 사용 횟수 | 2회 |
| 전투당 사용 횟수 | 원정 잔여 횟수 안에서 같은 전투에 최대 2회 사용 가능 |
| 발동 시점 | 생존 적이 남아 있는 성직자의 파티 행동 차례 |
| 발동 조건 | 자신을 포함한 생존자 중 현재 HP가 최대 HP의 50% 이하인 인원이 있음 |
| 대상 | 조건을 만족한 생존자 중 HP 비율이 가장 낮은 인원 |
| 동률 | `BattleInput.party` 배열에서 앞선 인원 |
| 회복량 | 대상 최대 HP의 25%를 반올림. 실제 회복은 최대 HP까지 |
| 행동 비용 | 그 차례의 공격을 포기하고 치유 한 번만 수행 |
| 부활 | 불가. HP 0인 대상은 후보에서 제외 |
| 미발동 | 기존 공격력 5로 정상 공격 |
| 초기화 | 새 원정 또는 재도전 시작 시 2회 |

### 3.1 50% 판정

부동소수점 비율을 비교하지 않고 다음 정수 비교를 사용한다.

```text
member.hp * 100 <= member.maxHp * 50
```

따라서 정확히 50%인 경우도 치유 대상이다. 최대 HP가 홀수여도 같은 규칙으로
판정하며 화면 반올림과 전투 판정이 갈리지 않는다.

### 3.2 대상 우선순위

대상 비교는 `left.hp / left.maxHp`와 `right.hp / right.maxHp`를 직접 나누지 않고
교차 곱으로 판정한다.

```text
left.hp * right.maxHp < right.hp * left.maxHp
```

비율이 같으면 파티 입력 순서를 유지한다. 치유 대상 선정에는 RNG를 소비하지
않는다. 성직자 자신도 다른 생존자와 같은 후보이며 별도 우선·후순위를 두지 않는다.

### 3.3 횟수 소비

다음 조건을 모두 만족해 실제 치유 행동이 기록될 때만 원정 횟수 1회를 소비한다.

- 성직자가 살아 있고 자기 행동 차례에 도달했다.
- 그 시점에 생존 적이 한 명 이상 남아 있다.
- 원정 횟수가 1 이상 남았다.
- 조건을 만족하는 생존 대상이 있다.
- 실제 회복량이 1 이상이다.

앞선 파티원이 마지막 적을 쓰러뜨렸다면 뒤에 있던 성직자는 치유하지 않고 파티 행동
단계를 종료한다. 승부가 끝난 뒤 횟수를 소모하거나 전투 결과를 바꾸지 않는다.

성직자가 행동 전에 사망하거나, 전투를 회피했거나, 모든 생존자가 50%를 초과하면
횟수를 소비하지 않는다. 같은 전투에서 다음 성직자 행동 차례에 조건이 다시
성립하고 원정 횟수가 남아 있으면 다시 치유하며, 남은 횟수는 다음 전투로 이어진다.

### 3.4 회복량 계산

명목 회복량은 치유 대상의 최대 HP를 기준으로 한 고정 25%이며 난수를 사용하지 않는다.

```text
nominalHealing = Math.round(target.maxHp * 25 / 100)
actualHealing = min(nominalHealing, target.maxHp - target.hp)
```

현재 직업 최대 HP 기준 명목 회복량은 전사 11, 궁수 8, 성직자 7, 마법사 6,
도적 8이다. `BattleHealActionRecord.healing`에는 명목값이 아니라 실제 증가량을
기록한다. 따라서 미래 콘텐츠에서 최대 HP가 작거나 최대 HP에 가까운 대상을 허용하게
되더라도 초과 회복은 기록하지 않는다.

## 4. 직업 콘텐츠 계약

`ClassDef`에 선택적인 단일 전투 능력 정의를 추가한다. 직업 ID를 보고 전투 엔진이
분기하지 않는다. 아래 코드는 새 필드와 타입 경계를 설명하는 예시이며 기존 필드의
공개 형태를 불필요하게 바꾸지 않는다.

```ts
export interface EmergencyHealAbilityDef {
  readonly kind: "emergencyHeal";
  readonly name: string;
  readonly healTargetMaxHpPercent: number;
  readonly usesPerExpedition: number;
  readonly triggerAtOrBelowHpPercent: number;
}

export type ClassBattleAbilityDef = EmergencyHealAbilityDef;

export interface ClassDef {
  id: ClassId;
  name: string;
  description: string;
  maxHp: number;
  attack: number;
  hitWeight: number;
  battleAbility?: ClassBattleAbilityDef;
}
```

성직자 콘텐츠는 다음 값을 가진다.

```ts
battleAbility: {
  kind: "emergencyHeal",
  name: "치유 기도",
  healTargetMaxHpPercent: 25,
  usesPerExpedition: 2,
  triggerAtOrBelowHpPercent: 50,
}
```

성직자 설명은 실제 동작에 맞게 `부상자를 치유해 파티를 지탱하지만 스스로는
약하다`로 갱신한다. 다른 네 직업에는 `battleAbility`가 없다.

이 구조는 직업 목록이 열린다는 기존 계약을 유지한다. 능력이 없는 새 직업은 전투
규칙 수정 없이 기존 공격 행동을 사용한다. 새로운 `kind`의 능력을 추가하는 일은
새 행동 규칙이므로 별도 설계가 필요하다.

### 4.1 콘텐츠 검증

능력 정의는 다음을 만족해야 한다.

- `name`은 비어 있지 않다.
- 대상 최대 HP 회복 백분율과 원정 횟수는 양의 안전한 정수다.
- 대상 최대 HP 회복 백분율은 1 이상 100 이하이다.
- 발동 백분율은 1 이상 100 이하의 안전한 정수다.
- 능력 정의가 없는 직업은 기존 동작을 그대로 사용한다.

잘못된 정의를 25·2·50으로 조용히 대체하지 않는다. 콘텐츠 검증에서
`RuleError("INVALID_GENERATION", ...)`으로 실패한다.

직업 콘텐츠는 테마 콘텐츠의 `validateThemes(THEMES)`와 같은 기존 패턴을 따른다.
`validateClasses(CLASSES)`를 모듈 로드 시 호출해 실제 콘텐츠를 즉시 검증하고, 일반전·
보스전 어댑터에 테스트나 외부 호출이 주입한 `classDefs`도 전투원 입력으로 바꾸기 전에
같은 검증기를 통과시킨다. 실제 `CLASSES`만 검증하고 주입된 정의를 신뢰하지 않는다.

## 5. 원정 자원 계약

치유 횟수는 캐릭터가 캠페인 내내 들고 다니는 영구 상태가 아니다. 한 계약에서만
유효한 **원정 자원**이다. 따라서 `Character`에는 넣지 않고 `ExpeditionState`에
둔다.

```ts
readonly battleAbilityUsesRemainingByCharacterId:
  Readonly<Partial<Record<CharacterId, number>>>;
```

맵의 의미는 다음과 같다.

- 현재 파티원 중 `battleAbility`를 가진 캐릭터만 키를 가진다.
- 값은 현재 원정에 남은 사용 횟수다.
- 능력이 없는 캐릭터의 키는 존재하지 않는다.
- 능력 보유자가 사망해도 원정이 끝날 때까지 키는 보존한다.
- 사망자의 잔여 횟수를 다른 캐릭터에게 넘기지 않는다.

`createExpeditionForOffer`가 계약 파티와 현재 직업 정의를 읽어 초기 맵을 만든다.
성직자는 2로 시작한다. `START_EXPEDITION`은 초기 상태에서 능력 보유자의 값이 정확히
`usesPerExpedition`인지 확인한다. 활성 원정의 이후 전이에서는 0 이상 초기값 이하인지
검증한다.

일반 몬스터전과 보스전 어댑터는 입력 잔여 횟수를 전투원 런타임 상태로 옮기고,
전투 뒤 갱신된 잔여 횟수를 명시적으로 반환한다. 캠페인 전이는 이 값을 다음
`ExpeditionState`에 기록한다. 화면이나 정산이 `battle.actions`를 다시 세어 원정
상태를 계산하지 않는다.

```text
createExpeditionForOffer
→ ExpeditionState.battleAbilityUsesRemainingByCharacterId = { clericId: 2 }
→ 일반 몬스터전 입력
→ 치유 사용 시 { clericId: 1 }
→ 다음 일반전 또는 보스전 입력
→ 치유 사용 시 { clericId: 0 }
→ 정산에서 폐기
→ 다음 원정은 다시 { clericId: 2 }
```

전투를 회피한 몬스터 사건은 입력 맵을 그대로 반환한다. 새 원정과 같은 던전
재도전은 서로 다른 원정이므로 다시 2회다. 정산·월드턴·캠페인 풀에는 이 맵을
복사하지 않는다. `copyActiveExpedition`과 Store 전이는 맵을 새 객체로 복사해 외부
변경이 활성 원정에 스며들지 않게 한다.

일반전과 보스전이 이 맵을 전투원 능력 상태로 바꾸고 다시 추출하는 규칙은 서로 복사하지
않는다. 능력 정의와 잔여 맵을 결합하고, 전투 결과를 기존 전체 맵 위에 얹고, 키·범위를
검증하는 좁은 공용 rules helper를 사용한다. 이것은 여러 능력을 등록하는 범용 스킬
프레임워크가 아니라 현재의 단일 `emergencyHeal` 계약을 두 어댑터가 동일하게 적용하기
위한 변환 경계다. 전투에 참가하지 못한 사망자의 키와 값은 이 helper가 그대로 보존한다.

## 6. 전투 엔진 계약

`BattlePartyMember`는 전투에 필요한 선택적 능력과 현재 잔여 횟수를 받는다.

```ts
export interface BattlePartyMemberAbilityState
  extends EmergencyHealAbilityDef {
  readonly remainingUses: number;
}

export interface BattlePartyMember {
  readonly id: string;
  readonly classId: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly attack: number;
  readonly hitWeight: number;
  readonly battleAbility?: BattlePartyMemberAbilityState;
}
```

`resolveBattle`은 중첩 객체까지 복사해 입력을 변경하지 않는다. 전투가 끝난
`BattleResolution.party`에는 갱신된 `remainingUses`가 들어 있다.

독립 `resolveBattle` 호출도 런타임 능력 상태를 신뢰하지 않는다. 능력 정의의 콘텐츠
제약에 더해 `remainingUses`가 0 이상 `usesPerExpedition` 이하의 안전한 정수인지
검증한다. 잘못된 런타임 능력 상태는 `INVALID_GENERATION`으로 거부하고, 0으로 자르거나
초기 횟수로 되돌리지 않는다.

### 6.1 파티 행동 순서

각 라운드의 기존 파티 배열 순서와 적 행동 순서는 유지한다.

여기서 파티 순서는 화면의 `inSeatOrder`가 아니라 rules 입력인 `BattleInput.party`
순서다. 화면 좌석 순서는 기존 전투 행동 순서와 대상 RNG를 바꾸지 않기 위해 별도로
섞이므로, 치유 동률 판정에 화면 좌석 순서를 사용하지 않는다.

```text
파티원을 기존 배열 순서로 순회
→ 사망한 파티원이면 건너뜀
→ 생존 적이 없으면 파티 행동 단계 종료
→ 사용할 수 있는 emergencyHeal이 있는가
→ 50% 이하 생존 대상이 있는가
  → 있으면 가장 낮은 HP 비율 대상에게 치유, 공격 생략, 다음 파티원
  → 없으면 기존 공격
→ 파티 순회 뒤 적이 모두 쓰러졌으면 승리
→ 살아 있는 적의 기존 가중 대상 공격
```

한 차례에는 공격 또는 치유 중 하나만 기록한다. 치유 뒤 같은 성직자가 추가 공격하지
않는다. 전투당 사용 횟수 상태는 두지 않으며, 원정 잔여 횟수만 실제 치유 때마다
감소시킨다. 따라서 조건이 이어지는 긴 전투에서는 한 성직자가 원정 자원 2회를 같은
전투에서 모두 사용할 수 있다.

### 6.2 수정치와 치유

다음 수정치는 공격 피해에만 적용하고 대상 최대 HP 비례 치유량에는 적용하지 않는다.

- 사건 `partyDamageMultiplier`
- 상인 `partyDamageMultiplier`
- 조언 압력의 주는 피해 배율
- 보스 정보의 `outgoingDamage` 배율

받는 피해 배율과 대상 가중치도 치유량이나 치유 대상 선택을 바꾸지 않는다. 치유는
치명타, 빗나감, 임의 범위가 없으며 대상 최대 HP의 25%를 반올림한 명목값만 사용한다.

공격을 포기하는 기회비용은 그대로 남는다. 공격 배율이 높은 상황에서는 포기한
공격의 가치도 커지지만 치유 비율은 25%로 유지된다.

### 6.3 RNG 보존

치유 조건 검사와 대상 선정은 RNG를 소비하지 않는다. 능력이 없거나 발동 조건이
성립하지 않는 전투는 기존과 같은 지점에서만 적 대상 RNG를 소비해야 한다. 따라서
능력 미발동 경로가 RNG 호출 하나 때문에 다른 대상을 맞는 회귀를 허용하지 않는다.

치유가 실제 발동한 전투는 적 처치 시점과 라운드 수가 달라질 수 있으므로 이후
전투 결과가 기존과 달라지는 것이 정상이다.

## 7. 전투 행동 기록

치유를 음수 피해나 피해 0으로 표현하지 않는다. `BattleActionRecord`를 명시적인
판별 유니온으로 바꾼다.

```ts
interface BattleActionRecordBase {
  readonly round: number;
  readonly actorId: string;
  readonly targetId: string;
  readonly targetHpBefore: number;
  readonly targetHpAfter: number;
}

export interface BattleAttackActionRecord extends BattleActionRecordBase {
  readonly kind: "attack";
  readonly actorSide: "party" | "enemy";
  readonly damage: number;
  readonly defeated: boolean;
}

export interface BattleHealActionRecord extends BattleActionRecordBase {
  readonly kind: "heal";
  readonly actorSide: "party";
  readonly abilityKind: "emergencyHeal";
  readonly healing: number;
}

export type BattleActionRecord =
  | BattleAttackActionRecord
  | BattleHealActionRecord;
```

공격 행동은 기존 불변식을 유지한다. 치유 행동은 다음을 만족한다.

- actor와 target 모두 파티 참가자다.
- actor와 target은 행동 시점에 살아 있다.
- actor와 target은 같을 수 있다.
- `healing`은 실제 증가량이며 1 이상 대상 최대 HP의 25% 반올림 값 이하다.
- `targetHpAfter > targetHpBefore`다.
- `targetHpAfter`는 대상의 최대 HP 이하이다.
- 치유 행동에는 `damage`나 `defeated`를 넣지 않는다.

보스 정보 큐는 공격 행동에만 붙는다.

- `outgoingDamage`: 파티의 `kind === "attack"` 행동
- `targetWeight`, `incomingDamage`: 적의 `kind === "attack"` 행동
- `kind === "heal"`: 어떤 보스 정보 큐도 붙이지 않음

`actionIndex`는 공격과 치유를 모두 포함한 전체 행동 배열의 위치다. U5 재생과 E4
큐는 같은 인덱스를 사용한다.

## 8. 일반전·보스전 어댑터와 캠페인 전이

일반 몬스터전과 보스전은 같은 `BattleEngine`을 사용하므로 같은 능력 계약을
소비한다.

두 어댑터는 같은 공용 변환 helper로 `ClassDef`·원정 잔여 맵을 전투원 능력 상태로
결합하고 전투 뒤 잔여 맵을 추출한다. 각 어댑터가 누락 키 보정, 사망자 키 보존,
출력 증가 검증을 따로 구현하지 않는다.

### 8.1 일반 몬스터전

`resolveMonsterEventBattle` 입력에 원정 잔여 횟수 맵을 추가하고 반환값에도 갱신된
맵을 포함한다.

```ts
{
  battle: BattleResolution | null;
  pendingMerchantEffect: PendingMerchantEffect | null;
  battleAbilityUsesRemainingByCharacterId:
    Readonly<Partial<Record<CharacterId, number>>>;
}
```

전투를 회피하면 `battle`은 `null`이고 잔여 횟수는 입력과 같다. 전투를 실행하면
클래스 정의의 능력 설정과 원정 맵의 잔여 횟수를 결합해 전투원 입력을 만든다.

`transitionChooseAdvice`는 전투 뒤 HP를 기존 파티 명단 위에 얹는 것과 같은 시점에
새 잔여 횟수도 `ExpeditionState`에 쓴다. `partyMembers`나 캠페인 풀의 `Character`에는
잔여 횟수를 넣지 않는다.

### 8.2 보스전

`BossBattleInput`에 같은 잔여 횟수 맵을 추가하고 `BossBattleResolution`이 갱신된
맵을 반환한다. `transitionEnterBoss`가 이를 최종 `ExpeditionState`에 기록한다.

일반전에서 두 번 모두 사용했다면 보스전 성직자는 공격만 한다. 일반전에서 한 번도
사용하지 않았다면 보스전에서 조건이 두 번 성립할 때 원정 잔여 2회를 모두 사용할 수
있다. 원정이 보스전으로 끝난 뒤 남은 횟수는 정산 효과로 바뀌지 않고 폐기된다.

### 8.3 집계 기록

`ExpeditionOutcome.hpChanges`와 파티 카드의 전후 HP는 전투 전체의 최종값을 계속
사용한다. 개별 치유의 주체·대상·실제 회복량은 `BattleResolution.actions`가 단일
근거다. 정산의 기존 `SettlementCauseInputs.damage` 필드 모양은 바꾸지 않지만
내용은 HP 증가도 담을 수 있는 `HP 이전 → 이후` 문장으로 유지한다. 최종 전후가
같으면 `피해 없이 지나갔다`가 아니라 `최종 HP 변화 없음`으로 표현해 전투 중
피해와 치유가 서로 상쇄된 경우를 거짓으로 설명하지 않는다.

치유 횟수는 명성·골드·신뢰 원인으로 승격하지 않는다.

## 9. 화면과 전투 재생

화면은 치유 여부와 회복량을 다시 판단하지 않는다. `BattleActionRecord`와 전투별
능력 상태만 재생한다.

### 9.1 재생 프레임

기존 `idle → attack → impact → settle → complete` 단계는 유지한다. 프레임에는
현재 행동 종류와 치유량, 프레임 시점의 잔여 횟수를 추가한다.

```ts
readonly actionKind: "attack" | "heal" | null;
readonly damage: number | null;
readonly healing: number | null;
readonly battleAbilityUsesRemainingByParticipantId:
  Readonly<Record<string, number>>;
```

치유 행동은 같은 세 프레임을 다음처럼 해석한다.

| 단계 | 표현 |
| --- | --- |
| `attack` | 성직자는 적에게 돌진하지 않고 제자리에서 짧게 기도 동작을 표현 |
| `impact` | 대상은 피격 흔들림 없이 `+실제 회복량`을 표시 |
| `settle` | 대상 HP 막대와 우측 파티 상태 HP가 함께 증가하고 잔여 횟수 1 감소 |

새 이미지, 파티클, 카메라 연출을 요구하지 않는다. 기존 정적 PNG와 CSS·Framer
Motion의 짧은 이동·크기·투명도 변화만 사용한다. `prefers-reduced-motion`에서는
동작을 줄이되 회복 숫자와 HP·횟수 변화는 그대로 보인다.

### 9.2 문구와 접근성

공격 문구는 기존 문장을 유지한다. 치유는 다음 정보를 말한다.

```text
{성직자 이름}이 {대상 이름}을 {실제 회복량} 회복했습니다.
```

성직자 자신이 대상이어도 같은 문장 규칙을 사용한다. 화면의 떠오르는 숫자는
`+N`, 스크린 리더 문장은 `N 회복`으로 읽는다. 치유를 `-0 피해`나 공격으로
안내하지 않는다.

### 9.3 잔여 횟수 재생

U5는 이미 전투가 끝난 원정의 최종 횟수를 첫 프레임부터 노출하지 않는다.
`BattleResolution.party`의 최종 잔여 횟수에 해당 전투에서 그 actor가 기록한 치유
행동 수를 더해 전투 시작 횟수를 복원한다. 치유 `settle`에서만 1회 감소시키며
complete 프레임은 `BattleResolution.party`의 최종값과 일치해야 한다.

예를 들어 이전 전투에서 한 번 사용해 이번 전투를 1/2로 시작했다면 다시 보기도
1/2에서 시작하고 치유 시 0/2가 된다. 전투 건너뛰기는 complete 프레임으로 이동해
최종 횟수를 보여준다.

완료된 전투의 다시 보기에서는 기존 U5 계약대로 우측 카드의 HP·신뢰·확정 변화량은
최종값을 유지한다. **능력 잔여 횟수만 예외로 replay frame을 따라** 전투 시작값으로
되돌아갔다가 치유 `settle`에서 감소한다. 중앙 HP 재생을 우측 최종 HP에 다시 적용하거나,
반대로 잔여 횟수를 최종값으로 고정하지 않는다.

`use-u5-battle-playback`이 새 replay를 식별하는 signature에는 `actionKind`, `healing`,
프레임별 `battleAbilityUsesRemainingByParticipantId`를 모두 포함한다. HP와 최종 결과가
같더라도 공격·치유 종류나 잔여 횟수 사슬이 다르면 서로 다른 replay이며 frame index를
0으로 초기화한다.

### 9.4 파티 카드 표시

중요한 직업 강점과 남은 자원을 숨기지 않는다. 공용 파티 카드 뷰에 선택적인 능력
상태를 추가하되 새 패널이나 새 행 높이를 만들지 않는다.

```ts
readonly battleAbilityStatus?: {
  readonly label: string;
  readonly remaining: number;
  readonly total: number;
};
```

표시 범위는 다음과 같다.

- U3 계약 상세: 성직자에게 `치유 2회`를 표시한다. 작은 게시판 공고지에는 새 문구를
  넣지 않는다.
- U4 지도·원정 상태: 현재 원정 잔여 횟수를 `치유 2/2`, `치유 1/2`, `치유 0/2`로
  표시한다.
- U5 전투 재생: replay frame의 횟수를 표시해 치유 settle과 동시에 감소한다.
- U6 정산·엔딩: 표시하지 않는다. 원정 뒤 유지되는 자원이 아니기 때문이다.

능력 배지는 기존 직업 라벨 옆의 짧은 인라인 정보로 두고 카드 높이와 3열 배치를
늘리지 않는다. 긴 표시 이름 `치유 기도`는 접근성 이름이나 상세 설명에 사용하고
카드 표기는 `치유`로 줄인다.

U3·U4·U5 adapter가 `battleAbility.kind`와 표시 문구를 각각 해석하지 않는다. 공용의
좁은 View 변환이 `battleAbilityStatus`를 만들고, U3는 계약 시작 총횟수를 현재값으로,
U4는 원정 맵의 현재값을, U5는 replay frame의 현재값을 그 변환에 넘긴다. 능력이 없는
직업에는 세 화면 모두 선택 필드를 만들지 않는다.

## 10. 오류 처리와 불변식

### 10.1 원정 상태 검증

- 능력 보유 파티원은 잔여 횟수 키를 정확히 하나 가진다.
- 능력이 없는 파티원은 잔여 횟수 키를 갖지 않는다.
- 파티에 없는 캐릭터 ID가 맵에 있으면 거부한다.
- 잔여 횟수는 0 이상 `usesPerExpedition` 이하의 안전한 정수다.
- 독립 전투 입력의 `battleAbility.remainingUses`도 같은 범위의 안전한 정수다.
- 일반전·보스전 출력의 잔여 횟수는 입력보다 늘어날 수 없다.
- 전투의 치유 행동 수와 잔여 횟수 감소가 일치해야 한다.

누락된 키를 2로 다시 채우거나 범위 밖 값을 잘라내지 않는다. 캠페인 전이 경계에서는
`INVALID_TRANSITION`, 독립 전투·콘텐츠 생성 경계에서는
`INVALID_GENERATION`으로 실패한다.

### 10.2 행동 기록 검증

U5 replay는 판별된 행동 종류별로 HP 사슬을 검증한다.

- 공격: `after = max(0, before - damage)`와 `defeated` 일치
- 치유: `after = min(maxHp, before + healing)`과 실제 회복량 일치
- 이미 쓰러진 actor·target의 행동 거부
- 치유 actor·target이 파티 쪽이 아니면 거부
- 생존 적이 없는 시점 뒤에 추가된 파티 치유 행동 거부
- 최종 HP와 `BattleResolution.party/enemies` 불일치 거부
- 치유 횟수 표시의 전투 시작값·프레임 감소·최종값 불일치 거부

잘못된 치유 행동을 공격으로 대체하거나 화면에서 무시하지 않는다.

### 10.3 결정성

같은 전투 입력은 행동 종류, 대상, 실제 회복량, 공격 대상 RNG, 라운드 수,
최종 HP와 잔여 횟수까지 같아야 한다. 재생 속도, 다시 보기, 건너뛰기, 화면
재렌더링은 rules 상태를 바꾸지 않는다.

## 11. 파일 소유 경계

구현 계획은 다음 책임을 유지한다.

| 영역 | 책임 |
| --- | --- |
| `lib/domain/character.ts` | 선택적 직업 전투 능력 정의 |
| `lib/content/classes.ts`와 직업 콘텐츠 검증 | 성직자 `치유 기도` 콘텐츠 수치, 실제·주입 직업 정의의 공통 검증 |
| `lib/domain/battle.ts` | 전투원 능력 상태와 공격·치유 행동 유니온 |
| `lib/domain/expedition.ts` | 원정별 잔여 횟수 상태 |
| `lib/rules/battle-engine.ts` | 자동 발동·대상 선택·횟수 소비·행동 기록 |
| 공용 rules 능력 변환 helper | 직업 정의·원정 맵 결합, 사망자 키 보존, 전투 출력 잔여 맵 추출·검증 |
| `lib/rules/expedition-events.ts` | 일반전 능력 입력·출력 어댑터 |
| `lib/rules/boss-battle-adapter.ts` | 보스전 능력 입력·출력과 큐 필터 |
| `lib/rules/campaign-transition.ts` | 초기화·검증·일반전과 보스전 사이 잔여 횟수 전달 |
| `components/game/u5-battle-replay.ts` | 치유 HP 사슬과 프레임별 잔여 횟수 재생 |
| `components/game/U5BattleScene.tsx` | `+N`, 회복 동작, 치유 문구·접근성 |
| `components/game/use-u5-battle-playback.ts` | 새 행동·회복량·잔여 횟수를 포함한 replay identity |
| 공용 파티 카드와 U3/U4/U5 adapter | 공용 능력 상태 View 변환, 화면별 표시와 미래 상태 비노출 |
| `lib/backtest/campaign-driver.ts` | 사라지기 전 전투 결과를 trace로 수집 |
| 나머지 `lib/backtest/*` | 성직자 포함 여부와 치유량·횟수 집계·비교·보고 |

전투 엔진에 `classId === "cleric"` 분기를 넣거나 U5가 HP 50% 조건을 다시 계산하는
구현은 이 경계를 위반한다.

## 12. 테스트 전략

구현은 실패 회귀를 먼저 추가하고 최소 변경으로 통과시킨다.

### 12.1 콘텐츠와 도메인

1. 다섯 직업의 기존 HP·공격력·피격 가중치가 바뀌지 않는다.
2. 성직자만 `emergencyHeal`을 가지며 값이 25·2·50이다.
3. 능력 정의의 빈 이름, 0·음수·비정수 값, 100 초과 발동률과 잘못된 런타임
   `remainingUses`를 모듈 로드·주입 어댑터·독립 전투 경계에서 거부한다.
4. 공격과 치유 행동 타입을 좁히면 각 필드가 정확히 노출된다.

### 12.2 전투 엔진

5. 정확히 50%인 생존자를 치유하고 50% 초과면 공격한다.
6. HP 비율이 가장 낮은 생존자를 고르며 동률이면 파티 입력 순서를 따른다.
7. 성직자 자신도 대상이 될 수 있고 사망자는 대상이 될 수 없다.
8. 치유는 대상 최대 HP의 25%를 반올림한 값 또는 최대 HP까지의 부족분만 회복한다.
9. 치유한 차례에는 공격 행동이 함께 기록되지 않는다.
10. 앞선 파티원이 마지막 적을 쓰러뜨리면 뒤의 성직자가 치유하거나 횟수를 쓰지
    않는다.
11. 한 전투에서 두 번째 치유 기회가 생기고 원정 횟수가 남아 있으면 다시 치유한다.
12. 잔여 횟수 0이면 항상 공격한다.
13. 공격·조언 압력·상인·보스 정보 배율이 대상 최대 HP 기준 치유량을 바꾸지 않는다.
14. 치유 대상 선택이 RNG를 소비하지 않는다.
15. 능력이 없는 전투와 능력이 있으나 미발동한 전투는 변경 전 fixture와 같은 공격
    순서·대상·피해·최종 HP를 낸다.
16. 여러 능력 보유자 fixture에서는 각자의 원정 잔여 횟수만 독립적으로 소비한다.

### 12.3 원정과 어댑터

17. 성직자 포함 원정은 2회로 시작하고 미포함 원정의 잔여 맵은 비어 있다.
18. 일반전 사용 뒤 1회가 다음 일반전과 보스전 입력에 이어진다.
19. 전투 회피는 횟수를 소비하지 않는다.
20. 일반전 두 번 사용 뒤 보스전에서는 치유하지 않는다.
21. 새 원정과 재도전은 다시 2회로 시작한다.
22. 정산과 캠페인 풀에는 잔여 횟수가 남지 않는다.
23. 누락·초과·파티 밖 ID·능력 없는 캐릭터의 잔여 키를 거부한다.
24. 보스 정보 큐가 치유 행동에 붙지 않고 기존 공격 행동에는 같은 위치로 붙는다.

### 12.4 U3·U4·U5

25. U3 계약 상세는 성직자에게 `치유 2회`를 보여주고 다른 직업에는 배지를 만들지
    않는다.
26. U4는 원정 상태의 현재 잔여 횟수를 표시한다.
27. U5 치유 프레임은 `+N`을 보이고 HP와 횟수가 `settle`에서 갱신된다.
28. 치유 대상은 피격 흔들림을 쓰지 않고 성직자는 적에게 돌진하지 않는다.
29. 치유 문장과 스크린 리더 안내가 공격·피해 표현을 사용하지 않는다.
30. U5 우측 카드는 전투 최종 잔여 횟수를 미리 보이지 않는다.
31. 다시 보기에서 우측 HP·신뢰는 최종값을 유지하지만 잔여 횟수만 해당 전투 시작값으로
    돌아가며, 건너뛰기는 최종 횟수를 보여준다.
32. 행동 종류·회복량·잔여 횟수 사슬이 달라지면 replay signature도 달라지고 frame이
    처음으로 초기화된다.
33. FHD 고정 캔버스에서 능력 배지가 파티 카드 높이·3열 배치·스크롤을 늘리지 않는다.
34. 공격·사망·보스 정보·전투 속도와 다시 보기의 기존 HP·신뢰 유지 회귀가 통과한다.

### 12.5 통합과 재현성

35. 같은 캠페인 시드와 같은 선택 순서는 치유 대상·행동·잔여 횟수까지 같은 전체
    원정을 만든다.
36. Store 전체 순회, 캠페인 재현성, 정산, 통계, 이력 테스트가 새 행동 유니온을
    소비한다.
37. 백테스트 driver가 일반전 `pendingOutcome.battle`과 보스전 `bossResult.battle`을
    사라지기 전에 한 번만 수집하고, 같은 시드·전략·정확도끼리 전후 결과를 짝짓는다.
38. lint, typecheck, unit test, 캠페인 브라우저 smoke와 CI production build가 통과한다.

## 13. 백테스트와 중단 조건

이번 변경은 성직자 수치 calibration을 동시에 수행하지 않는다. 구현 전 현재
`b1-risk-curve-v2` 기준선을 보존하고 같은 전략·정확도·시드 집합으로 구현 전후를
비교한다.

실행 순서는 조합당 50·100·200 시드다. 2,000 시드 holdout은 기존 B1 정책대로
별도 승인 전에는 실행하지 않는다.

### 13.1 수집 경계와 전후 비교

백테스트는 UI replay나 정산 문장을 다시 해석하지 않는다. 실제 Store driver가 캠페인
전이 직후의 확정된 전투 결과를 다음 시점에 한 번만 trace로 옮긴다.

- 일반 몬스터전: `CHOOSE_ADVICE` 직후 아직 존재하는 `pendingOutcome.battle`
- 보스전: `ENTER_BOSS` 직후 `bossResult.battle`
- 회피·비전투 사건: 전투 trace를 만들지 않음

일반전 `pendingOutcome`은 `ACKNOWLEDGE_OUTCOME` 뒤 사라지고 영구 `ExpeditionRecord`에는
전체 action이 남지 않는다. 계측을 위해 `BattleResolution` 전체를 캠페인 이력,
정산 snapshot, `Character`, `ExpeditionState`에 새로 영구 보존하지 않는다. driver의
원정 trace가 파티 캐릭터·직업 구성, 전투 종류, 라운드, 종료 사유, 전투 전후 생존·HP,
치유 행동 수와 실제 회복량을 보유하고 집계 계층이 이를 소비한다.

구현 전후 비교는 같은 `seed × strategy × accuracy`를 안정 키로 짝지은 paired 비교다.
기준선과 변경 결과가 서로 다른 시드 집합이나 전략 순서를 사용하면 비교 결과로 승인하지
않는다. 50·100·200 각 단계의 원본 설정, revision, 조합별 seed 수와 구조적 gate 결과를
보고서에 함께 남긴다.

실행 안에서는 `expeditionId × 전투 종류 × 같은 종류의 원정 내 순번`으로 전투를 다시
짝짓는다. 성직자 포함·미포함 층은 캠페인 전체가 아니라 이렇게 짝지은 각 전투의 원정
파티로 판정한다. 따라서 한 캠페인에서 성직자 포함 원정과 미포함 원정을 모두 수행했으면
두 층 모두에 독립적인 전투 근거가 남는다.
전후 짝의 성직자 포함 여부가 서로 다르면 어느 주층에도 섞지 않고 `구성 변경` 층으로
분리해, 성직자 포함·미포함 delta의 분모가 같은 원정 구성끼리만 비교되게 한다.

snapshot은 승패·종료 사유·라운드·전후 HP와 함께 확정 행동을 보존한다. 구현 전 공격
행동의 암묵적 형태와 구현 후 `kind: "attack"` 형태는 같은 판별 행동으로 정규화한 뒤
비교한다. 능력 미보유·미발동 control의 불변 판정은 치유 행동 수가 0이라는 사실만 세지
않고, 짝지은 전투의 정규화된 결과와 행동이 모두 같을 때만 통과한다.
한 실행에서 첫 치유가 발생한 뒤의 전투는 앞선 치유가 캠페인 상태에 미친 간접 효과를
포함하므로 직접 불변 control에서는 제외하되, 성직자 유무별 paired 효과 층에는 해당
원정 구성대로 계속 포함한다.

### 13.2 추가 측정값

- 성직자 포함 원정 수와 미포함 원정 수
- 성직자 포함 일반전·보스전 수
- 원정당 치유 사용 횟수 분포 0·1·2
- 전투당 치유 사용 횟수 분포 0·1·2
- 총 치유 행동 수와 실제 총 회복량
- 성직자 포함 여부별 첫 시도 클리어율과 위험도별 클리어율
- 성직자 포함 여부별 보스 진입 HP 비율, 보스 사망자 수, 전체 사망자 수
- 평균 전투 라운드와 `roundLimit` 발생 수
- 정상 완주율과 엔딩 분포
- 기존 조언 정확도와 생존·기회주의·선별적 배신 전략의 상대 결과

### 13.3 강제 무결성 gate

다음은 수치 취향과 무관한 구현 실패다.

- 한 원정에서 같은 성직자가 2회를 초과해 치유함
- 한 전투에서 같은 성직자가 원정 잔여 횟수를 초과해 치유함
- 명목 회복량이 대상 최대 HP의 25% 반올림 값과 다르거나 실제 HP가 최대 HP를 초과함
- 생존 적이 없는 승리 뒤 치유함
- 사망자를 치유하거나 치유와 공격을 같은 차례에 수행함
- 잔여 횟수가 증가하거나 전투 행동 수와 감소량이 다름
- 능력 미보유·미발동 기준 fixture의 전투 수치 결과가 달라짐
- 재현성 불일치, 실행 오류, 유효하지 않은 상태, `roundLimit` 발생

하나라도 발생하면 구현을 수정하고 다시 측정한다.

### 13.4 밸런스 판정

현재 공식 B1 보고서에는 완주율·위험도 곡선 등 이미 승인된 관측 부채가 있다.
따라서 기존 실패 gate가 그대로 남았다는 이유만으로 이번 구현을 실패로 돌리거나,
성직자 수치를 이용해 그 부채를 몰래 보정하지 않는다.

200 시드 결과에서는 구현 전후 차이와 성직자 포함·미포함 층을 함께 보고한다.
완주율, 사망, 보스 진입 HP, 첫 시도 클리어율, 평균 라운드에 의미 있는 변화가
나오면 25·2·50이나 보스·몬스터·휴식·다른 직업 수치를 자동으로 바꾸지 않는다.
측정 결과와 조정 후보를 사용자에게 다시 제시하고 별도 승인을 받는다.

## 14. 공식 문서 동기화

Spec 승인 뒤 구현과 같은 변경 단위에서 다음 공식 문서를 갱신한다.

- `docs/systems/CHARACTERS_AND_TRUST.md`: 성직자의 `치유 기도`, 원정당 2회,
  전투당 별도 횟수 상한을 두지 않음, 50% 이하 최저 비율 대상, 최대 HP 25% 회복과 공격 포기 규칙
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`: 자동 전투의 공격·치유 행동,
  원정 잔여 횟수 전달, 치유 replay와 HP·횟수 동기화 계약
- `docs/README.md`: 이 설계와 이후 구현 계획 링크
- `docs/technical/BACKTEST_REPORT.md`: 구현 전후 50·100·200 시드 결과와 새 치유 지표

`docs/GAME_PRINCIPLES.md`는 수정하지 않는다. 플레이어 직접 전투 조작을 추가하지
않고 기존 자동 전투의 직업 행동만 확장하므로 최상위 원칙 변경이 아니다.

## 15. 승인 기준

다음이 모두 성립하면 이 설계의 구현이 완료된 것으로 본다.

- 성직자가 조건부 자동 치유로 실제 직업 역할을 수행한다.
- 현재 생산 파티에서 한 성직자는 원정당 최대 2회 치유하며, 같은 전투에서도 두 번
  모두 사용할 수 있다.
- 각 치유의 명목 회복량은 대상 최대 HP의 25%를 반올림한 값이다.
- 치유는 반드시 공격 한 번을 대신하고 승리 뒤 치유·부활·전투 밖 회복을 만들지
  않는다.
- 일반전과 보스전이 같은 잔여 횟수를 소비한다.
- 전투 로그·U5 재생·우측 파티 상태가 공격과 치유를 구분하고 같은 시점에 갱신된다.
- 성직자 미포함·치유 미발동 경로의 기존 결정성이 보존된다.
- 구조적 테스트와 50·100·200 시드 비교 결과가 기록된다.
- 밸런스 수치 변경이 필요하면 이번 구현에 몰래 포함하지 않고 별도 승인을 받는다.
