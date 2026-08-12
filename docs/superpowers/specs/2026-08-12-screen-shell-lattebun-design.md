# F5 화면 셸·레이아웃 설계

- 작업 ID: `F5`
- 작성자: LatteBun
- 작성 도구: Claude Code
- 날짜: 2026-08-12
- 상태: 검토 대기

## 목적

[인터페이스 문서](../../experience/ONBOARDING_AND_INTERFACE.md)가 정의한 6개 화면 영역을 목 데이터로 배치한 라우트를 만든다. `U1`~`U4`가 각각 이 영역 하나씩을 실제 데이터에 연결하므로, 이 작업은 넷이 공유할 뼈대와 시각 언어를 정하는 일이다.

배정표의 완료 기준은 다음 한 줄이다.

> 인터페이스 문서의 6개 화면 영역이 목 데이터로 배치된 라우트 존재

## 6개 화면 영역

| 번호 | 영역 | 담당 작업 |
| --- | --- | --- |
| ① | 현재 위치와 상태 | `U1` |
| ② | 전투·이동 장면 | 프로토타입 범위 밖 (자리만) |
| ③ | 이벤트와 선택 패널 | `U2` |
| ④ | 파티와 개인 신뢰 | `U1` |
| ⑤ | 던전 분기 지도 | `U3` |
| ⑥ | 결과 화면 | `U4` |

## 초기 와이어프레임의 해석

[proto_image.png](../../initialization/proto_image.png)와 그 구상을 다음으로 확정한다. 여기까지가 설정집에 없던 내용이므로 이번 작업에서 [인터페이스 문서](../../experience/ONBOARDING_AND_INTERFACE.md)에 함께 반영한다.

### 지도는 별개 화면이며 오간다

지도는 플레이 화면의 사이드 패널이 아니다. 길잡이가 길을 고르는 화면이고, 노드를 고르면 그 지점의 조우 화면으로 들어간다. 해결하면 다시 지도로 돌아온다.

```text
지도에서 노드 선택
→ 그 노드의 조우 화면
→ 해결
→ 다시 지도
→ 반복
→ 보스방
→ 결과 화면
```

### 지도는 아래에서 위로 진행한다

입구는 한 곳이며 지도의 맨 아래에 있다. 위로 갈라지며 올라가고, 어떤 경로를 골라도 맨 위의 보스방으로 모인다. `DungeonNode.depth`가 세로 위치를 정한다.

이 구조는 `DungeonState`의 `entryNodeId` 하나와 `bossNodeId` 하나에 그대로 맞는다. 도메인 타입을 고칠 필요가 없다.

### 조우 화면은 위가 관람, 아래가 조작이다

위쪽은 용사 파티의 행동을 자동으로 보여주는 영역이다. 플레이어가 조작하지 않는다. 아래쪽이 플레이어의 선택지와 이벤트를 담는다.

**아래 영역이 위 영역보다 크다.** 인터페이스 문서가 "이 영역의 역할은 플레이어 선택의 결과를 전달하는 것이며 조작의 중심은 아니다"라고 정한 것을 비율로 표현한다.

애니메이션은 이번 작업에서 만들지 않는다. 자리와 비율만 잡고 안에는 정지된 목 장면을 넣는다.

## 라우트와 셸

```text
app/
  layout.tsx                    html/body. 기존 구조 유지
  globals.css                   디자인 토큰 정의
  page.tsx                      / → /play 로 보냄
  play/
    layout.tsx                  게임 셸 — ① 자원 바 + ④ 사이드바 + children
    page.tsx                    파티 소개 · 던전 입장
    map/page.tsx                ⑤ 분기 지도
    node/[nodeId]/page.tsx      ② 장면 + ③ 선택
    result/page.tsx             ⑥ 결과
```

라우트를 넷으로 나눈 이유는 둘이다.

