# UI Task - U4 던전 지도

## 1. 작업 목적

- 던전의 전체 공개 경로와 보스 위치를 본다.
- 현재 위치와 지나온 길을 확인한다.
- 현재 위치에서 갈 수 있는 다음 지점을 고른다.
- 출전 파티원의 현재 상태를 확인한다.
- 선택한 지점으로 이동을 별도 CTA로 확정한다.

## 2. 이전 / 다음 화면

- 이전 화면: U3 게시판 우측 계약 완료
- 다음 화면: U5 던전 진행

## 3. 반드시 유지할 기존 UI

- `GameShell`
- `TopStatusBar`
- 좌 60% / 우 40%
- U3와 동일한 1920×1080 16:9 고정 캔버스 및 레터박스 동작
- 기존 U2/U3 다크 판타지 톤
- 초록/금색/붉은색의 기존 의미
- U3의 파티 정보 위계
- `/assets/u2/status-gold.svg`
- `public/assets/characters`의 공식 캐릭터 초상

## 4. 화면 구성

### 좌측 60%

- 상단: 던전명/지도 제목과 위험도
- 중앙 대부분: Entry 아래 → Boss 위로 진행하는 공간형 던전 지도
- 방과 복도를 이용해 분기/합류를 표현
- 범례는 두지 않음

### 우측 40%

- 상단: 파티 상태 카드 3개
- 중앙: 계약 전 답사로 공개된 생태 규칙 + 지나온 지점 수
- 하단: 선택한 다음 지점 정보 + 이동 CTA

우측 패널의 읽기 순서는 `파티 상태 → 계약 전 답사 → 선택한 지점 → 이
지점으로 이동`이다. `계약 전 답사`가 길어지면 중앙 영역 안에서 스크롤하고,
선택한 지점과 이동 CTA는 패널 최하단에 유지한다.

## 5. 필수 표시 정보

- 현재 위치
- 방문 완료
- 선택 가능한 다음 지점
- 지금 선택할 수 없는 다른 갈래
- 보스방
- 각 지점의 공개 사건 분류
- 파티원 이름/직업/성격/HP/신뢰/소지 골드
- 선택한 다음 지점

## 6. 표시하면 안 되는 정보

- 정확한 피해
- 정확한 보상
- 난수 결과
- 조언의 help/harm/neutral 유형
- 아직 물질화되지 않은 사건 콘텐츠 ID

## 7. 사용자 행동

1. 지도에서 선택 가능한 다음 방을 마우스 또는 키보드로 선택한다.
2. 우측 하단에서 선택한 방의 공개 정보를 확인한다.
3. `이 지점으로 이동` CTA로 이동을 확정한다.

`이 지점으로 이동` CTA의 눌림 판은 기본 판과 같은 버튼 경계 안에서만 겹쳐
표시한다. 버튼 아래나 다음 화면에 별도 이미지가 잔상처럼 나타나서는 안 된다.

## 8. 공식 데이터 source

- E1 `GeneratedMap`
- `ExpeditionState.currentNodeId`
- `ExpeditionState.visitedNodeIds`
- 실제 party member data
- 외부에서 주입되는 `publicKindByNodeId`
- Character `alive`, `classId`, HP, trust, gold

UI에서 지도 topology, 사건 콘텐츠, 사건 분류를 임의 생성하지 않는다.

`/u4-test`만 화면 검증용 deterministic `publicKindByNodeId` fixture를 사용한다.

### Depth 좌우 배치

U4는 E1의 NodeId와 `nextNodeIds`를 바꾸지 않고, 각 Depth의 좌우 순서만
결정적으로 재배치한다. Depth별 가능한 순서를 비교해 직선 통로의 전체 교차
수가 가장 작은 조합을 선택하며, 같은 최소값에서는 원래 `nodeIds` 순서와의
위치 차이가 작은 조합을 우선한다. 위치 차이도 같으면 원래 `nodeIds`를
기준으로 만든 후보 순서가 앞선 조합을 선택해 동일한 입력에 항상 같은
좌표를 반환한다.

