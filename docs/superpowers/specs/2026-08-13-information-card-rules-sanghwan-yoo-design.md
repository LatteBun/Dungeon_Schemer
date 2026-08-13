# R3 정보 카드 판정 설계서

- 작성일: 2026-08-13
- 작성자: SangHwan Yoo
- 작성 도구: Codex
- 작업: R3 정보 카드 판정과 R2 연계 확장
- 상태: 승인됨

## 1. 목표와 완료 기준

카드 3장은 Q1/U2가 제시하고 플레이어가 그중 1장을 선택한다. R3는 플레이어가 선택한
카드 한 장만 받아 살아 있는 모든 파티원에게 전달한다.

이미 선택된 `InfoCard` 한 장에 대해, 파티 또는 보스가 보이는 반응을 재현 가능하게
판정한다. R3 완료 기준인 대상(용사·보스) × 유형(진실·거짓·중립)의 수용·의심·적발,
즉시 신뢰 변화, 미검증·의심 검증 플래그를 순수 규칙 함수의 반환값으로 제공한다.

R3는 카드 3장 생성·선택, Zustand 상태 변경, `InfoClaim` 식별자·시점 생성, 로그·UI,
보스전과 종료 처리를 맡지 않는다. 이들은 각각 Q1/U2/P1/P2의 책임이다.

## 2. 대상과 반응

### 2.1 대상 범위

- 대상은 R3 전용 `InfoAudience`인 `"party" | "boss"`로 구분한다. 기존 `Target`은
  이후 `InfoClaim`에 사용할 개별 파티원 또는 보스 식별자이므로 확장하지 않는다.
- `"party"`는 살아 있는 모든 `PartyMember`를 입력 순서대로 판정한다. 구성원마다
  신뢰도·성격 보정과 난수 판정이 독립적이므로 혼합 결과가 정상이다.
- `"boss"`는 보스 하나를 판정한다. 보스의 성격·신뢰도는 아직 모델링하지 않아 기본
  확률만 사용한다.
- `alive: false`인 파티원은 결과 배열에 넣지 않는다. 신뢰도 0인 살아 있는 파티원은
  저신뢰 구간으로 반응을 판정하고, R2의 정체 발각 결과는 그대로 반환한다. 종료 여부는
  P2가 결정한다.

### 2.2 반응과 후속 상태

`InfoReaction`은 `"accepted" | "suspected" | "exposed"`이다.

| 카드 유형 | 가능한 반응 | 즉시 R2 신뢰 판정 | 후속 기록 |
| --- | --- | --- | --- |
| 진실 | 수용, 의심 | 수용 시 `actHonestly` | 의심 시 사후 검증 |
| 중립 | 수용, 의심 | 없음 | 의심 시 사후 검증 |
| 거짓 | 수용, 의심, 적발 | 수용 시 `deceptionAccepted`, 적발 시 `deceptionExposed` | 수용 시 미검증, 의심 시 사후 검증 |

여기서 반응 `exposed`는 **카드의 거짓이 적발되었다**는 뜻이다. R2의
`TrustEvaluation.exposed`는 **해당 파티원의 신뢰가 0에 도달했거나 이미 0**이라는
별도 상태이므로, 둘을 같은 의미로 합치지 않는다.

`accepted`인 거짓은 즉시 `deceptionAccepted`로 신뢰가 오르고 `pendingVerification`이
`true`가 된다. P1은 파티원마다 별개의 `InfoClaim`을 만든다. 이후 거짓으로 검증되면
`deceptionExposed`를 적용해 신뢰를 다시 내린다.

`suspected`는 즉시 신뢰가 변하지 않고 카드 효과도 적용되지 않는다. 대신
`pendingSuspicionEvaluation`이 `true`가 된다. P1은 의심한 파티원마다 별도의 의심
검증 기록을 만들고, P2가 보스전 결과와 연결한다. 의심으로 파티가 손해를 보면
`suspicionWasCostly`로 신뢰를 올리고, 이득을 보면 `suspicionWasCorrect`로 신뢰를
내리며, 원인이 불분명하면 변화가 없다.

