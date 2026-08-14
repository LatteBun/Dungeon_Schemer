# C1 캠페인 초기화·게시판 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-14
> 작성자: SangHwan Yoo
> 작성 도구: Codex

## 목적

C1은 F1이 정의한 `CampaignState`를 결정적인 첫 캠페인 상태로 채우고,
현재 캠페인에서 선택할 수 있는 던전 공고를 생성한다. 플레이어가 첫
게시판에서 비교할 수 있도록 던전 15개, 완성 파티 15팀, 예비 인원 6명을
시드로 만들고, 남은 던전과 완성 파티를 최대 5개의 공고로 연결한다.

이 문서는 C1의 순수 규칙 경계와 C3 동료가 이어서 사용할 계약을 고정한다.
정산·승급·엔딩의 상태 전이는 C1에서 구현하지 않는다.

## 근거와 우선순위

다음 문서를 기준으로 삼는다.

1. [게임 원칙](../../GAME_PRINCIPLES.md)
2. [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
3. [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)
4. [파티와 신뢰](../../systems/PARTY_AND_TRUST.md)
5. [프로토타입 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)
6. [게임 방향 개편 상위 설계](2026-08-13-sanghwan-yoo-game-direction-rework-design.md)

문서가 충돌하면 `GAME_PRINCIPLES.md`, 공식 `design`·`systems`, 이 문서,
과거 plan 순으로 해석한다. C3 동료의 작업과 겹치는 판단은 이 문서에서
새로 정의하지 않고 인터페이스만 제공한다.

## 범위

### 포함

- `initializeCampaign(seed)`로 첫 `CampaignState` 생성
- C 6개, B 4개, A 3개, S 2개의 던전 생성
- 던전별 고정 ID, 초기 등급, 현재 등급, 시드 기반 같은 등급 정렬 키
- 서로 다른 직업·성격을 가진 3인 완성 파티 15팀 생성
- 직업·성격·초기 신뢰가 생성된 예비 인원 6명 생성
- 인물별 HP, 신뢰, 소지 골드, 생존 여부, 빈 기억 목록 초기화
- 초기 캠페인 자원과 첫 게시판 생성
- `generateBoard(state)`의 등급 정렬, 최대 5개 제한, 파티 연결
- 명성 부족 공고의 표시·잠금과 지원 가능 여부 판정
- 동일 시드·동일 상태의 결과 재현성과 입력 불변성 테스트

### 제외

- C2의 충원·자동 재편·비출전 회복
- C3의 계약 실행, 정산, 명성·골드 갱신, 승급, 엔딩 전이
- E1~E3의 지도·정보·사건·보스 계산
- F2 콘텐츠 정의와 사건·카드·아이템 효과 계산
- Zustand 스토어, 화면, 라우트, 브라우저 검증
- 저장·복원, 서버, 로그인, Supabase 연동
- `docs/any-ideas/`와 `docs/initialization/` 원본 자료 수정

`createBoardEnding`은 게시판에서 더 진행할 수 없는 후보를 계산할 뿐이다.
`CampaignEnding`을 만들거나 `phase: "ended"`로 전환하는 책임은 C3 또는
통합 상태 머신에 남긴다.

## 설계 선택

C1은 초기화와 게시판을 독립된 순수 규칙 모듈로 나눈다.

- `campaign-init.ts`는 시드 스트림을 소비해 새 상태를 만든다.
- `board.ts`는 상태를 읽어 공고 배열과 지원 가능 여부를 계산한다.
- 두 모듈은 Zustand나 React를 import하지 않는다.
- 같은 상태로 게시판을 다시 계산해도 난수 소비 순서나 결과가 변하지 않는다.
- 기존 `initial-run.ts`의 단일 탐험 상태는 C1 factory의 내부 구현에 직접
  결합하지 않는다. 호환 adapter가 필요하면 별도 작업으로 둔다.

이 경계는 C3가 정산 결과를 `CampaignState`에 반영한 뒤 같은
`generateBoard`를 호출할 수 있게 하며, C1이 C3의 규칙을 복제하는 것을
막는다.

## 캠페인 초기화 계약

### 공개 함수

```ts
initializeCampaign(seed: string): CampaignState
```

함수는 입력 시드 외의 전역 상태나 현재 시간에 의존하지 않는다. 반환 상태는
새로운 중첩 배열과 객체를 가지며 호출 간 참조를 공유하지 않는다.

### 초기 상태

| 필드 | 값 |
| --- | --- |
| `seed` | 입력 시드 |
| `phase` | `"board"` |
| `rank` | `"C"` |
| `currentReputation` | `0` |
| `currentGold` | `10` |
| `cumulativeGold` | `0` |
| `dungeons` | 15개 |
| `parties` | 완성 파티 15팀 |
| `reserveMemberIds` | 6명 |
| `waitingMemberIds` | 빈 배열 |
| `expedition` | `null` |
| `ending` | `null` |
| `log` | 빈 배열 |
| `board` | 초기 상태에 대해 `generateBoard`로 만든 결과 |

시작 골드 10은 플레이로 얻은 수입이 아니므로 `cumulativeGold`에 포함하지
않는다.

### 던전 생성

`lib/content/dungeons.ts`에 C1이 사용하는 등급별 기본값을 둔다.

| 등급 | 수량 | 지원 최소 명성 | 3명 생존 명성 | 3명 생존 골드 | 지도 지점 |
| --- | ---: | ---: | ---: | ---: | ---: |
| C | 6 | 0 | 10 | 20 | 7 |
| B | 4 | 30 | 15 | 35 | 9 |
| A | 3 | 60 | 25 | 55 | 11 |
| S | 2 | 100 | 40 | 80 | 13 |

던전 ID는 `dungeon-001`부터 `dungeon-015`까지 고정한다. 각 던전은
`initialGrade`와 같은 `grade`, `status: "remaining"`, `failureCount: 0`을
갖는다. `dungeon` 스트림으로 같은 등급의 ID 순서를 섞고, 섞인 순서의
위치를 `sortOrder`로 저장한다. 이 키는 게시판을 다시 열 때 난수를 다시
뽑지 않고 같은 등급 순서를 유지하기 위한 값이다.

게시판의 정렬 키는 다음 순서다.

1. 등급 순서 `C → B → A → S`
2. `sortOrder` 오름차순
3. ID 오름차순을 최종 동률 해소 기준으로 사용

전멸로 던전 등급이 바뀌는 규칙은 C3가 관리하지만, 게시판은 현재
`grade`에 맞는 지원 조건·보상·지도 지점 값을 읽는다.

### 인물·파티 생성

완성 파티는 정확히 `CAMPAIGN_PARTY_SIZE`인 3인으로 고정한다. 파티마다
다음 조건을 만족한다.

- 세 인물의 `classId`가 서로 다르다.
- 세 인물의 `personality`가 서로 다르다.
- 모든 인물은 `alive: true`, `maxHp: 100`, `currentHp: 100`으로 시작한다.
- 초기 신뢰는 성격 기본값에 `-5..+5` 정수를 더하고 0..100으로 자른다.
- 소지 골드는 `carriedGold` 스트림에서 정한 10..30의 정수다.
- 기억은 새 빈 배열이다.

성격별 초기 신뢰 기본값은 기존 규칙을 재사용한다.

| 성격 | 기본값 |
| --- | ---: |
| `suspicious` | 35 |
| `prudent` | 45 |
| `greedy` | 50 |
| `righteous` | 55 |
| `impulsive` | 60 |

파티 ID는 `party-001`부터 `party-015`, 인물 ID는 생성 순서에 따라
`member-001`부터 `member-051`까지 고정한다. 이름은 콘텐츠 풀에서 파티
내 중복 없이 선택하며, 풀의 크기상 서로 다른 파티 사이의 이름 중복은
허용한다. 직업과 성격도 파티 밖에서는 중복될 수 있다.

예비 인원 6명은 `reserve` 스트림으로 한 명씩 생성하고 어떤 파티에도
소속시키지 않는다. 예비 인원 사이의 직업·성격 중복은 허용하지만,
초기 신뢰·HP·소지 골드·기억의 개인 상태 계약은 출전 인원과 같다.

난수 소비 영역은 다음처럼 분리한다.

| 스트림 | 책임 |
| --- | --- |
| `dungeon` | 던전의 같은 등급 내 정렬 키 |
| `party` | 15개 완성 파티의 직업·성격·이름·초기 신뢰 선택 |
| `reserve` | 예비 인원의 직업·성격·이름·초기 신뢰 선택 |
| `carriedGold` | 모든 인물의 10..30 소지 골드 |
| `board` | 게시판에서 완성 파티를 던전에 연결하는 순서 |

`createRng(seed).derive(name)`으로 각 스트림을 파생한다. 모듈 내부에서
새 루트 RNG를 만들거나 `Math.random()`을 사용하지 않는다. 한 스트림의
호출 횟수 변경이 다른 영역 결과를 바꾸지 않아야 한다.

## 게시판 계약

### 공개 함수

```ts
generateBoard(state: CampaignState): BoardOffer[]
canAcceptOffer(
  state: CampaignState,
  offer: BoardOffer,
): { accepted: true } | {
  accepted: false;
  reason: "insufficientReputation" | "partyUnavailable";
}
createBoardEnding(
  state: CampaignState,
): "supportUnavailable" | "partyExhausted" | null
```

모든 함수는 입력 상태를 변경하지 않는다. `generateBoard`는 `state.seed`에서
`board` 스트림을 새로 파생하므로 같은 상태에서 반복 호출해도 동일한
결과를 반환하고, 게시판을 보는 행위가 RNG 상태를 소비하지 않는다.

### 공고 생성 순서

1. `status: "remaining"`인 던전만 수집한다.
2. 던전을 등급·`sortOrder`·ID 순으로 정렬한다.
3. `complete: true`인 파티만 수집한다.
4. 후보 파티 ID를 `board` 스트림으로 섞어 시드 기반 연결 순서를 만든다.
5. `min(5, 남은 던전 수, 완성 파티 수)`개만 앞에서부터 1:1로 연결한다.
6. 각 연결에 현재 던전 등급의 지원 명성·기본 보상·지도 지점을 복사한다.
7. `currentReputation < requiredReputation`이면 `locked: true`와
   `lockReason: "insufficientReputation"`을 설정한다. 잠긴 공고도 배열에서
   제거하지 않는다.

공고 ID는 던전 ID와 파티 ID의 결정적인 조합으로 만들어 한 게시판 안에서
중복되지 않게 한다. 게시판 생성만으로 던전·파티의 영구 관계를 기록하지
않으며, 연결은 현재 게시판의 일시적인 `BoardOffer`에만 존재한다.

완성 파티가 1~4팀이면 공고도 그 수만큼만 만든다. 완성 파티가 0팀이면
남은 던전이 있는 경우 공고를 만들 수 없다.

### 지원 판정

`canAcceptOffer`는 공고를 실제로 계약하거나 상태를 전이하지 않는다.

- 현재 게시판의 공고이고 파티가 여전히 완성 상태이며 던전이 남아 있고,
  현재 명성이 충분하면 `{ accepted: true }`를 반환한다.
- 명성이 부족하면 `{ accepted: false, reason: "insufficientReputation" }`를
  반환한다.
- 공고가 현재 게시판에 없거나, 던전이 남아 있지 않거나, 파티가 더 이상
  완성 상태가 아니면 `{ accepted: false, reason: "partyUnavailable" }`를
  반환한다.

계약 성공 뒤 `contract` 단계로 바꾸고 탐험을 만드는 책임은 C3 또는 통합
상태 머신의 후속 작업이다.

### 게시판 종료 후보

`createBoardEnding`은 현재 보드의 진행 가능성만 계산한다.

- 남은 던전이 없으면 `null`을 반환한다. 정상 완주는 C3가 판정한다.
- 남은 던전이 있고 완성 파티가 0팀이면 `"partyExhausted"`를 반환한다.
- 공고가 1개 이상이고 전부 잠겨 있으면 `"supportUnavailable"`를 반환한다.
- 하나라도 지원 가능한 공고가 있으면 `null`을 반환한다.

이 함수는 `CampaignEnding` 객체를 만들거나 로그·단계를 변경하지 않는다.

## 오류와 불변성

- 정적 콘텐츠 풀이나 등급 설정이 초기화 불변식을 만족하지 못하면
  `RuleError("INVALID_GENERATION", ...)`으로 실패 원인을 구조화한다.
- 입력 상태·콘텐츠 풀·기존 인물의 `memory` 배열을 직접 수정하지 않는다.
- 생성된 배열은 호출자가 수정해도 다음 호출 결과에 영향을 주지 않는 새
  값을 반환한다.
- 공고 잠금은 정보 표시 값이며, `generateBoard`가 상태의 `ending`이나
  `phase`를 변경하지 않는다.

## 테스트 설계

### `campaign-init.test.ts`

- 같은 시드 두 번 호출 시 전체 상태가 deep equal이다.
- 던전 수량이 C/B/A/S 각각 6/4/3/2다.
- 던전 ID가 유일하고 각 등급의 `sortOrder`가 유일하다.
- 완성 파티가 15팀이고 모든 파티가 정확히 3명이다.
- 파티별 직업·성격이 중복되지 않고, 인물 ID가 전체에서 유일하다.
- 예비 인원이 6명이며 어떤 파티에도 들어 있지 않다.
- 모든 인물이 HP 100/100, 생존, 신뢰 0..100, 소지 골드 10..30,
  빈 기억으로 시작한다.
- 초기 자원이 `rank: C`, 명성 0, 현재 골드 10, 누적 골드 0이다.
- 초기 phase가 `board`이고 첫 게시판이 최대 5개 공고를 가진다.
- 다른 시드는 던전 정렬·파티 조합·소지 골드 중 하나 이상이 달라진다.
- 한 호출의 반환 배열을 수정해도 다른 호출 결과가 오염되지 않는다.

### `board.test.ts`

- 던전은 C→B→A→S 및 같은 등급의 `sortOrder` 순으로 제시된다.
- 남은 던전과 완성 파티가 충분하면 공고가 정확히 5개다.
- 완성 파티가 1·2·3·4팀이면 공고도 각각 그 수만큼만 생성된다.
- 각 공고에서 던전과 파티가 중복되지 않는다.
- 명성이 부족한 공고도 남아 있고 잠금 이유가 표시된다.
- 같은 상태의 `generateBoard` 호출 결과가 deep equal이다.
- 명성이 충분한 공고는 수락 가능하고, 부족한 공고는
  `insufficientReputation`으로 거부된다.
- 현재 보드에 없는 공고·불완성 파티·남지 않은 던전은
  `partyUnavailable`로 거부된다.
- 남은 던전이 없을 때는 C1이 정상 완주 엔딩을 만들지 않는다.
- 완성 파티가 없으면 `partyExhausted`, 공고가 모두 잠기면
  `supportUnavailable`을 반환한다.
- 상태와 중첩 배열을 직접 변경하지 않는다.

자동 검증은 다음 범위로 실행한다.

```text
pnpm test lib/rules/campaign-init.test.ts lib/rules/board.test.ts
pnpm typecheck
pnpm lint
```

C1은 화면을 포함하지 않으므로 브라우저 검증은 이 spec의 완료 조건이 아니다.
후속 U1/I1에서 동일한 `BoardOffer`와 초기 `CampaignState`를 화면에 연결할
때 별도 브라우저 검증을 추가한다.

## 파일 경계

### 생성

- `lib/content/dungeons.ts` — C1 등급별 상수와 15개 초기 던전 정의
- `lib/rules/campaign-init.ts` — 결정적 캠페인 factory
- `lib/rules/campaign-init.test.ts` — 초기화 불변식·재현성 테스트
- `lib/rules/board.ts` — 게시판 생성·지원·종료 후보 규칙
- `lib/rules/board.test.ts` — 게시판 정렬·잠금·재현성 테스트

### 필요한 최소 수정

- `lib/rules/party.ts` — 기존 기본 동작을 유지하면서 C1이 3인 고정 파티를
  요청할 수 있는 선택적 크기 계약 또는 공유 인물 생성 helper를 제공한다.
- `lib/domain` — 현재 F1 계약으로 충족되지 않는 필드가 발견될 때만 수정한다.
  C3 전용 상태나 정산 필드를 C1에서 선행 추가하지 않는다.
- `docs/README.md` — 이 spec과 이후 승인된 plan을 C1 실행 기록에 연결한다.

### 변경하지 않음

- `lib/rules/settlement.ts`, `promotion.ts`, `ending.ts`에 해당하는 C3 영역
- `lib/flow/run-machine.ts`와 Zustand store
- F2 콘텐츠와 검증 화면
- 기존 원본 자료

## 완료 기준

1. 동일한 시드로 15개 던전·15팀·예비 6명·초기 자원·첫 게시판을 동일하게
   재현한다.
2. 던전 등급별 수량과 게시판 정렬·최대 5개 규칙을 지킨다.
3. 파티별 직업·성격 중복을 금지하고 모든 인물의 개인 상태를 초기화한다.
4. 명성 부족 공고를 숨기지 않고 잠금 이유와 함께 유지한다.
5. 입력 상태와 콘텐츠를 변형하지 않고 구조화된 생성 실패를 보고한다.
6. C3가 정산 뒤 `generateBoard`와 게시판 후보 판정을 재사용할 수 있다.
7. C3·E1~E3·U1의 구현이나 담당 상태를 이 작업에서 변경하지 않는다.

## 후속 연결

- C2는 `complete`와 `waitingMemberIds`를 갱신한 뒤 같은 게시판 규칙을
  소비한다.
- C3는 계약·정산·승급·엔딩을 구현하고, 정산 후 남은 던전과 완성 파티를
  담은 상태에 `generateBoard`를 호출한다.
- U1은 잠긴 공고, 지원 조건, 던전 보상, 지도 지점, 파티원의 HP·신뢰·골드를
  `BoardOffer`와 `CampaignState`에서 읽는다.
- I1은 C1 factory에서 시작해 C2·C3·E1~E3의 순수 규칙을 상태 머신으로
  연결한다.
