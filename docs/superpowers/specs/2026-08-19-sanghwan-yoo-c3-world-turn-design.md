# C3 월드턴 규칙 설계

## 문서 상태

- 상태: 설계 승인됨
- 작성자: sanghwan.yoo
- 작성 도구: Codex
- 근거: `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`,
  `docs/systems/CHARACTER_POOL_AND_WORLDTURN.md`,
  `docs/systems/CHARACTERS_AND_TRUST.md`

## 1. 목적과 범위

C3는 플레이어 원정이 끝난 뒤 비출전 캐릭터를 월드턴에 배정하고, 휴식·백그라운드 원정·중상 상태를 순수 규칙으로 처리한다. 실행 결과는 다음 월드턴에서 사용할 갱신된 `CharacterPool`과 화면·로그가 사용할 `WorldTurnResult`로 나눈다.

이번 작업의 범위는 다음과 같다.

- 비출전 생존 캐릭터 선별
- HP에 따른 강제 휴식과 중상 캐릭터의 휴식 고정
- 나머지 캐릭터의 시드 기반 휴식·백그라운드 절반 배정
- 휴식과 백그라운드의 HP·골드 변화
- 중상 상태의 생성·해제
- 월드턴 입력과 캐릭터 풀 불변식 검증
- `worldturn` 난수 스트림 계약 정합성 수정

다음은 범위 밖이다.

- 플레이어 원정 파티를 만드는 C2
- 정산·보상·위험도 상승을 처리하는 C4
- 엔딩을 판정하는 C7
- 화면·스토어·상태 전이
- 백그라운드 원정의 전투 장면

C3는 모든 생존자가 중상이어도 엔딩을 직접 판정하지 않는다. 월드턴에서 회복을 처리한 뒤, 출전 가능한 서로 다른 직업 3명을 만들 수 없는지는 C7의 `인력 소진` 판정이 담당한다.

## 2. 공개 API

`lib/domain/worldturn.ts`에 다음 결과 타입과 함수를 둔다.

```ts
export interface WorldTurnExecution {
  pool: CharacterPool;
  result: WorldTurnResult;
}

export function runWorldTurn(
  pool: CharacterPool,
  expeditionParty: ExpeditionParty,
  worldTurn: number,
  worldturnRng: Rng,
): WorldTurnExecution;
```

`worldturnRng`는 호출부가 `createRng(seed).derive("worldturn")`로 만들어 전달한다. C3 함수 내부에서 `createRng`를 호출하거나 원본 풀을 변경하지 않는다.

입력 `worldTurn`은 실행 전 캠페인 월드턴 번호다. 실행 성공 시 `result.worldTurn`에는 `worldTurn + 1`을 기록한다. 입력은 0 이상의 정수여야 한다.

## 3. 처리 흐름과 함수 경계

공개 함수는 오케스트레이터로만 사용하고, 규칙의 각 책임은 내부 순수 함수로 분리한다.

```text
runWorldTurn
├─ validateWorldTurnInput
├─ selectWorldTurnAssignments
│  ├─ selectNonPartySurvivors
│  ├─ assignRestForWoundedOrLowHp
│  └─ assignRestOrBackground
├─ applyWorldTurnAssignment
│  ├─ applyRest
│  ├─ applyBackground
│  └─ updateGravelyWounded
└─ buildWorldTurnResult
```

하위 함수는 외부 API로 노출하지 않는다. 테스트는 `runWorldTurn`의 공개 계약을 통해 검증하되, 계산이 과도하게 뭉치면 모듈 내부 순수 함수로 분리한다.

처리 대상은 `pool.order`를 기준으로 순회한다.

1. `expeditionParty.memberIds`에 포함된 캐릭터를 제외한다.
2. `alive === false`인 캐릭터를 제외한다. 사망자는 월드턴 활동이나 결과를 갖지 않는다.
3. 이미 `gravelyWounded === true`인 캐릭터는 `rest`로 고정한다.
4. 중상이 아니면서 `hp / maxHp < 0.5`인 캐릭터는 `forcedRest`로 고정한다.
5. 나머지를 `worldturnRng.shuffle`로 섞고, 앞의 `ceil(n / 2)`명을 `rest`, 나머지를 `background`로 배정한다.
6. 상태를 계산한 뒤 결과를 원래 `pool.order` 순서로 정렬한다. 배정의 무작위성과 화면·로그 순서를 분리한다.

