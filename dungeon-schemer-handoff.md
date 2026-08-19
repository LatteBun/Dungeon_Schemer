# Dungeon Schemer 인수인계 메모

작성 2026-08-12 · git에 올리지 않는 개인 파일 · 위치 `~/dungeon-schemer-handoff.md`

---

## 0. 새 세션 시작할 때 붙여넣을 것

아래 블록만 붙여넣으면 대화를 이어갈 수 있다.

```text
프로젝트: Dungeon Schemer — 한국어 로그라이크 전략 게임.
플레이어는 용사 파티와 던전 보스 사이에서 정보를 거래하는 "던전 길잡이"다.

저장소: LatteBun/Dungeon_Schemer. 3인 팀 — LatteBun(소유자), QuaintCoding, sbh3821.

기술: Next.js 16.3.0 App Router(루트 app/), React 19.2.8, TypeScript 5.9.3 strict,
Tailwind CSS 4.3.3, Vitest 4.1.10(environment: node), pnpm 11.21.0, Node 24.19.0.
검증은 pnpm lint / typecheck / test / build 넷.

작업 규칙(AGENTS.md): 브레인스토밍 → 설정집 확인·갱신 → spec(사용자 검토)
→ plan → 구현. 커밋 메시지는 제목+본문 한글. main 직접 push 금지,
feature/<작업명> 브랜치와 PR.

진행 상황(2026-08-12): F1 도메인 타입, F3 랜덤 시드, F4 테스트 도구,
F5 화면 셸 완료(전부 LatteBun). R1 파티 생성 진행 중(sbh3821).
시작 가능: F2 상태 스토어, R2 신뢰 판정, R4 이벤트·경로, Q3 Vercel 배포.
PR #1~#7 전부 병합. 열린 PR 없음.

주의 셋:
1. main은 팀원 승인 1개 필요. 본인은 자기 PR을 승인할 수 없다.
   승인받은 뒤 그 브랜치에 push하면 승인이 날아간다.
2. PR을 쌓지 마라. 항상 main에서 브랜치를 딴다.
   3단 스택으로 merge-base 문제가 터진 적 있다.
3. docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md는 여러 PR이 건드린다.
   작업 마지막에 main 동기화 후 고친다. pnpm test가 규약을 검사한다.

먼저 읽을 것: AGENTS.md, docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md,
docs/README.md

시작 전에 git log --oneline -5 와 gh pr list 로 실제 상태를 확인해줘.
```

---

## 1. 게임이 무엇인가

플레이어는 전투의 주인공이 아니다. 용사 파티에 고용된 **길잡이**이며, 정보를 골라 전달해서 파티와 던전 양쪽에 개입한다.

핵심 차별점은 **파티원마다 신뢰가 따로 간다**는 것이다. 파티 전체 호감도 하나가 아니라 개인별 수치이고, 같은 행동이 성격에 따라 다른 증감을 낸다. 이게 재미없으면 나머지를 만들 이유가 없다.

정보에는 진실·거짓·중립 세 유형이 있고 각각 위험과 보상이 다르다. 거짓은 발각되면 신뢰가 떨어지고 결국 처형으로 이어질 수 있다(신뢰 0 = 정체 발각).

## 2. 사람과 분배

| 사람 | 역할 | 2026-08-12 기준 |
| --- | --- | --- |
| `LatteBun` | 레포 소유자, 사용자 | L0 기반 4개(F1 F3 F4 F5) 완료 |
| `sbh3821` | 팀원 | `R1` 파티 생성 진행 중 |
| `QuaintCoding` | 팀원 | 배정된 행 없음. PR 리뷰·병합 담당해 왔음 |

`QuaintCoding`에게 넘길 독립 작업을 함께 제안하면 좋다. `F5`가 끝났으므로 `U1`~`U4` 화면 작업이 곧 열린다.

## 3. 개발 환경

