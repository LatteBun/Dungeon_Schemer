# P1 게임 상태 머신 실행 계획

> 상태: **제품 요구사항 대체됨**
> 캠페인 게시판부터 정산·엔딩까지의 상태 전이는 [게임 방향 개편 설계](../specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md)를 따른다. 이 문서는 기존 구현의 역사 기록으로 보존한다.

- 작성일: 2026-08-13
- 작성자: sbh3821
- 근거 spec: [게임 상태 머신 설계](../specs/2026-08-13-sbh3821-game-state-machine-design.md)

## 단계

1. **전이 함수 구현**
   - `lib/flow/run-machine.ts`: `RunAction`, `RunMachineContext`, `transitionRun`
   - 검증을 상태 생성 전에 실행. 거부는 단계·행동·ID를 담은 `Error`
   - `lib/domain`만 의존한다
2. **초기 런 생성 구현**
   - `lib/flow/initial-run.ts`: `INITIAL_RESOURCES` 잠정 상수,
     `createInitialRun(seed, options?)`
   - `createRng(seed)`의 `party`·`dungeon` 파생 스트림으로 R1·R4를 결합
3. **테스트 작성**
   - `lib/flow/run-machine.test.ts`: 전체 여정(세 경로 형태), 재현성,
     불변성, 로그 기록, 거부 조건
   - `lib/flow/initial-run.test.ts`: 초기 상태 계약, 시드 재현, 자원 옵션
   - 테스트 규약 준수: `@/` 임포트, `vitest` 명시 임포트, 한국어 설명
4. **공식 문서 갱신**
   - `docs/design/CORE_GAME_LOOP.md` "한 판의 진행 단계"에 전이 규칙 반영
     (입구 이벤트 시작, 경로·이벤트 반복, 보스방 도달 시 보스전 진입)
5. **배정표 갱신**
   - P1 담당 `sbh3821`, 상태 갱신, 선행 열 규칙 적용 후 `pnpm test`
6. **검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` 통과 확인

## 완료 기준

- 파티 등장 → 경로 선택 → 이벤트 → 다음 노드 → 보스전 진입 전이 테스트 통과
- 잘못된 전이가 모두 거부되고 상태를 바꾸지 않음
- 같은 시드·같은 행동 순서 → 같은 상태 재현
- 병합 전 검증 명령 넷 통과