이미 중상인 캐릭터가 HP 50% 미만이어도 `rest`가 우선한다. `forcedRest`는 중상이 아닌 캐릭터가 현재 HP 때문에 이번 턴에 강제로 쉬는 활동이다.

## 4. 규칙 수치와 경계

모든 HP 관련 값은 정수다. 부동소수점 비율은 판정과 반올림에만 사용하고, 캐릭터 상태와 결과의 HP 변화량에는 정수를 기록한다.

### 4-1. 강제 휴식

- 조건: 처리 시작 시 `hp / maxHp < 0.5`
- 정확히 50%는 강제 휴식이 아니다.
- 중상이 아니면 `forcedRest` 활동을 받는다.
- 회복량은 `max(2, round(maxHp × 0.15))`다.
- 결과 HP는 `min(maxHp, hp + recovery)`다.
- 골드는 변하지 않는다.

강제 휴식 자체는 중상을 의미하지 않는다. 예를 들어 HP가 40%인 캐릭터가 휴식 후 20% 이상이면 중상이 되지 않고 다음 원정에 참여할 수 있다.

### 4-2. 일반 휴식

- 대상: 이미 중상인 캐릭터 또는 절반 배정에서 휴식을 받은 캐릭터
- 회복량과 HP 상한은 강제 휴식과 같다.
- 골드는 변하지 않는다.
- 처리 후 HP가 `maxHp × 0.2` 이상이면 `gravelyWounded`를 해제한다.

### 4-3. 백그라운드 원정

- 대상: 중상이 아니고 HP가 50% 이상인 캐릭터 중 절반 배정에서 선택된 인원
- `lossPercent = worldturnRng.int(10, 20)`
- `hpLoss = max(1, round(maxHp × lossPercent / 100))`
- `hp = max(1, hp - hpLoss)`
- `goldDelta = worldturnRng.int(5, 15)`
- 백그라운드에서 사망하지 않는다.
- 처리 후 HP가 `maxHp × 0.2` 미만이면 `gravelyWounded = true`다.

정확히 20%는 중상이 아니다. 백그라운드에서 HP가 20% 미만이 되더라도 HP는 1에서 멈춘다.

### 4-4. 중상 상태

- 중상은 `hp / maxHp < 0.2`인 상태를 나타내는 플래그다.
- 처리 후 처음 `false → true`가 된 경우에만 `becameGravelyWounded`를 `true`로 기록한다.
- 이미 중상이었던 캐릭터가 계속 중상이면 `becameGravelyWounded`는 `false`다.
- 이미 중상인 캐릭터는 다음 월드턴 처리에서 백그라운드에 배정되지 않는다.
- 휴식 후 HP가 20% 이상이면 중상을 해제하고 이후 월드턴부터 출전 가능 후보가 될 수 있다.

중상 캐릭터가 모두 회복되지 않아 출전 가능한 캐릭터로 서로 다른 직업 3명을 편성할 수 없으면, 월드턴 함수가 아니라 C7이 `인력 소진` 엔딩을 판정한다.

## 5. 결과 계약

각 처리 대상에는 다음 결과를 남긴다.

- `characterId`
- 실제 활동(`forcedRest`, `rest`, `background`)
- 실제 적용된 `hpDelta`
- 실제 적용된 `goldDelta`
- 이번 턴에 새로 중상이 되었는지
- 화면이 임의로 조합하지 않아도 되는 사람이 읽을 수 있는 `reason`

`hpDelta`는 반올림 전 값이 아니라 실제 상태에 적용된 차이다. 회복이 `maxHp` 상한에 걸리거나 백그라운드 HP가 1 하한에 걸리면 그 제한을 반영한다.

사유는 규칙이 생성한다. 최소한 활동, 회복·손실, 골드 변화, 중상 생성·해제 여부를 설명할 수 있어야 한다. UI는 수치를 다시 계산하지 않는다.

## 6. 입력 검증과 오류

`runWorldTurn`은 상태를 조용히 보정하지 않고 `RuleError`를 던진다.

### `INVALID_STATE`

다음 입력은 `INVALID_STATE`다.

- `worldTurn`이 0 이상의 정수가 아님
- `pool.order`에 중복 ID가 있음
- `pool.order`에 있지만 `byId`에 없는 ID가 있음
- `byId`에 있지만 `pool.order`에 없는 ID가 있음
- `byId`의 키와 캐릭터의 `id`가 다름
- `maxHp`가 양의 정수가 아님
- `hp`가 정수가 아니거나 `1..maxHp` 밖임
- `gold`가 0 이상의 정수가 아님
- `trust`가 정수가 아니거나 `0..100` 밖임