| 도구 | 버전 | 고정 위치 |
| --- | --- | --- |
| Node.js | 24.19.0 | `.nvmrc`, `package.json engines`, `.devcontainer/devcontainer.json` |
| npm | 11.17.0 | Node에 딸려 옴 |
| pnpm | 11.21.0 | `package.json packageManager` |

**Codespace의 Node는 nvm으로 올린 것이다.** 기본 이미지는 24.14.0을 담고 있었고, 컨테이너 재빌드 대신 nvm으로 24.19.0을 깔았다. `/home/codespace/nvm/current` 심볼릭 링크가 갱신돼 새 셸도 받는다. **새 Codespace를 만들면 다시 해야 할 수 있다.** 버전이 어긋난 채 빌드 문제를 오래 뒤지지 않도록 주의.

검증 명령 넷을 PR 전에 모두 돌린다.

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

`pnpm test:watch`는 개발 중에만 쓴다. 검증에는 한 번 돌고 끝나는 `pnpm test`를 쓴다.

Vitest 설정은 `vitest.config.mts`다. 확장자가 `.mts`인 이유는 Vite가 `.ts` 설정을 CommonJS로 읽어 ESM 경고를 내기 때문이다. Vitest는 tsconfig의 `paths`를 읽지 않으므로 `@/` 별칭을 `resolve.alias`가 따로 맞춘다 — **새 별칭을 추가할 때 두 파일을 함께 고쳐야 한다.**

## 4. 작업 규칙

`AGENTS.md`가 강제하는 순서다. 사용자가 이걸 엄격하게 지키게 한다.

1. `superpowers:brainstorming`으로 설계 합의
2. `docs/README.md`, `docs/GAME_PRINCIPLES.md`, 관련 공식 문서 확인하고 필요하면 설정집 갱신
3. spec 작성 → 사용자 검토·승인
4. plan 작성
5. spec과 plan이 모두 있어야 구현 시작

파일명 규칙:

```text
spec: docs/superpowers/specs/YYYY-MM-DD-<작성자>-<주제>-design.md
plan: docs/superpowers/plans/YYYY-MM-DD-<작성자>-<기능>.md
```

작성자 slug는 `git config user.name`을 소문자 ASCII 영숫자로 정규화한 것 = `lattebun`. AI 도구 이름은 파일명에 넣지 않고 문서 본문의 "작성 도구" 항목에 적는다.

커밋 메시지는 **제목과 본문 모두 한글**이다. 본문에 "왜"를 쓴다.

## 5. 지금까지의 결과

PR `#1`~`#7`이 전부 병합됐다. 열린 PR 없음. `main` = `5cb3a75`.

| PR | 내용 |
| --- | --- |
| #1 | 배정표에 의존성과 구현 순서 추가 |
| #2 | `F1` 도메인 타입 정의 |
| #3 | `F4` 테스트 도구 도입 (Vitest) |
| #4 | `F3` 랜덤 시드와 재현성 |
| #5 | 배정표 무결성 검사를 `pnpm test`에 추가 |
| #6 | `R1` 파티 생성 규칙 |
| #7 | `F5` 화면 셸과 6개 화면 영역 |

### 배정표 현황 (20행)

- **완료 4** — `F1` `F3` `F4` `F5`
- **진행 중 1** — `R1` (sbh3821)
- **시작 가능 4** — `F2` `R2` `R4` `Q3`
- **막힘 11** — `R3` `R5` `P1` `P2` `U1`~`U5` `Q1` `Q2`

## 6. 확정된 설계 결정

### 도메인 타입 (`lib/domain/`)

**브랜디드 ID.** `Brand<T, B>`를 `unique symbol`로 만들어 `MemberId`를 `NodeId` 자리에 넣을 수 없게 했다. 런타임 비용 없음. 생성 함수는 아직 없어서 `"m-1" as MemberId`로 캐스트한다.

