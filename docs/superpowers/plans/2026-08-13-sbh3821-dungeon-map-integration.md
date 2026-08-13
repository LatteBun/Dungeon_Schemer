# U3 던전 분기 지도 연동 실행 계획

> 상태: **제품 요구사항 대체됨**
> 등급별 전체 지도와 사건·정보 흐름은 [게임 방향 개편 설계](../specs/2026-08-13-sanghwan-yoo-game-direction-rework-design.md)를 따른다. 이 문서는 기존 구현의 역사 기록으로 보존한다.

- 작성일: 2026-08-13
- 작성자: sbh3821
- 근거 spec: [던전 분기 지도 연동 설계](../specs/2026-08-13-sbh3821-dungeon-map-integration-design.md)

## 단계

1. **경로 재구성 순수 함수**
   - `lib/flow/path.ts`: `reconstructPath(run)` — 입구 + 로그 `nodeId`의
     연속 중복 제거
   - `lib/flow/path.test.ts`: 시작 직후, 전체 여정, 중복 없음
2. **프로바이더와 훅**
   - `app/play/play-run-provider.tsx`: 마운트 후 `?seed=` 또는
     `createSeed()`로 `createInitialRun`, `GameStoreProvider` + 이벤트
     컨텍스트, `useRunTransition`
   - `app/play/phase-route.ts`: 단계 → 화면 매핑, 단계 가드 훅
3. **화면 연동**
   - `app/play/layout.tsx`: 프로바이더 적용, 스토어 기반
     `ResourceBar`·`PartySidebar`
   - `app/play/page.tsx`: 실제 파티 소개, 시드 표시, `enterDungeon`
   - `app/play/encounter/page.tsx`: 현재 노드 조우, `completeEvent`,
     보스전 안내
   - `app/play/map/page.tsx`: 실제 지도, `choosePath`
   - `components/game/DungeonMap.tsx`: 버튼 전환, 선택 가능·비활성 구분
   - `components/game/ChoiceList.tsx`: 선택 콜백, 카드 영역 분리
   - `app/play/node/[nodeId]` 제거
4. **배정표 갱신**
   - U3 담당 `sbh3821`, 상태 갱신, 선행 열 규칙 적용 후 `pnpm test`
5. **검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
   - 브라우저에서 같은 시드로 파티 소개 → 조우 → 지도 반복 → 보스방
     진입 확인, 비활성 노드·`?seed=` 재현 확인

## 완료 기준

- 지도에 현재 위치·지나온 경로·다음 경로가 실제 상태로 보인다
- 화면 선택이 모두 `transitionRun`을 거쳐 상태를 바꾼다
- 갈 수 없는 노드는 비활성이고 URL 우회도 단계 가드에 막힌다
- 병합 전 검증 명령 넷 통과