1. `RunPhase` 6단계가 네 화면으로 나뉘는 구조가 URL에 드러난다. `partyIntro`는 `/play`, `pathChoice`는 `/play/map`, `event`와 `bossFight`는 `/play/node/[nodeId]`, `settlement`와 `ended`는 `/play/result`다. 나중에 `P1` 상태 머신이 단계로 화면을 고르면 된다.
2. `U2`·`U3`·`U4` 담당자가 자기 화면을 URL로 바로 열 수 있다. 한 라우트에 몰면 매번 처음부터 눌러 들어가야 한다.

`/`는 `next/navigation`의 `redirect`로 `/play`에 보낸다. 시작 화면을 둘지는 `U5` 온보딩이 정할 일이므로 지금 만들지 않는다. 현재 `app/page.tsx`의 Hello World는 이 리다이렉트로 대체된다.

### 셸이 ①과 ④를 들고 있다

`app/play/layout.tsx` 하나가 자원 바와 파티 사이드바를 담는다. 네 화면이 이 레이아웃을 공유하므로 화면마다 다시 그리지 않는다.

```text
┌──────────────────────────────────┬──────────┐
│ ① 3층 · 이벤트   금 12 식 4 명 7  │          │
├──────────────────────────────────┤    ④     │
│                                  │  파티     │
│      화면마다 달라지는 부분         │  사이드바  │
│      (children)                  │          │
│                                  │          │
└──────────────────────────────────┴──────────┘
```

파티 사이드바를 셸에 둔 결과로, `U1`은 개별 화면 작업이 아니라 셸 작업이 된다. 지도 화면에서 길을 고를 때도 누가 나를 얼마나 믿는지 보인다.

모든 컴포넌트는 서버 컴포넌트다. 클라이언트 상태는 `F2`의 책임이므로 `"use client"`를 쓰지 않는다.

## 컴포넌트 배치

```text
components/
  ui/                 도메인을 모르는 프리미티브
    Panel.tsx         제목 있는 패널 껍데기
    StatValue.tsx     라벨 + 숫자
  game/               도메인 타입을 읽는 것들
    ResourceBar.tsx   ①
    PartySidebar.tsx  ④
    TrustRow.tsx      ④ 의 한 줄
    SceneStage.tsx    ② 자리만
    ChoiceList.tsx    ③
    DungeonMap.tsx    ⑤
    ResultSummary.tsx ⑥
```

**`components/ui/`는 `lib/domain`을 import하지 않는다.** 프리미티브가 게임을 모르게 유지하는 경계다. 어기면 `Panel`을 다른 맥락에서 재사용할 수 없게 되고, 프리미티브를 고칠 때 게임 규칙을 함께 읽어야 한다.

## 디자인 토큰

`globals.css`의 `@theme`에 정의한다. 현재 `globals.css`가 이미 쓰고 있는 세 색을 토큰으로 승격시키고 넷을 더한다.

| 토큰 | 값 | 역할 |
| --- | --- | --- |
| `--color-ink` | `#17130f` | 화면 바탕 |
| `--color-parchment` | `#f4f0e6` | 본문 글자 |
| `--color-muted` | `#cbbca5` | 보조 글자 |
| `--color-panel` | `#211a14` | 패널 바탕 |
| `--color-edge` | `#3a2e23` | 패널 테두리 |
| `--color-trust-up` | `#7fa66a` | 신뢰 상승 |
| `--color-trust-down` | `#b5654f` | 신뢰 하락 |

현재 `globals.css`가 Hello World용으로 갖고 있는 규칙은 지운다. `body`의 `place-items: center`, `main`의 `text-align: center`, `h1`의 `font-size: 3rem`은 게임 레이아웃과 맞지 않는다.

`U1`~`U4`가 새 패널을 만들 때 색을 새로 고르지 않도록 토큰과 `Panel`을 함께 제공한다.

신뢰 상승·하락은 **색만으로 구분하지 않는다.** `▲8` / `▼8` 기호를 함께 쓴다. `Q2` 접근성 점검이 "카드 유형이 색상 외 단서로 구분"을 요구하는데, 같은 원칙을 신뢰 변화에도 처음부터 적용한다. 나중에 고치는 편보다 싸다.

