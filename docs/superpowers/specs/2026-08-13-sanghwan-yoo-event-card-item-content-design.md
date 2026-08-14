# F2 사건·카드·아이템 콘텐츠 설계

> 상태: 사용자 검토 요청
> 작성일: 2026-08-13
> 작성자: SangHwan Yoo
> 작성 도구: Codex

## 목적

F2는 15개 던전 캠페인에서 사용할 사건·정보 카드·아이템·보스 콘텐츠의 데이터 계약과 불변식을 제공한다. 콘텐츠를 규칙 함수와 분리해 E1~E3와 C4가 같은 풀을 사용하게 하고, S급 지도에 필요한 사건 수와 보스 관련 정보 수를 콘텐츠 단계에서 검증한다.

F2에서는 사건 선택, 아이템 사용, 카드 반응, 보스 피해의 실제 계산을 구현하지 않는다. 선택지와 아이템은 이후 Task 6~7이 해석할 선언적 효과 태그만 제공하며, 실제 HP·신뢰·골드·생존 계산은 해당 규칙 작업의 책임이다.

## 근거와 적용 범위

이 설계는 다음 문서를 기준으로 한다.

1. [게임 원칙](../../GAME_PRINCIPLES.md)
2. [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
3. [던전 이벤트와 보스 시스템](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
4. [정보와 기만 시스템](../../systems/INFORMATION_AND_DECEPTION.md)
5. [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)의 F2 완료 기준
6. [게임 방향 개편 상위 spec](2026-08-13-sanghwan-yoo-game-direction-rework-design.md)과 상세 plan Task 2, 5~7

상위 규칙과 충돌하면 게임 원칙과 공식 시스템 문서를 우선한다. 이번 변경은 고블린 길잡이의 역할, 정보 수신자, 생존·배신의 양면성을 바꾸지 않으므로 `docs/GAME_PRINCIPLES.md`는 수정하지 않는다.

## 범위

### 포함

- 일반 사건 12개를 `monster`, `rest`, `merchant`, `special` 각 3개로 구성
- 보스 사건 풀과 사건별 선택지 2개 이상
- 선택지의 선언적 `EventEffectTag` 계약
- 진실·거짓·중립 정보 카드 12개와 보스 주제 카드
- 치료제·독·식량·정보 두루마리·유인용 미끼 아이템 데이터
- C/B/A/S 등급별 보스 기본 피해 데이터
- 콘텐츠 풀의 ID·수량·문구·분류·수치 불변식 검증
- `RuleError("INVALID_GENERATION")` 기반의 명시적 콘텐츠 오류
- F1 fixture와 콘텐츠 풀을 한 화면에서 확인하는 `/f2-test` 페이지
- F1 테스트 문서와 F2 브라우저 검증 문서

### 제외

- 사건 선택지의 HP·신뢰·골드·아이템 실제 효과 계산
- 카드의 개인별 수용·의심·적발 판정
- 정보 카드의 보스 피해 보정 계산
- 아이템 구매·사용·잔액 검증 규칙
- 보스전 생존 판정과 사후 신뢰 검증
- 등급별 지도 생성, 경로 배치, 정보 기회 위치 결정
- 캠페인 상태 머신·저장소·전체 플레이 흐름
- 보스 거래 또는 보스에게 정보를 전달하는 행동
- 길잡이가 사용하는 가짜 지도 아이템

## 설계 원칙

### 콘텐츠와 규칙의 단방향 의존

콘텐츠 모듈은 도메인 타입과 닫힌 태그 목록만 가져온다. 콘텐츠 모듈이 RNG, Zustand, 화면 상태 또는 규칙 계산을 호출하지 않는다. 규칙 모듈은 콘텐츠 풀을 입력으로 받고, 콘텐츠 데이터는 규칙 결과를 직접 만들지 않는다.

### 미래 규칙을 위한 선언적 데이터

선택지와 아이템은 이후 규칙이 행동 의도를 식별할 수 있도록 태그를 가진다. 태그는 계산식이 아니며 F2 validator는 태그가 허용 목록에 속하고 하나 이상 존재하는지만 확인한다.

### 고블린 길잡이 역할과의 일치

길잡이는 전체 경로를 이미 알고 있으므로 가짜 지도는 콘텐츠에서 제거한다. 아이템은 파티의 상태를 보조하거나 위험을 조절해야 하며, `유인용 미끼`는 몬스터의 위치와 위험을 조절하는 도구로 이후 규칙에서 해석한다.

### 조용한 재추첨 금지

콘텐츠 수량·중복·필수 필드가 계약을 만족하지 않으면 `RuleError`를 반환한다. 부족한 사건이나 카드를 몰래 중복 선택해 생성 가능한 것처럼 보이게 만들지 않는다.

## 콘텐츠 계약

### 사건

기존 `DungeonEventPools`를 콘텐츠의 공개 진입점으로 유지한다.

- `regular.monster`에 3개
- `regular.rest`에 3개
- `regular.merchant`에 3개
- `regular.special`에 3개
- `boss`에 1개 이상

일반 사건 12개는 C/B/A/S의 일반 지점 요구량 6/8/10/12를 채우는 최소 풀이다. 지도 생성과 실제 경로별 중복 금지는 Task 5가 담당하고, F2는 전체 풀의 용량과 고유성을 검증한다.

모든 사건은 다음을 만족한다.

- 사건 ID는 전체 일반·보스 풀에서 고유하다.
- 사건 분류와 풀의 분류가 일치한다.
- 제목·설명은 공백이 아니다.
- 선택지가 2개 이상이다.
- 선택지 ID는 전체 사건에서 고유하다.
- 선택지 라벨·예상 이득·알려진 위험은 공백이 아니다.
- 선택지의 `effectTags`는 하나 이상이며 허용된 태그만 사용한다.
- F2 실제 콘텐츠의 선택지는 보스를 대상으로 하지 않는다.

기존 `EventTarget`의 보스 분기는 Task 6에서 정리될 때까지 타입 호환을 위해 남길 수 있지만, F2 콘텐츠 validator는 `target.kind === "boss"` 선택지를 거부한다. F2의 사건은 용사 지원·위험 조절·아이템·거래·관망의 선택지만 제공한다.

선택지 태그의 초기 허용 목록은 다음과 같다.

```ts
type EventEffectTag =
  | "support"
  | "sabotage"
  | "rest"
  | "trade"
  | "item"
  | "information"
  | "observe";
```

태그를 실제 수치로 해석하는 표와 RNG 소비는 Task 6의 사건 규칙 spec에서 정한다.

### 정보 카드

새 `lib/content/info-cards.ts`는 기존 `InfoCard` 타입을 사용해 `INFO_CARDS`를 제공한다.

- 전체 12개
- `truth` 4개
- `lie` 4개
- `neutral` 4개
- `subject === "boss"`인 카드 2개 이상
- 카드 ID·주제·본문은 비어 있지 않고 ID는 중복되지 않음

보스 주제 카드는 보스에게 전달되는 카드가 아니다. 살아 있는 용사 개인에게 보스의 약점·공격 방식·함정을 알려주는 카드이며, 수신자 제한은 기존 `Target` 계약과 Task 6의 파티 전용 판정이 담당한다.

F2는 카드의 진실성, 수용 확률, 개인별 반응, 보스 피해 modifier를 계산하지 않는다. 카드의 보스 관련 여부는 별도 Boolean을 추가하지 않고 `subject === "boss"`로 판별한다.

### 아이템

새 `lib/content/items.ts`는 다음 계약을 제공한다.

```ts
type ItemKind =
  | "healing"
  | "poison"
  | "food"
  | "information"
  | "lure";

interface ItemDef {
  id: ItemId;
  kind: ItemKind;
  name: string;
  description: string;
  price: number;
  effectTags: readonly ItemEffectTag[];
}
```

실제 콘텐츠는 다음 다섯 종류를 각각 하나 이상 포함한다.

- 치료제: `healing`
- 독: `poison`
- 식량: `food`
- 정보 두루마리: `information`
- 유인용 미끼: `lure`

아이템 ID·이름·설명은 고유하고 비어 있지 않다. 가격은 0 이상의 정수이며 효과 태그는 하나 이상이다. 가격 지불, 사용 대상, HP·피해·정보 효과의 수치는 Task 6~7에서 해석한다.

초기 허용 `ItemEffectTag` 목록은 다음과 같다.

```ts
type ItemEffectTag =
  | "restoreHp"
  | "dealDamage"
  | "restoreFood"
  | "revealInformation"
  | "lureMonster";
```

### 보스 데이터

새 `lib/content/bosses.ts`는 등급별 보스 데이터를 제공한다.

```ts
interface BossDef {
  id: BossId;
  grade: Grade;
  name: string;
  description: string;
  baseDamage: number;
}
```

보스 데이터는 C/B/A/S 각 1개, 총 4개다. 고유 보스 서사는 범위 밖이므로 이름과 설명은 등급별 프로토타입 콘텐츠로만 제공한다. ID·이름·설명은 비어 있지 않고 ID와 등급은 중복되지 않으며 `baseDamage`는 1 이상의 정수다. 피해 modifier, HP 차감, 생존 판정은 Task 7에서 해석한다.

`BossId`는 기존 브랜드 ID 체계에 추가해 `ItemId`와 다른 콘텐츠 ID가 섞이지 않도록 한다.

## 검증 API와 오류

새 `lib/content/validation.ts`는 사건·카드·아이템·보스 풀을 함께 검증할 수 있는 입력 계약을 제공한다.

```ts
interface ContentPools {
  events: DungeonEventPools;
  cards: readonly InfoCard[];
  items: readonly ItemDef[];
  bosses: readonly BossDef[];
}

function validateContentPools(pools: ContentPools): void;
```

검증 실패는 다음 형식의 `RuleError`로 반환한다.

- code: `INVALID_GENERATION`
- message: 사람이 읽을 수 있는 한국어 원인
- details: `contentType`, `id` 또는 `kind`, 기대 수량과 실제 수량 등 구조화 정보

최소 검증 목록은 다음과 같다.

- 사건·선택지·카드·아이템·보스 ID 중복
- 일반 사건 12개 미만 또는 네 분류 중 하나가 3개 미만
- 보스 사건 풀 비어 있음
- 사건 선택지 2개 미만
- 빈 문구·설명·위험·이득
- 허용되지 않은 효과 태그
- 보스 대상 선택지
- 진실·거짓·중립 카드 수량 불균형
- 보스 주제 카드 2개 미만
- 다섯 아이템 종류 중 누락
- 등급별 보스 누락·중복
- 음수·소수·비정상 가격 또는 기본 피해

검증 함수는 입력을 변경하지 않는다. 테스트는 `structuredClone`한 잘못된 fixture를 주입해 오류와 원본 불변성을 확인한다.

## F1 연동 브라우저 검증

### `/f2-test`

`app/f2-test/page.tsx`는 서버 페이지로 만들고 `?seed=`를 받는다. 페이지는 F1에서 사용하는 `createFixtureCampaignState(seed)`와 `createFixtureExpeditionState()`를 직접 호출해 F1 계약과 F2 콘텐츠를 같은 화면에 표시한다.

화면에는 다음 영역과 안정적인 `data-testid`를 둔다.

- F1 캠페인 상태와 `f2-f1-campaign`
- F1 탐험 상태와 `f2-f1-expedition`
- F2 전체 검증 성공 배지와 `f2-content-status`
- 사건 수량·분류·선택지 표와 `f2-events`
- 카드 유형·보스 주제 표와 `f2-cards`
- 아이템 표와 `f2-items`
- 등급별 보스 표와 `f2-bosses`
- C/B/A/S 용량 표와 `f2-capacity`
- 의도적 실패 검증 표와 `f2-negative-cases`
- 같은 seed fixture 재현성 결과와 `f2-reproducibility`

페이지에서 확인할 내용은 다음과 같다.

1. F1 계약 fixture가 로드되고 F1의 seed·phase·rank·자원·수량이 표시된다.
2. F2 콘텐츠 전체 검증이 성공한다.
3. 사건 12개, 네 분류별 3개, 사건별 선택지 2개 이상이 보인다.
4. 카드 12개, 유형별 4개, 보스 주제 2개 이상이 보인다.
5. 아이템 목록에 유인용 미끼가 있고 가짜 지도는 없다.
6. C/B/A/S 보스 데이터와 기본 피해가 보인다.
7. C/B/A/S 일반 사건 요구량 6/8/10/12가 모두 충족으로 보인다.
8. 중복·부족·잘못된 수치 fixture가 모두 `INVALID_GENERATION`으로 표시된다.
9. `alpha` 같은 seed를 다시 제출하면 F1 fixture 값과 재현성 결과가 동일하다.
10. `/f1-test`와 `/f2-test` 사이 링크가 있고 기존 F1 화면의 계약 값은 바뀌지 않는다.

기존 `/integration-test`는 역사적 단일 런·보스 수신자 테스트를 보존하되 F2 완료 기준에는 포함하지 않는다. F2 페이지는 새 캠페인 콘텐츠 계약과 F1 fixture만 사용한다.

### 문서

`docs/technical/F2_TESTING.md`를 추가한다.

- 대상 범위와 F1 연동 원칙
- 단위·계약 테스트 명령
- `pnpm dev`와 `/f2-test?seed=alpha` 브라우저 확인 순서
- F1 값 일치, 콘텐츠 수량, 실패 fixture, 재현성, 키보드 탐색 확인 항목
- 전체 검증 명령과 완료 증거

`docs/technical/F1_TESTING.md`에는 `/f2-test` 연동 검증 링크와 F1 회귀 기준을 추가한다. `docs/README.md`에는 이 spec과 이후 plan 링크를 추가한다.

## 테스트 전략

새 `lib/content/content.test.ts`는 정상 풀과 잘못된 fixture를 모두 검증한다. 기존 `lib/rules/dungeon.test.ts`는 12개 사건 풀과 2개 이상 선택지 계약의 회귀를 계속 검증한다. `lib/domain/__checks__.ts`에는 `BossId`, `ItemDef`, 효과 태그의 브랜드·컴파일 검사를 추가한다.

검증 순서는 다음과 같다.

```bash
pnpm test lib/content lib/domain lib/rules/dungeon.test.ts
pnpm typecheck
pnpm lint
pnpm test
pnpm build
git diff --check
```

브라우저 검증에서는 dev server를 실행하고 `/f1-test?seed=alpha`와 `/f2-test?seed=alpha`를 실제로 연다. F2의 성공 배지, 모든 수량 표, 실패 fixture 결과, seed 재현, 키보드 이동, 콘솔 오류와 Next.js error overlay 유무를 확인한다.

F2 완료는 단위 테스트 통과만으로 표시하지 않는다. 위 명령 전체 통과와 브라우저 확인 결과가 모두 있어야 `PROTOTYPE_WORK_ASSIGNMENT.md`의 F2 상태를 `✅ 완료`로 바꾼다.

## 완료 기준

- [ ] 사건·카드·아이템·보스 콘텐츠 계약 타입과 풀을 제공한다.
- [ ] 일반 사건 12개가 네 분류별 3개로 존재한다.
- [ ] 모든 사건에 선택지 2개 이상과 유효한 선언적 효과 태그가 있다.
- [ ] F2 콘텐츠에 보스 거래·보스 대상 선택지가 없다.
- [ ] 카드 12개가 진실·거짓·중립 각 4개이며 보스 주제 카드가 2개 이상이다.
- [ ] 아이템 5종에 유인용 미끼가 포함되고 가짜 지도는 없다.
- [ ] C/B/A/S 보스 데이터가 각각 하나씩 존재한다.
- [ ] 중복·부족·빈 값·잘못된 수치를 구조화 오류로 거부한다.
- [ ] `/f2-test`가 F1 fixture와 F2 콘텐츠를 함께 표시한다.
- [ ] `/f1-test`와 `/f2-test`의 동일 seed F1 계약 값이 재현된다.
- [ ] F2_TESTING 문서와 F1 연동 안내가 갱신된다.
- [ ] `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `git diff --check`가 통과한다.
- [ ] 실제 브라우저에서 F1·F2 화면, 실패 fixture, seed 재현과 접근성을 확인한다.

## 구현 후 검토 포인트

- 콘텐츠 validator가 규칙 계산을 시작하지 않는지 확인한다.
- Task 6에서 사용할 효과 태그 이름이 사건·아이템 규칙의 입력과 일치하는지 확인한다.
- F1 기존 fixture와 `/f1-test` 표시가 불필요하게 변경되지 않았는지 확인한다.
- UI가 가짜 지도를 노출하거나 보스 대상 정보를 다시 제공하지 않는지 확인한다.
- F2 완료 표시는 전체 자동 검증과 브라우저 검증 증거를 확인한 뒤에만 갱신한다.
