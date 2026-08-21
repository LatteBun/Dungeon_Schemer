# U3 타입 검증 및 공고 카드 레이아웃 보정 설계

## 문서 정보

- 작성자: SangHwan Yoo
- 작성 도구: ChatGPT
- 작성일: 2026-08-21
- 대상 작업: U3 게시판·계약 화면의 typecheck/build 통과와 공고 카드 반응형 보정
- 기준 브랜치: `pr/70-u3-guild-board`

## 1. 문제와 목표

PR #70 최신 상태에서 다음 문제를 해결한다.

1. `pnpm typecheck`와 `pnpm build`가 `components/game/u3-board-model.test.ts:73`의
   `TS7053`으로 실패한다.
2. U3 공고 카드가 넓은 화면과 짧은 세로 화면에서 장면 이미지와 보상·환경·상태
   문구를 안정적으로 배치하지 못해 텍스트가 겹쳐 보인다.
3. U3 화면만 수정하는 작업에서 캠페인 규칙 백테스트를 필수 검증으로 오해하지
   않도록 검증 범위를 명확히 한다.

완료 목표는 다음과 같다.

- 도메인의 `CharacterId` 키 계약을 U3 화면 모델까지 보존한다.
- `pnpm typecheck`와 `pnpm build`가 통과한다.
- 공고 카드의 하단 텍스트 행은 고정 영역으로 남고 장면 이미지 행만 남는
  공간을 사용한다.
- 장면 이미지와 카드 내 텍스트의 크기를 기준 해상도와 대화면에서 읽을 수 있는
  범위로 제한한다.
- 1280×720과 1024×640에서 가로 스크롤을 만들지 않고, 첨부된 넓은 화면에서도
  공고 카드의 텍스트 겹침이 재현되지 않는다.

## 2. 근거와 범위

근거 문서는 다음과 같다.

- `docs/GAME_PRINCIPLES.md`
- `docs/experience/SCREEN_LAYOUT.md`
- `docs/superpowers/specs/2026-08-21-sanghwan-yoo-u3-guild-board-design.md`
- `docs/superpowers/plans/2026-08-21-sanghwan-yoo-u3-guild-board.md`
- `docs/technical/PROTOTYPE_WORK_ASSIGNMENT.md`
- `docs/technical/BACKTEST_REPORT.md`

이번 변경은 화면 모델의 타입 보존과 CSS 레이아웃 보정만 다룬다. 캠페인 규칙,
보상 수치, 상태 머신, 콘텐츠, 백테스트 시뮬레이터는 변경하지 않는다.

## 3. 타입 계약 보정

`lib/domain/pool.ts`의 캐릭터 풀은 `Readonly<Record<CharacterId, Character>>`를
사용하지만 `U3PartyMemberView.id`와 `U3PortraitMap`은 일반 `string`을 사용하고
있다. 이 불일치 때문에 테스트에서 화면 모델의 멤버 ID를 캐릭터 풀에 인덱싱할
때 TypeScript가 문자열 인덱스를 거부한다.

다음과 같이 경계를 맞춘다.

- `U3PartyMemberView.id`를 `CharacterId`로 변경한다.
- `U3PortraitMap`을 `Readonly<Partial<Record<CharacterId, string>>>`로 변경한다.
- `createU3BoardView`가 `character.id`를 그대로 반환하도록 유지한다.
- 렌더링용 공고 ID와 선택 상태는 현재 화면 계약을 유지하며, 이번 작업에서
  불필요한 전체 ID 타입 개편은 하지 않는다.

이 변경은 런타임 데이터나 직렬화 형식을 바꾸지 않고, 캐릭터 식별자가 실제
도메인 키라는 사실을 타입에 반영한다.

## 4. 공고 카드 레이아웃 보정

### 4.1 행 분배

현재 반응형 override는 공고의 일곱 자식 행 중 장면 이미지 행을 `auto`로 두고
환경 특성 행을 `minmax(0, 1fr)`로 둔다. 이 순서는 하단 정보가 남는 공간을
소비하게 해 이미지와 텍스트가 압박될 때 시각적 겹침을 만든다.

공고의 DOM 순서에 맞춰 다음 행 계약을 사용한다.

```text
heading → risk → scene(flexible) → reward label → reward → environment → state
auto      auto    minmax(0,1fr)    auto          auto      auto          auto
```

장면 행에는 `min-height: 0`을 적용하고 장면 비네트에는 `max-height: 100%`를
적용해 카드가 짧아질 때 이미지가 남는 공간 안에서만 축소되도록 한다. 환경
특성과 상태 문구는 이미지 행 밖에 남긴다.

### 4.2 대화면 크기

`@media (min-width: 90rem)`에서 대화면용 장면 비네트의 최대 폭을 현재 값보다
낮춰 카드 한 장의 세로 공간을 확보한다. 이미지 비율은 기존 16:9를 유지한다.
보상·환경·상태 텍스트는 기존의 정보 위계를 유지하되 과도하게 커지지 않도록
카드 전용 clamp 상한을 낮춘다. 제목과 위험도 별은 식별 가능하도록 유지한다.

### 4.3 짧은 세로 화면

기존 `max-height: 54rem`과 `max-height: 46rem` 보정에도 동일한 행 순서를
적용한다. 패널의 3:2 열 비율과 게시판의 3장/2장 배치는 유지하며, 화면을
세로로 스크롤하게 만드는 대신 카드 내부 장면과 간격을 먼저 줄인다.

## 5. Backtest 범위 판단

`pnpm backtest`는 `vitest.backtest.config.ts`에서 `**/*.run.ts` 실행기를 찾는
C7 캠페인 전이·밸런스 검증 명령이다. 현재 U3 변경은 `lib/rules`,
`lib/backtest`, 보상 상수, 상태 전이를 건드리지 않으며 실행기 파일도 없으므로
이 작업의 필수 검증에 포함하지 않는다.

다음 작업에서 캠페인 전이, 규칙, 밸런스 상수, 백테스트 보고서를 변경할 때는
별도의 설계 근거와 함께 `pnpm backtest`를 실행한다.

## 6. 테스트 및 검증

자동 검증:

- `components/game/u3-board-model.test.ts`가 `CharacterId` 타입 경계를 통해
  캐릭터 풀 상태를 계속 검증한다.
- `components/game/U3Assets.test.ts`에 공고 행 분배와 대화면 장면 제한의 CSS
  계약을 추가하거나 기존 기대값을 갱신한다.
- `pnpm test`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm build`

브라우저 검증:

- `/u3-test`에서 공고 선택과 우측 상세가 계속 렌더링된다.
- 1280×720과 1024×640에서 가로 스크롤이 없다.
- 첨부된 대화면 크기에서 공고 장면·보상·환경·상태 텍스트가 서로 겹치지 않는다.
- 잠긴 공고와 선택 공고의 기존 시각·접근성 상태가 유지된다.
- 콘솔 오류와 Next 오류 overlay가 없다.

## 7. 변경하지 않는 것

- `pnpm backtest` 설정이나 캠페인 백테스트 산출물
- U3 보상 수치와 계약 결과 규칙
- C2 공고 생성과 파티 편성
- GameShell의 60:40 비율
- 공고의 정보 목록, 자산 매핑, 접근성 상태 표현