R3는 상태를 직접 바꾸지 않으며 `ClaimId`, 의심 기록 식별자, `toldAt`, 게임 오버를
만들지 않는다.

## 3. 확률 규칙

### 3.1 기본 확률

| 카드 유형 | 기본 수용 | 기본 적발 |
| --- | ---: | ---: |
| 진실 | 70 | 0 |
| 중립 | 55 | 0 |
| 거짓 | 45 | 15 |

진실과 중립의 남은 확률은 의심이다. 거짓은 적발 구간을 먼저, 수용 구간을 다음으로
확인하고 나머지를 의심으로 처리한다.

### 3.2 파티 보정

| 조건 | 수용 보정 | 거짓 적발 보정 |
| --- | ---: | ---: |
| 신뢰 0~33 | -20 | +15 |
| 신뢰 34~66 | 0 | 0 |
| 신뢰 67~100 | +15 | -10 |
| 의심 많은 성격 | -20 | +20 |
| 정의로운 성격 | 진실 +15, 거짓 -10, 중립 0 | +15 |
| 탐욕스러운 성격 | +10 | -5 |
| 신중한 성격 | -10 | +10 |
| 충동적 성격 | +15 | -10 |

보스에는 보정을 적용하지 않는다.

### 3.3 경계와 굴림

- 진실·중립의 수용률: 기본값과 수용 보정 합을 5~95로 제한한다.
- 거짓의 적발률: 기본값과 적발 보정 합을 5~80으로 제한한다.
- 거짓의 수용률: 기본값과 수용 보정 합을 5 이상, `95 - 적발률` 이하로 제한한다.
  따라서 의심은 최소 5% 남고, 수용·적발이 100%가 될 수 없다.
- `cardRng.int(1, 100)`을 대상마다 한 번 사용한다. 거짓은 `roll <= 적발률`이면 적발,
  다음 `roll <= 적발률 + 수용률`이면 수용, 그 외에는 의심이다.
- 파티를 입력 순서대로 순회한다. 신뢰 변화가 발생한 개별 결과만 `trustRng`을 R2에
  전달하므로, 같은 시드·입력·난수 스트림이면 완전히 재현된다.

## 4. 공개 규칙 계약

구현 파일은 `lib/rules/info.ts`, 테스트 파일은 `lib/rules/info.test.ts`로 둔다.
함수는 입력을 변경하지 않고 새 결과만 반환한다.

~~~ts
export type InfoAudience = "party" | "boss";
export type InfoReaction = "accepted" | "suspected" | "exposed";

export interface MemberInfoCardResult {
  readonly member: PartyMember;
  readonly reaction: InfoReaction;
  readonly trustEvaluation: TrustEvaluation | null;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
}

export interface PartyInfoCardEvaluation {
  readonly audience: "party";
  readonly memberResults: readonly MemberInfoCardResult[];
}

export interface BossInfoCardEvaluation {
  readonly audience: "boss";
  readonly reaction: InfoReaction;
  readonly pendingVerification: boolean;
  readonly pendingSuspicionEvaluation: boolean;
}

export type InfoCardEvaluation =
  | PartyInfoCardEvaluation
  | BossInfoCardEvaluation;

export interface PartyInfoCardOptions {
  readonly audience: "party";
  readonly card: InfoCard;
  readonly party: readonly PartyMember[];
  readonly cardRng: Rng;
  readonly trustRng: Rng;
}

export interface BossInfoCardOptions {
  readonly audience: "boss";
  readonly card: InfoCard;
  readonly cardRng: Rng;
}

export function evaluateInfoCard(
  options: PartyInfoCardOptions | BossInfoCardOptions,
): InfoCardEvaluation;
~~~

파티 결과의 `member`는 R2를 호출한 경우 그 반환값의 갱신된 파티원이고, 그렇지 않은
경우에는 입력 파티원을 값 변경 없이 반영한다. `pendingVerification`은 수용된 거짓,
`pendingSuspicionEvaluation`은 의심된 정보에만 `true`다. 보스 결과에는 신뢰 판정이
없으므로 `TrustEvaluation`을 넣지 않는다.