**닫힌 유니온 vs 열린 데이터의 하이브리드.** 규칙이 분기하는 개념은 닫힌 유니온으로 고정하고, 콘텐츠는 열어 둔다.

| 닫힘 (규칙 변경) | 열림 (콘텐츠 추가) |
| --- | --- |
| `Personality` 5종 | `ClassDef` 직업 |
| `TruthType` 3종 | `InfoCard` 카드 |
| `EventKind` 4종 | `DungeonEvent` 개별 이벤트 |
| `RunPhase` 6단계 | |

`as const satisfies readonly T[]`를 써서 `.length`가 리터럴 타입으로 남는다. 그래서 `const n: 5 = PERSONALITIES.length` 같은 컴파일 시점 검사가 된다.

**`RunState`는 중첩 구조이며 정규화하지 않는다.** 이벤트 소싱도 아니다. `log`는 추가 전용 `DecisionRecord[]`이고 `at`은 **로그 순번이지 시각이 아니다** — 시각을 쓰면 재현성이 깨진다.

`lib/domain/__checks__.ts`는 컴파일 성공 자체가 검사다. 런타임에 실행하지 않는다. 모든 값을 export하는 이유는 `no-unused-vars`를 피하기 위함이다.

### 난수 (`lib/rng/`)

mulberry32 + FNV-1a 해시(murmur3 최종 혼합). 혼합 단계가 없으면 `seed-1`과 `seed-2`가 비슷한 수열을 낸다.

**파생 스트림이 핵심이다.** `derive("party")`는 부모의 *현재 상태*가 아니라 *시드 문자열*에서 새 생성기를 만든다(`${seed}/${stream}`). 그래서 한 시스템이 난수를 몇 번 뽑든 다른 시스템의 결과가 바뀌지 않는다. 이걸 고정하는 테스트가 있다 — 지우지 말 것.

스트림 이름은 유니온(`"party" | "dungeon" | "card" | "trust"`)이다. 문자열을 그대로 받으면 `derive("prty")` 오타가 조용히 다른 스트림을 만든다.

`Math.random` 직접 호출은 eslint `no-restricted-syntax`로 차단된다. `lib/rng` 자신도 안 쓴다.

### 화면 (`app/`, `components/`)

라우트 5개.

```text
/                        → /play 리다이렉트
/play                    파티 소개·던전 입장
/play/map                던전 분기 지도
/play/node/[nodeId]      조우 화면 (장면 + 선택)
/play/result             결과 화면
```

`app/play/layout.tsx`가 **셸**이다. 자원 바(①)와 파티 사이드바(④)를 들고 네 화면이 공유한다. 그래서 `U1`은 개별 화면이 아니라 셸 작업이다.

**import 경계 둘을 eslint가 강제한다.**

- `components/**`는 `@/lib/mock`을 가져오지 않는다. 목을 읽는 곳은 `app/**`뿐이고 props로 넘긴다. → `F2`·`P1`이 붙을 때 컴포넌트를 안 고친다.
- `components/ui/**`는 추가로 `@/lib/domain`을 가져오지 않는다. 프리미티브가 게임을 모르게 유지한다.

디자인 토큰은 `app/globals.css`의 `@theme`에 있다. 새 색을 화면에서 고르지 말고 토큰을 늘린다.

**색으로만 뜻을 전달하지 않는다.** 신뢰 변화는 색 + `▲`/`▼` 기호 + 스크린 리더용 텍스트 셋을 쓴다. 이벤트 분류도 기호가 따로 있다. `Q2` 접근성 점검을 미리 지키는 것.

Next.js 16에서 `params`는 **Promise**다. `await`해야 한다. `PageProps<'/route'>` 전역 도우미는 `next dev`/`next build`가 만든 타입에 의존하므로, 빌드 산물 없이 `pnpm typecheck`만 돌려도 통과하도록 타입을 명시한다.

### 던전 지도의 방향

