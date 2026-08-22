# U5 던전 진행 화면 설계

## 문서 정보

- 작성자: sbh3821
- 작성 도구: Claude Code (Opus 5)
- 작성일: 2026-08-22
- 대상 작업: `U5` 던전 진행 화면과 `/u5-test` 프리뷰
- 기준 브랜치: `main` (`c26469e`)

## 1. 목표

플레이어가 던전 안에서 **무엇을 알고 무엇을 모른 채로 조언을 고르는지**를 만드는 화면이다. 이 게임의 중심 조작이 여기서 일어난다.

완료 목표는 다음과 같다.

- 좌측 상단에 장면 슬롯, 하단에 `[행동 / 조언] [진행 기록]` 두 모드를 가진 콘솔을 둔다.
- 조언 3개를 **같은 디자인**으로 제시하고 유형·발각 확률·예상 신뢰 변화를 감춘다.
- 진행 기록이 `[전체] [단서] [전투] [생태]` 필터를 제공한다.
- 선택 뒤 `파티원별 반응 → 사건 결과 → 수치·신뢰 변화`를 인과 순서로 보여준다.
- `/u5-test`에서 사건 종류와 선택 전후 상태를 결정적으로 확인할 수 있다.
- 16:9 고정 캔버스와 공용 상태 바 규칙을 그대로 따른다.

## 2. 근거와 범위

근거 문서는 다음과 같다.

- `docs/systems/INFORMATION_AND_DECEPTION.md` — 피드백 원칙, 조언 콘텐츠 계약
- `docs/experience/SCREEN_LAYOUT.md` — 진행 화면 구조와 콘솔 두 모드
- `docs/diagram/screen-wireframes.md` 4절 — 표시 순서
- `docs/superpowers/specs/2026-08-22-lattebun-e3-event-materialization-design.md` — 선행 `E3`
- `docs/superpowers/specs/2026-08-22-sbh3821-u6-settlement-ending-design.md` — 프리뷰 선례

### 2.1 U6보다 유리한 조건

`U6`는 선행 넷이 모두 미착수라 화면이 쓰는 값을 전부 지어냈다. `U5`는 다르다.

| 무엇 | 상태 | U5가 쓰는 방식 |
| --- | --- | --- |
| `E2` 조언 판정 | ✅ 완료 | **실제 함수를 그대로 호출한다** |
| `E3` 사건 물질화 | 🟡 진행 중 | 출력 타입이 이미 `main`에 있다. 그 타입으로 fixture를 만든다 |
| `E4` 턴 보스전 | ⬜ | `U5-2`의 몫이다. 이번 범위 밖 |

`E2`가 내놓는 것을 화면이 직접 쓴다.

```ts
presentShuffledAdvice()          // 조언 3개를 결정적으로 섞어 제시
decideImmediateAdvice()          // 선택 → 파티원별 수용·의심·적발
finalizeImmediateAdviceTrust()   // 신뢰 변화 확정
disclosedRuleIds()               // 위험도별 공개 생태 규칙 = 「생태」 탭
```

`E3`의 출력 타입 `MaterializedNodeEvent`·`PreparedExpeditionEvents`도 이미 확정돼 있다. **화면은 `SituationEvent` 하나를 받아 그리면 되고, 그것을 누가 만들었는지 알 필요가 없다.**

따라서 이번 작업이 지어내는 것은 **어떤 사건이 나왔는가** 하나뿐이다. 조언 제시·반응 판정·생태 공개는 실제 규칙이 한다.

### 2.2 다루지 않는 것

- 자동 전투 장면 연출은 `U5-2`다. 이번에는 전투 기록을 **텍스트로만** 보여준다.
- 보스전 턴 재생은 `E4`가 없어 다루지 않는다.
- 지도에서 지점을 고르는 것은 `U4`다.
- `lib/` 을 건드리지 않는다. 이 작업은 `E3`를 대신하지 않는다.

## 3. 화면 구조

`GameShell`의 3:2를 쓴다. 좌측을 위아래로 나눈다.

```text
┌─ 좌 60% ─────────────────────┐ ┌─ 우 40% ──────┐
│  장면 슬롯            40%     │ │  파티 상태     │
│  (테마×종류 배경)             │ │  HP·신뢰·골드  │
├──────────────────────────────┤ │               │
│  콘솔                 60%     │ │  최근 반응     │
│  [행동 / 조언] [진행 기록]    │ │               │
└──────────────────────────────┘ └───────────────┘
```

**조작 영역이 장면보다 넓다는 원칙을 지킨다.** 위 40% / 아래 60%다.

### 3.1 장면 슬롯

`public/assets/u5/dungeon-progress-scenes/{theme}/{kind}.png` 를 배경으로 쓴다. 테마 셋(`spider`·`dessert`·`tomb`)과 종류 여섯(`entry`·`monster`·`rest`·`merchant`·`special`·`boss`)이 이미 있다.