순서 계산은 E1과 U4가 공유하는 `lib/rules/layered-map-crossing.ts`의 exact
solver를 thin adapter로 호출한다. U4 adapter는 `GeneratedMap`의 층과 인접
층 간선을 solver 입력으로만 변환하며 topology나 간선을 수정하지 않는다.

### 통로 기하 안전장치

solver가 0을 반환한 순서를 기준으로 방과 통로를 배치한 뒤, 렌더 좌표를
소수점 네 자리(`10_000`배 정수)로 고정해 closed-segment 교차를 검사한다.
같은 NodeId를 endpoint로 공유하는 분기·합류 통로 쌍은 교차로 세지 않는다.
방의 시각적 자연스러움을 위한 Y wobble에서 기하 교차가 발견되면 일반
Depth의 Y wobble만 제거한 fallback을 한 번 적용한다. fallback 뒤에도
교차가 남으면 `U4MapLayoutError`(geometricCrossingCount 포함)를 던지며,
U4가 topology를 재생성하거나 좌표를 임의 재추첨하지 않는다.

### 지도 레이어

비네팅은 배경과 atmosphere 위, corridor와 room 아래에서만 합성한다.
따라서 가장자리 암부는 유지하되 길과 방의 상태 표현을 덮지 않는다.

## 9. 기존 재사용 에셋

- `/assets/u2/status-gold.svg`
- `/assets/u2/status-rank.svg`
- `/assets/u2/status-reputation.svg`
- `/assets/u2/status-promotion.svg`
- 기존 TopStatusBar의 던전/위험도 표시 자산
- `/assets/characters/live/{class}/{class}_{a..f}.png`

## 10. 새 U4 에셋

`public/assets/u4/` 아래에 저장한다.

- 지도 배경/비네트/유적 분위기 조각
- 방 베이스 6종
  - entry
  - monster
  - rest
  - merchant
  - special
  - boss
- 방 의미 아이콘
- corridor 조각
- current/selectable/visited/inactive 상태 오버레이
- 선택 지점 panel/thumbnail frame
- CTA left/center/right/arrow

텍스트는 PNG에 굽지 않고 HTML로 표시한다.

## 11. 이미지 생성 시각 계약

### 참고할 GitHub 문서

- `docs/GAME_PRINCIPLES.md`
- `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
- `docs/experience/SCREEN_LAYOUT.md`
- `docs/experience/ONBOARDING_AND_INTERFACE.md`
- `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
- `docs/experience/CHARACTER_UI_ASSETS.md`

### 화풍 / 표현 방식

- 묘사 밀도: 기존 U2/U3와 연결되는 다크 판타지 고밀도 질감
- 재질감: 석재, 검은 금속, 짙은 목재, 금색 테두리
- 색 온도: 낮은 채도 + 따뜻한 횃불/금빛 광원
- 명암 대비: 지도 배경은 어둡게, selectable/current만 강한 대비

### 시점 / 카메라

- 지도: 탑다운/사선 탑다운 공간형 방
- 원근감: 방 자체에는 약한 입체감, 전체 UI는 읽기 쉬운 고정 시점

### 반드시 계승할 요소

- U3의 금색 frame과 암색 panel
- 초록=current, 금색=selectable, 붉은색=boss/danger 의미
- 실제 공간처럼 보이는 방/복도

### 금지 스타일

- 얇은 선 위의 원형 노드 그래프
- 별도 범례
- SaaS dashboard
- 기존 캐릭터 초상을 새 일러스트로 대체
- 전체 레퍼런스 한 장을 배경으로 박아 넣기

## 12. 에셋보드 사용 규칙