초기 와이어프레임(`docs/initialization/proto_image.png`) 해석이 확정됐다.

```text
        ★ 보스방          어느 경로로 가든 여기로
      ╱   │   ╲
     ○    ○    ○
     │    │    │
     ○    ○    ○
      ╲   │   ╱
        ○              입구, 한 곳
```

**아래에서 위로** 진행한다. 입구는 한 곳이고 보스방도 한 곳이다. 보스방은 `nextNodeIds`가 빈 유일한 지점이며 `nodes`의 원소다. 지도는 사이드 패널이 **아니라 별개 화면**이고 조우 화면과 오간다.

조우 화면은 위가 자동 진행 관람(애니메이션 자리, 아직 정지 화면), 아래가 플레이어 조작이다. **아래를 더 크게** 둔다.

## 7. 반드시 피할 것 셋

### 7-1. PR을 쌓지 마라

`#2` → `#3` → `#4`를 3단으로 쌓았다가 하루를 잃었다. `#1`이 병합되자 나머지가 `The merge-base changed after approval`로 막혔고, `#4`는 head SHA가 그대로인데 승인이 반복 해제됐다. **마지막 해제는 끝내 원인을 못 찾았다.** `git merge origin/main`으로 동기화하니 풀렸다.

→ 작업 시작 전 `git checkout main && git pull`. 막히면 진단을 오래 끌지 말고 **main 동기화를 먼저** 해라.

### 7-2. 승인받은 브랜치에 push하지 마라

규칙셋 "Protect main"(id `20701082`) 설정:

- `required_approving_review_count: 1`
- `dismiss_stale_reviews_on_push: true` ← 이것
- `require_last_push_approval: false`
- `bypass_actors: []`, `current_user_can_bypass: "never"`
- classic branch protection 없음

`LatteBun`은 자기 PR을 승인할 수 없다. `QuaintCoding` 또는 `sbh3821`이 승인해야 한다. 승인받은 뒤 커밋을 하나라도 더 올리면 날아간다 — 고칠 게 생기면 별도 PR로.

### 7-3. 배정표를 여러 브랜치에서 동시에 고치지 마라

`docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`는 작업이 끝날 때마다 상태를 갱신하므로 잘 부딪친다. **작업 마지막에 main과 동기화한 뒤** 고친다.

배정표 규약:

- `선행` 열은 **아직 안 끝난** 선행만 담는다. `—`이고 `⬜`이면 지금 시작 가능
- 상태를 `✅`로 바꿀 때 그 ID를 다른 행의 `선행`에서 지운다
- `풀리는 것`은 완료 여부와 무관한 전체 구조. `선행`의 역방향이 **아니다**
- **의존성 그래프(mermaid)가 전체 구조의 단일 출처다**
- `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.test.ts`가 `pnpm test`에서 이 규약을 검사한다

## 8. 습관 하나

**검사를 만들면 발동을 확인한다.** 통과하는 테스트는 "검사가 아무것도 안 하고 있다"와 구별되지 않는다. 일부러 위반을 넣어 잡히는지 보고, 확인 내용을 커밋·PR 본문에 적는다.

지금까지 이렇게 검증한 것:

- `Math.random` 금지 eslint 규칙
- 배정표 무결성 검사 — 변형 6가지
- 목 데이터 검사 — 변형 3가지 (합류 없애기, depth 거꾸로, 고아 노드)
- import 경계 규칙 둘 — 탐침 파일

확인이 끝나면 **반드시 되돌리고** `git diff --stat`으로 복원을 확인한다.

## 9. 다음에 할 것

시작 가능한 넷 중 추천 순서.

**`R2` 개인 신뢰 판정 — 1순위.** 남은 최장 경로의 시작점이다.

```text
R2 → R3 → R5 → P2 → U4 → Q2   6단계
R4 → R5 → P2 → U4 → Q2        5단계
F2 → P1 → P2 → U4 → Q2        5단계
```