이 작업은 색·간격·타이포까지만 정하고 아이콘·질감·아트 스타일은 정하지 않는다. 인터페이스 문서의 「아직 확정하지 않는 범위」를 그대로 둔다.

## 화면 크기

데스크톱 가로 배치를 기준으로 만들고, 화면이 좁아지면 사이드바가 아래로 내려가 세로로 쌓인다. Tailwind의 기본 브레이크포인트를 쓴다.

인터페이스 문서가 「모바일과 데스크톱 중 우선 입력 방식」을 미확정으로 남겨 뒀으므로, 그 결정을 강제하지 않으면서 좁은 화면에서 레이아웃이 무너지지는 않게 한다. 터치 조작 최적화는 하지 않는다.

## 목 데이터

```text
lib/mock/
  classes.ts    ClassDef 5개 — 전사·성직자·도적·마법사·궁수
  cards.ts      InfoCard — 진실·거짓·중립 각 1장 이상
  events.ts     DungeonEvent 7개. 4개 분류가 모두 등장
  party.ts      PartyMember 4명. 성격이 서로 다름
  dungeon.ts    DungeonState
  run.ts        완전한 RunState 하나
  result.ts     결과 화면 뷰 타입과 목
  index.ts      barrel
  mock.test.ts  무결성 검사
```

`RunState` 하나를 통째로 만든다. 화면은 그 안에서 필요한 부분만 읽는다. `F2`와 `P1`이 붙을 때 데이터의 **출처만** 바뀌고 JSX는 고치지 않는다.

브랜드 ID는 `"m-1" as MemberId`처럼 캐스트로 만든다. 생성 함수는 도메인에 넣지 않는다. `R1`·`R4`가 같은 필요를 만날 때 그 작업에서 정한다.

### 지도 그래프

갈라지기만 하지 않고 다시 합쳐지게 만든다. 던전 문서가 "여러 갈래로 나뉘고 다시 합쳐질 수 있다"고 정했고, 합류가 없는 목을 주면 `U3` 지도가 합류를 그릴 수 있는지 아무도 확인하지 못한다.

```text
depth 3            n-boss           보스방
                  ↗      ↖
depth 2       n-b1        n-b2
              ↗   ↖      ↗   ↖
depth 1   n-a1     n-a2       n-a3
              ↖     ↑     ↗
depth 0        n-entry                입구
```

그림이 읽기 어려우므로 간선을 그대로 적는다.

| 노드 | `depth` | 이벤트 분류 | `nextNodeIds` |
| --- | --- | --- | --- |
| `n-entry` | 0 | `rest` | `n-a1` `n-a2` `n-a3` |
| `n-a1` | 1 | `monster` | `n-b1` |
| `n-a2` | 1 | `merchant` | `n-b1` `n-b2` |
| `n-a3` | 1 | `special` | `n-b2` |
| `n-b1` | 2 | `monster` | `n-boss` |
| `n-b2` | 2 | `rest` | `n-boss` |
| `n-boss` | 3 | `monster` | 없음 |

`n-a2`가 두 곳으로 갈라지고, `n-b1`은 `n-a1`·`n-a2`에서, `n-b2`는 `n-a2`·`n-a3`에서 합류한다. 노드 7개, 간선 9개다. 이벤트 분류 넷이 모두 등장한다.

### 목 데이터 무결성 검사

`lib/mock/mock.test.ts`가 목이 "그럴듯한 값"이 아니라 실제로 쓸 수 있는 값인지 확인한다. `jsdom`은 도입하지 않는다. 지금 Node 환경에서 도는 검사만 쓴다.