## 5. 난수와 의존성

- 카드 반응에는 `card` 스트림, R2의 신뢰 변화량에는 `trust` 스트림만 사용한다.
- `Math.random`, `createRng` 직접 생성, Zustand 접근, 시간 접근을 하지 않는다.
- `evaluateTrust`를 직접 호출해 기존 성격별 신뢰 변화 이유·범위·정체 발각 규칙을
  그대로 재사용한다.
- `InfoClaim`과 `RunState.pendingClaims`는 수용된 거짓을 기록하는 데 사용한다. P1이
  `pendingVerification`을 소비해 파티원별 개별 기록을 생성한다.
- 의심 결과는 `InfoClaim`과 별도의 의심 검증 기록으로 보관한다. P1이
  `pendingSuspicionEvaluation`을 소비하고, P2가 실제 결과와 연결한다.
- R2에는 `deceptionAccepted`, `suspicionWasCostly`, `suspicionWasCorrect` 행동이
  R3 구현 전에 추가되어야 한다. 세 행동의 성격별 수치는 R2 확장 작업에서 정한다.

## 6. 테스트 명세

- 같은 카드·입력·각 난수 스트림이면 같은 결과가 나오는지 검증한다.
- 파티/보스 × 진실·중립·거짓의 모든 조합에서 허용된 반응과 플래그를 검증한다.
- 파티 구성원별 성격·신뢰에 따라 한 카드에서 혼합 결과가 가능한지 검증한다.
- 진실·중립은 카드 적발을 만들지 않고, 거짓은 수용·의심·적발 모두 낼 수 있는지
  경계 난수로 검증한다.
- 진실 수용은 `actHonestly`, 거짓 수용은 `deceptionAccepted`, 거짓 적발은
  `deceptionExposed`의 실제 R2 결과를 반환하는지 검증한다.
- 중립 수용과 모든 의심은 즉시 신뢰 판정이 없고, 의심은 카드 효과를 적용하지 않는지
  검증한다.
- 거짓 수용한 파티원 각각에 미검증 플래그가, 의심한 파티원 각각에 의심 검증 플래그가
  생기는지 검증한다.
- 의심해서 손해를 본 경우 신뢰가 오르고, 이득을 본 경우 신뢰가 내리며, 불명확한
  경우 변화가 없는지 검증한다.
- 사망 파티원이 제외되고, 입력 배열·입력 파티원이 바뀌지 않는지 검증한다.
- 확률 하한·상한과 거짓의 최소 의심 구간을 검증한다.

## 7. 비범위와 후속 연결

- Q1: 상황별 카드 풀과 카드 세 장 제시 규칙
- P1: R3 결과로 `InfoClaim`·로그·런 상태를 갱신하는 흐름
- P2: 미검증 정보·의심 결과 검증, 전투 효과, 신뢰 0의 승패·처형·게임 종료
- U2: 선택 전 위험과 선택 후 대상별 반응 표시

R3는 위 작업들이 연결할 수 있는 최소한의 순수 규칙 계약만 제공한다.


## 8. 개발 테스트 하네스

R3 구현을 직접 확인할 수 있도록 개발용 테스트 페이지 두 개를 제공한다.

- `/r3-test`는 진실·거짓·중립 카드 3장을 동시에 보여주고, 대상(파티·보스)·카드·seed를 선택해 반응, 즉시 신뢰 변화, 미검증·의심 검증 플래그를 표시한다.
- `/integration-test`는 같은 seed로 R1 파티 생성, R2 선택 행동, R3 정보 카드 판정, R4 던전 생성을 한 화면에서 재현한다. F2 `RunState` 스냅샷도 함께 표시한다.
- 두 페이지는 실제 런 상태나 Zustand 전역 상태를 변경하지 않는 순수 검증 도구다. 현재 범위 밖인 P1/P2/R5는 미구현 상태로 명시하고, 기존 `/state-preview` 링크를 제공한다.
- seed 입력과 버튼 조작은 브라우저에서 확인할 수 있어야 하며, 같은 seed와 같은 선택은 같은 결과를 보여야 한다.