`R3`은 `R2`만 기다리고 있고, `R3` 없이는 `R5`도 `P2`도 못 간다. 그리고 **이게 게임의 정체성이다** — "같은 행동이 성격별로 다른 증감을 낸다"가 이 게임의 핵심 차별점이고, 여기가 재미없으면 나머지를 만들 이유가 없다. `F1`의 `Personality` 5종과 `TrustChange`가 실제로 쓸 만한 모양인지도 여기서 처음 검증된다.

`sbh3821`의 `R1`과 파일이 겹치지 않는다.

**`R4` 이벤트·경로 생성 — 2순위.** `R5`와 `P1`과 `U3`를 푼다. `F5`에서 만든 목 지도(`lib/mock/dungeon.ts`)가 이미 목표 모양을 보여준다 — 입구 1 → 3갈래 → 합류 → 보스방, 노드 7개 간선 9개. `R4`는 그걸 시드로 생성하면 된다.

**`F2` 상태 스토어 — 3순위.** `P1`만 푼다. 급하지 않지만 `P1`이 흐름 트랙의 병목이라 `R4`와 함께 가면 좋다.

**`Q3` Vercel 배포 — 아무 때나.** 반나절 이하. 데모 URL이 필요하면 지금.

### `R2` 시작할 때 미리 알아둘 것

- `PARTY_AND_TRUST.md`가 공식 기준이다. 신뢰 0~100, 0은 정체 발각
- `TrustChange`는 `{ memberId, delta, reason }`. **`reason`이 필수다** — 인터페이스 문서가 "숫자만 변하지 않도록 이유를 함께 보여준다"고 정했고 `Q2`가 이걸 검사한다
- 성격 5종은 닫힌 유니온이다. `Record<Personality, ...>`로 쓰면 성격 추가 시 컴파일이 실패해서 누락을 막는다
- `R2`는 `F3` 난수를 쓸 수도 있다. 쓴다면 `createRng(seed).derive("trust")` 스트림을 쓴다

## 10. 관련 문서 위치

| 문서 | 내용 |
| --- | --- |
| `AGENTS.md` | AI 작업 지침. 필수 순서와 파일명 규칙 |
| `docs/README.md` | 문서 구조 |
| `docs/GAME_PRINCIPLES.md` | 게임 원칙 |
| `docs/design/CORE_GAME_LOOP.md` | 루프 8단계, 프로토타입 6단계, 자원 3종 |
| `docs/design/GAME_OVERVIEW.md` | 게임 개요 |
| `docs/systems/PARTY_AND_TRUST.md` | 파티와 신뢰 — `R2`의 기준 |
| `docs/systems/INFORMATION_AND_DECEPTION.md` | 정보와 기만 — `R3`의 기준 |
| `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md` | 던전 이벤트와 보스 — `R4`의 기준 |
| `docs/systems/PROGRESSION_AND_ENDINGS.md` | 성장과 엔딩 (프로토타입 범위 밖) |
| `docs/experience/ONBOARDING_AND_INTERFACE.md` | 6개 화면 영역, 화면 구성, 30초 온보딩 |
| `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md` | **배정표. 의존성 그래프가 단일 출처** |
| `docs/technical/TEAM_DEVELOPMENT_WORKFLOW.md` | 브랜치·PR 절차 |
| `docs/technical/DEVELOPMENT_ENVIRONMENT.md` | 런타임, 테스트 규약, 화면 구조, import 경계 |
| `docs/technical/AI_DEVELOPMENT_PRECHECK.md` | AI 작업 전 점검 |
| `docs/superpowers/specs/` | 작업별 spec 10개 |
| `docs/superpowers/plans/` | 작업별 plan 8개 |

프로토타입 범위 밖(배정표에 행 없음): 8단계 성장과 능력치, 4가지 엔딩 판정, 던전 장기 상태 이월, 저장·복원과 Supabase, 로그인.