| 검사 | 왜 필요한가 |
| --- | --- |
| 파티가 `PARTY_SIZE_MIN`~`PARTY_SIZE_MAX` 명 | 상수를 실제로 지키는지 |
| 모든 신뢰가 `TRUST_MIN`~`TRUST_MAX` | 같음 |
| 모든 `classId`가 `classes`에 존재 | 끊긴 참조 |
| 모든 `eventId`가 `events`에 존재 | 같음 |
| `pendingClaims`의 모든 `cardId`가 `cards`에 존재 | 같음 |
| `entryNodeId`·`bossNodeId`·`currentNodeId`가 `nodes`에 존재 | 같음 |
| 입구에서 보스방까지 경로가 실제로 있음 | 못 가는 지도를 그리지 않게 |
| 입구에서 닿지 않는 노드가 없음 | 고아 노드 |
| 모든 간선이 `depth`를 늘림 | "되돌아가지 않는다"를 구조로 보장 |
| `nextNodeIds`가 빈 노드는 보스방 하나뿐 | 막다른 길 |
| 모든 이벤트가 선택지 1개 이상 | `R4` 완료 기준을 미리 지킴 |
| 4개 이벤트 분류가 모두 등장 | 셸이 분류별 표시를 실제로 보여주는지 |

위반은 배열로 모아 한 번에 보여준다. 루프 안에서 바로 단정하면 위반이 여럿일 때 첫 번째만 드러난다.

컴포넌트 렌더링 테스트는 하지 않는다. 목 데이터만 보여주는 화면을 렌더하는 테스트는 사실상 `pnpm build`가 이미 확인하는 것을 반복한다. 진짜 로직이 붙는 `U1`~`U4`에서 `jsdom`과 테스트 라이브러리를 함께 도입한다.

## 도메인에 더하는 것

이벤트 선택지 타입이 없다. `DungeonEvent`가 `title`과 `description`만 가진다. 그런데 ③ 선택 패널이 화면에서 가장 큰 영역이고, 인터페이스 문서는 선택지마다 행동 대상·예상 이득·알려진 위험을 함께 전달하라고 정해 뒀다. 담을 자리가 없다.

`R4`의 완료 기준에 "각 이벤트가 선택지를 1개 이상 가짐"이 이미 적혀 있으므로 어차피 필요한 타입이다. 모양이 확실하니 지금 도메인에 넣는다.

```ts
// lib/domain/ids.ts
export type ChoiceId = Brand<string, "ChoiceId">;

// lib/domain/dungeon.ts
export interface EventChoice {
  id: ChoiceId;
  label: string;
  /** 행동 대상. 없으면 파티 전체나 상황 자체를 향한다. */
  target?: Target;
  /** "성직자의 신뢰를 얻는다"처럼 플레이어에게 알려주는 기대치다. */
  expectedGain: string;
  /** "발각되면 처형" — 위험을 완전히 숨기지 않는다. */
  knownRisk: string;
}
```

`DungeonEvent`에 `choices: EventChoice[]`를 더한다. `Target`이 `info.ts`에 있으므로 `dungeon.ts`가 그것을 import한다. `info.ts`는 `dungeon.ts`를 import하지 않으므로 순환은 생기지 않는다.

`lib/domain/index.ts`의 barrel에 `ChoiceId`와 `EventChoice`를 추가한다.

## 확정하지 않고 넘기는 것

셋을 발견했다. 각각 주인이 따로 있으므로 이번 작업에서 고치지 않고 기록만 남긴다.

### 정산 결과 타입

⑥ 결과 화면이 보여줄 생존자·보상·영향을 준 선택 목록을 담을 도메인 타입이 없다. 이것은 `R5`가 계산해 보고 반환값을 설계할 일이다. 지금 화면 사정으로 모양을 박으면 `R5`를 제약한다.

`lib/mock/result.ts`에 결과 화면에서만 쓰는 뷰 타입을 두고, `R5`가 진짜 타입을 만들면 갈아탄다는 주석을 남긴다.

### 플레이어가 가진 정보 카드의 자리

`RunState`에 손패가 없다. `pendingClaims`는 이미 건넨 정보이고, 아직 손에 든 카드를 담을 필드가 없다. 그런데 ③ 선택 패널이 카드 3장을 보여줘야 한다.

`lib/mock/cards.ts`를 따로 두고 화면이 직접 읽는다. `RunState`에 손패를 넣을지, 아니면 카드 풀에서 매번 뽑을지는 `R3` 정보 카드 판정이 정할 일이다.

### 보스방이 `nodes`의 원소인가