`ThemeId`는 `spider`·`desert`·`graveyard`인데 자산 폴더는 `spider`·`dessert`·`tomb`다. **이름이 어긋난다.** 자산을 옮기지 않고 화면 모델에서 한 곳으로 매핑하고, 그 매핑에 어긋남을 적어 둔다. 자산 폴더를 바꾸면 이미 머지된 커밋의 경로가 깨진다.

`EventKind`는 `monster`·`rest`·`merchant`·`special` 넷이다. `entry`와 `boss`는 사건 종류가 아니라 지점 성격이므로, 장면 선택은 `EventKind`가 아니라 **화면이 받는 `U5SceneKind`** 로 정한다.

### 3.2 콘솔 두 모드

```text
[행동 / 조언] [진행 기록]
```

선택이 필요한 순간에는 `행동 / 조언`을 자동으로 전면에 둔다. 선택 뒤 결과가 나오거나 전투가 진행되는 동안에는 `진행 기록`으로 전환할 수 있다. **플레이어는 언제든 두 모드를 수동으로 바꾼다.**

## 4. 행동 / 조언 모드

### 4.1 선택 전

상황 묘사를 먼저 보여주고 조언 3개를 그 아래 둔다. 상황 묘사가 추론의 근거를 실어 나르므로 조언보다 먼저 읽혀야 한다.

조언 3개는 **같은 디자인**이다. 화면이 감추는 것은 다음이다.

- 조언 유형(`help` / `harm` / `neutral`)
- 참조 규칙과 정합·모순(`consistent` / `contradictory`)
- 발각 확률
- 예상 신뢰 변화량

감추는 것은 결론이지 근거가 아니다. 플레이어가 실패했을 때 `앞에서 나온 단서를 놓쳤구나`가 되어야지 `이걸 어떻게 알아?`가 되면 안 된다. 그래서 화면은 판단 재료를 **모두** 보여준다.

- 정보를 받을 파티원과 현재 신뢰·성격 (우측 패널)
- 공개된 활성 생태 규칙 (`생태` 탭)
- 지금까지 쌓인 관찰 단서 (`단서` 탭)

조언 순서는 `presentShuffledAdvice`가 결정적으로 섞는다. 화면이 다시 섞지 않는다.

### 4.2 선택 직후

인과 순서로 보여준다.

```text
1  파티원별 반응     수용 · 의심 · 적발
2  사건 결과         무슨 일이 왜 일어났는지
3  수치·신뢰 변화    HP · 골드 · 상태 · 신뢰와 사람이 읽는 이유
```

내부 판정값(`help`/`harm`/`neutral`, `consistent`/`contradictory`)이나 `어떤 규칙과 정합했다`는 정답 문구는 **선택 뒤에도 공개하지 않는다.** 결과 문구가 무슨 일이 왜 일어났는지를 드러내면 충분하다.

아무도 수용하지 않으면 `defaultResultText`가 온다. 파티가 자기 방식대로 처리한 결과다.

## 5. 진행 기록 모드

현재 원정의 시간 순 기록이다. 필터 넷을 제공한다.

| 필터 | 담는 것 | 담지 않는 것 |
| --- | --- | --- |
| 전체 | 조언 선택·파티 반응·사건 결과를 시간 순으로 합침 | — |
| 단서 | 사건에서 관찰한 사실과 결과 | 숨은 규칙 문장으로 자동 승격하지 않는다 |
| 전투 | 자동 전투의 행동·피해 기록 | — |
| 생태 | `E2`가 위험도에 따라 공개한 활성 생태 규칙 | 공개되지 않은 규칙 |

`생태` 탭이 이 화면에서 가장 조심스러운 자리다. **확인된 생태와 관찰 단서를 구분하고, 숨은 규칙을 자동으로 정답 처리하지 않는다.** 단서가 규칙을 시사해도 화면이 대신 결론 내리지 않는다.

```text
확인된 생태     E2가 공개한 규칙. 단정형으로 적는다
관찰 단서       사건에서 본 사실. 그대로 적는다
```

둘을 같은 목록에 섞지 않고 구역을 나눈다. 색으로만 구분하지 않고 구역 제목을 함께 둔다.

## 6. ViewModel 경계

화면은 `ExpeditionState`를 직접 읽지 않는다.