입력 캐릭터의 `gravelyWounded`와 HP 비율이 일시적으로 어긋난 경우는 거부하지 않는다. 원정 직후 상태를 다음 월드턴에서 처리하며, C3가 활동 후 중상 플래그를 확정하기 때문이다. 단, 중상 플래그가 참인 캐릭터는 활동 선택에서 휴식만 허용한다.

### `UNKNOWN_ID`

원정 파티가 `pool.byId`에 없는 캐릭터 ID를 포함하면 `UNKNOWN_ID`다.

### `DUPLICATE_ID`

원정 파티에 같은 캐릭터 ID가 두 번 이상 있으면 `DUPLICATE_ID`다.

파티 인원이 3명인지, 파티원이 생존했는지, 파티원이 중상인지 여부는 C2와 원정 결과의 책임이다. C3는 파티 ID를 제외할 뿐 이 조건을 다시 판정하지 않는다.

## 7. 재현성과 RNG 정합성

공식 스트림은 다음 10개로 통일한다.

```text
pool, board, party, map, ecology, card, event, boss, trust, worldturn
```

`lib/rng/index.ts`의 이전 `reserve`, `carriedGold`, `regroup` 스트림을 제거하고 `worldturn`을 추가한다. 스트림 배열 테스트도 이 계약을 고정한다. C3는 전달받은 `worldturnRng` 외의 난수를 소비하지 않는다.

같은 풀, 같은 원정 파티, 같은 월드턴 번호, 같은 `worldturnRng` 시드라면 배정·수치·결과 사유가 같다. 휴식·백그라운드의 호출 횟수 변경이 다른 시스템의 스트림 결과를 바꾸지 않도록 C3는 독립 스트림만 소비한다.

## 8. 테스트 계획

`lib/domain/worldturn.test.ts`를 추가한다.

### 정상 흐름

- 비출전 생존자만 처리되고 원정 파티원은 그대로 유지된다.
- 사망자는 결과에 포함되지 않는다.
- HP 40% 캐릭터는 `forcedRest`를 받고 중상이 되지 않을 수 있다.
- HP 정확히 50% 캐릭터는 강제 휴식 대상이 아니다.
- 이미 중상인 캐릭터는 HP와 무관하게 `rest`만 받는다.
- 절반 배정은 짝수에서 정확히 반씩, 홀수에서 휴식이 하나 더 많다.
- 백그라운드 HP 손실은 정수 10~20% 반올림 범위다.
- 백그라운드 골드는 정수 5~15 범위다.
- 백그라운드 HP는 1에서 멈추고 사망하지 않는다.
- 처리 후 HP가 정확히 20%면 중상이 아니다.
- 처리 후 HP가 20% 미만이면 새 중상으로 기록된다.
- 중상 휴식 후 HP가 20% 이상이면 플래그가 해제된다.
- 모든 생존자가 중상이어도 C3는 엔딩을 만들지 않고 결과를 반환한다.

### 재현성과 불변성

- 같은 시드의 두 실행 결과가 같다.
- 결과 순서는 `pool.order`와 같다.
- 입력 풀과 파티 입력은 실행 뒤 변경되지 않는다.
- RNG 스트림 배열이 공식 10개와 정확히 같다.

### 검증 실패

- 음수·소수 월드턴
- 중복·누락·불일치 풀 ID
- 잘못된 `maxHp`, `hp`, `gold`, `trust`
- 알 수 없는 파티 ID
- 중복 파티 ID

## 9. 변경 파일과 완료 처리

구현 시 다음 파일을 변경한다.

- `lib/domain/worldturn.ts`: 공개 실행 함수, 반환 타입, 내부 규칙 함수
- `lib/domain/index.ts`: 새 타입과 함수 export
- `lib/domain/errors.ts`: `INVALID_STATE` 추가
- `lib/domain/errors.test.ts`: 새 오류 코드 계약
- `lib/rng/index.ts`: 공식 스트림 10개 정합성
- `lib/rng/streams.test.ts`: 스트림 목록 기대값 갱신
- `lib/domain/worldturn.test.ts`: C3 테스트
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md`: C3 완료 후 상태를 `✅`로 바꾸고 C7의 직접 선행에서 C3 제거

검증은 `typecheck`, 전체 `test`, `lint`, `build` 순으로 실행한다. 브라우저 검증은 C3 자체의 범위가 아니며 I2/Q1에서 수행한다.