`lib/domain/dungeon.ts`의 주석이 `nextNodeIds`에 대해 "빈 배열이면 보스전 직전이다"라고 쓰는데, `DungeonState`에 `bossNodeId`가 따로 있다. 보스방 자신이 빈 배열을 갖는 것인지, 보스방 앞 노드가 빈 배열인 것인지 두 가지로 읽힌다.

이번 작업은 **보스방이 `nodes`의 원소이며 `nextNodeIds`가 빈 배열**로 정한다. `bossFight` 단계에서 `currentNodeId`가 보스방을 가리킬 수 있어야 하므로 보스방이 `nodes` 안에 있어야 한다. 주석을 그 뜻으로 한 줄 고친다.

## 함께 갱신할 문서

| 문서 | 무엇을 |
| --- | --- |
| [온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md) | 6개 영역이 어느 화면에 사는지. 지도가 별개 화면이며 오간다는 것. 지도가 아래에서 위로 진행하고 입구가 한 곳이며 모든 경로가 보스방으로 모인다는 것. 조우 화면의 위가 자동 진행이고 아래가 조작이며 아래가 더 크다는 것 |
| [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md) | 이벤트가 선택지를 구조로 가진다는 것과 선택지의 세 요소 |
| [개발 환경](../../technical/DEVELOPMENT_ENVIRONMENT.md) | 라우트 목록. `components/ui`가 `lib/domain`을 import하지 않는 규약. 「Hello World 초기화 범위」 절이 지난 작업의 기록이라는 명시 |
| [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md) | `F5` 상태와 담당 |
| `lib/domain/dungeon.ts` | 보스방 주석 한 줄 |

### 배정표 갱신 시점에 관한 주의

`PROTOTYPE_WORK_ASSIGNMENT.md`는 현재 열려 있는 PR 두 개가 이미 고치고 있다. `#4`가 `선행` 열의 규약을 "남은 선행만 담는다"로 바꾸고, `#5`가 그 규약을 검사하는 테스트를 더한다. 이 브랜치는 `main`에서 갈라졌으므로 아직 옛 규약을 보고 있다.

같은 파일을 세 브랜치가 고치면 충돌이 난다. 따라서 배정표 갱신은 **구현이 끝나고 `main`과 동기화한 뒤 마지막에** 한다. 그 시점의 `main`에 어떤 규약이 들어 있는지 확인하고 그것에 맞춰 고친다.

## 검증

| 명령 | 기준 |
| --- | --- |
| `pnpm lint` | 통과 |
| `pnpm typecheck` | 통과 |
| `pnpm test` | 기존 테스트와 새 목 검사 모두 통과 |
| `pnpm build` | 통과. 라우트 5개가 빌드 출력에 나타남 — `/`, `/play`, `/play/map`, `/play/node/[nodeId]`, `/play/result` |

명령 외에 `pnpm dev`로 네 라우트를 실제로 열어 6개 영역이 모두 보이는지 눈으로 확인한다. 좁은 화면에서 사이드바가 아래로 내려가는지도 함께 본다.

## 이 작업이 하지 않는 것

- 애니메이션. `SceneStage`는 자리와 비율만 잡는다
- 버튼의 동작. 눌러도 아무 일이 없다
- 클라이언트 상태 관리. `F2`의 책임이다
- 실제 게임 규칙. `R1`~`R5`의 책임이다
- 화면 간 이동의 조건 판정. 링크로만 오간다. `P1`의 책임이다
- 아이콘·질감·아트 스타일
- 터치 조작 최적화
- 컴포넌트 렌더링 테스트

## 관련 문서

- [온보딩과 인터페이스](../../experience/ONBOARDING_AND_INTERFACE.md)
- [핵심 게임 루프](../../design/CORE_GAME_LOOP.md)
- [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
- [파티와 신뢰](../../systems/PARTY_AND_TRUST.md)
- [프로토타입 작업 배정표](../../technical/PROTOTYPE_WORK_ASSIGNMENT.md)
- [개발 환경](../../technical/DEVELOPMENT_ENVIRONMENT.md)