```ts
// components/game/u5-progress-model.ts
export type U5SceneKind = "entry" | "monster" | "rest" | "merchant" | "special" | "boss";

export interface U5AdviceOptionView {
  /** 화면이 쓰는 슬롯 번호. 내부 유형을 드러내지 않는다. */
  slot: 0 | 1 | 2;
  text: string;
  /** 고블린의 근거 대사. */
  rationale: string;
}

export interface U5ReactionView {
  memberName: string;
  reaction: InfoReaction;      // accepted · suspected · exposed
  /** 사람이 읽는 이유. 내부 판정값을 쓰지 않는다. */
  note: string;
}

export interface U5OutcomeView {
  reactions: readonly U5ReactionView[];
  resultText: string;
  changes: readonly { label: string; detail: string }[];
}

export interface U5LogEntry {
  order: number;
  filters: readonly U5LogFilter[];   // 한 항목이 여러 필터에 걸린다
  label: string;
  detail: string;
}

export interface U5ProgressView {
  dungeonName: string;
  theme: ThemeId;
  sceneKind: U5SceneKind;
  nodeLabel: string;
  situation: string;
  advice: readonly U5AdviceOptionView[];
  /** 선택 전이면 null. */
  outcome: U5OutcomeView | null;
  disclosedEcology: readonly string[];
  observedClues: readonly string[];
  log: readonly U5LogEntry[];
  party: readonly U5PartyMemberView[];
}
```

`E3`가 들어오면 `createU5ProgressView(expedition, materialized)`가 이 타입을 만든다. 그때까지는 `u5-preview-data.ts`가 실제 `E2` 함수를 호출하되 사건만 fixture로 넣는다.

## 7. 자산

| 갈래 | 경로 | 비고 |
| --- | --- | --- |
| 장면 배경 | `u5/dungeon-progress-scenes/{spider,dessert,tomb}/{entry,monster,rest,merchant,special,boss}.png` | 18장, 2048×768 RGB |

알파가 없는 전면 배경이라 투명 여백 규칙의 대상이 아니다. 장당 약 2.6MB로 합계 47MB인데, 이미 머지된 자산이므로 이번 작업에서 건드리지 않는다. 용량이 문제가 되면 별도로 다룬다.

## 8. 공용 규칙 준수

- 상단 상태 바를 화면 CSS에서 다시 선언하지 않는다.
- 크기는 `rem`과 `cqw`·`cqh`로 쓰고 `vw`·`vh`와 미디어 쿼리를 쓰지 않는다.
- 색만으로 의미를 전달하지 않는다. 반응 셋(`수용`·`의심`·`적발`)에 문구를 함께 둔다.
- 조언 3개는 시각적으로 구별되지 않아야 한다. 이것이 이 화면의 가장 중요한 계약이다.

## 9. `/u5-test`

`U5Preview`가 다음을 전환한다.

- `일반 사건 · 선택 전` — 몬스터 지점, 조언 3개 제시
- `일반 사건 · 선택 후` — 반응·결과·변화
- `아무도 수용하지 않음` — `defaultResultText` 경로
- `상인 사건` — merchant 계열
- `특수 사건` — special 계열
- `휴식 지점` — rest
- `진행 기록 · 단서` `진행 기록 · 전투` `진행 기록 · 생태` — 필터별 모습

프리뷰 seed를 상수로 고정해 새로고침해도 같은 화면이 나온다.

## 10. 테스트 계약

- `u5-progress-model.test.ts` — 테마·종류가 장면 경로로 옳게 매핑된다. `ThemeId`와 자산 폴더 이름 어긋남을 고정한다.
- `u5-advice-presentation.test.ts` — **조언 3개가 유형·정합·확률·신뢰 변화를 담지 않는다.** View 타입에 그 필드가 없음을 타입과 렌더 양쪽에서 확인한다.
- `u5-log-filter.test.ts` — 한 항목이 여러 필터에 걸린다. `생태`가 공개된 규칙만 담고 관찰 단서를 규칙으로 승격하지 않는다.
- `U5ProgressScreen.test.ts` — 선택 전후 구조, 인과 순서, 색 외 단서.
- `U5Assets.test.ts` — 18장이 실제 PNG이고 테마×종류 조합이 빠짐없다.
- `U5FixedCanvas.test.ts` — `vw`·`vh`·`@media` 없음, 상태 바 재선언 없음.
- `pnpm test` `pnpm lint` `pnpm typecheck` `pnpm build`

`pnpm backtest`는 실행하지 않는다.

## 11. 완료 조건

- `/u5-test`에서 아홉 상태가 렌더링되고 서로 전환된다.
- 네 창 비율에서 레이아웃이 같고 스크롤이 없다.
- 조언 3개가 시각적으로 구별되지 않는다.
- 진행 기록 필터 넷이 각각 옳은 항목만 보여준다.
- `생태` 탭이 확인된 생태와 관찰 단서를 구역으로 나눈다.
- 자동 검증 전부 통과.

## 12. 변경하지 않는 것

- `lib/` 전체. 이 작업은 `E3`를 대신하지 않는다.
- 캠페인 규칙, 보상 수치, 상태 머신, 도메인 타입
- `U1`~`U4`, `U6` 화면 구조
- 공용 상태 바와 고정 캔버스 계약
- `u5/dungeon-progress-scenes` 자산 파일과 폴더 이름
- 배정표의 `E3` 상태