- 승인된 U4 투명 PNG 에셋을 우선 사용한다.
- 각 자산은 개별 UI 요소로 조합한다.
- 방 종류와 상태 effect를 분리한다.
- 캐릭터 원본 PNG는 수정/재저장하지 않는다.

## 13. 고정 캔버스 요구사항

화면은 U3와 동일하게 1920×1080 16:9 고정 캔버스 안에서 그린다.

필수 viewport:

- 1920×1080
- 2560×1440
- 1440×900
- 1280×1024

절대 발생하면 안 되는 것:

- 가로·세로 스크롤
- 60:40 비율 변화
- 창 크기에 따른 재배치
- 지도/CTA clipping
- 캐릭터 portrait 왜곡
- 새 `vw`, `vh`, 미디어 쿼리

## 14. UI 중요도

가장 중요한 정보:

1. 현재/다음 경로 상태
2. 파티 HP/신뢰/골드
3. 선택한 다음 지점과 이동 CTA

공간이 부족할 때 먼저 줄일 것:

1. 장식 여백
2. map atmosphere props
3. panel padding
4. 장식 아이콘
5. gap

마지막까지 유지할 것:

- 현재 위치
- selectable 방
- Boss 위치
- 파티 상태 수치
- CTA

## 15. 접근성

- selectable room은 실제 `button`
- `aria-pressed`
- `focus-visible`
- Enter/Space 선택
- 좌/우 방향키로 selectable 방 간 이동
- 색 외 marker/형태/텍스트 단서 제공

## 16. 캐릭터 초상 규칙

### 생존

- `/assets/characters/live/...`
- 직업과 일치하는 directory
- 같은 캐릭터는 로스터에 고정된 A–F variant
- 네모 1:1 slot
- `object-fit: cover`
- `object-position: 50% 0%`

### 사망

`alive === false`일 때만:

- 같은 live 초상화를 유지하고 카드 상태와 텍스트로 사망을 표시
- portrait 및 card를 grayscale/저채도 처리
- `사망` 텍스트 또는 형태 단서 표시

신뢰 0, 중상, 미출전 상태는 dead 이미지를 사용하지 않는다.

## 17. 구현 및 검증

- [x] 관련 문서/현재 E1/U1/U3 코드 확인
- [x] 기존 에셋 검색
- [x] U4 ViewModel 테스트
- [x] U4 layout 테스트
- [x] component interaction/accessibility 테스트
- [x] live/dead portrait 테스트
- [x] 16:9 고정 canvas 테스트
- [x] 1920×1080 브라우저 캡처
- [x] 2560×1440 또는 QHD 캡처
- [x] 1440×900 검증
- [x] 1280×1024 검증
- [x] lint
- [x] typecheck
- [x] test
- [x] build

## 18. 완료 조건

- [x] E1 실제 지도를 공간형 dungeon으로 렌더링
- [x] Entry 아래 / Boss 위
- [x] Depth 1~5개 방 표현
- [x] 예시 화면에는 연속 5→5를 사용하지 않음
- [x] 범례 없음
- [x] current/visited/selectable/inactive/boss 구분
- [x] keyboard next-node selection
- [x] 파티원 3명 실제 캐릭터 asset 사용
- [x] 직업과 portrait 일치
- [x] 사망자 dead asset + 회색 처리
- [x] U3와 동일한 16:9 고정 전체 화면
- [x] 우측 CTA로 이동 확정
- [x] `/u4-test` 제공
- [x] 사용자 확인용 브라우저 캡처 제공
- [x] feature branch commit
- [x] 사용자 요청 전 PR 생성 금지
# 초상화 규칙 변경 (2026-08-26)

U4 파티 카드는 `portraitSrcForCharacterId`를 통해 공식 로스터의 live 초상화를
사용한다. `alive === false`여도 같은 초상화를 유지하고 카드의 사망 상태와 `사망`
표시로만 구분한다. 사망 전용 초상화 파일 경로는 사용하지 않는다.
