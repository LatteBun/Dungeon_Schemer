# U4 거미굴 양피지 지도 배경 설계

## 문서 지위

이 문서는 기존 U4 던전 지도 화면의 **거미굴 테마 배경 표현을 장면형 배경에서 지도형 양피지 배경으로 교체**하기 위한 정식 설계다.

이 변경은 지도 topology, 사건 분류, 방 종류, 경로 선택 규칙, 파티 상태, 우측 패널, 이동 CTA의 의미를 바꾸지 않는다. E1과 탐험 계층이 제공하는 기존 데이터를 그대로 사용하고, U4의 표현 계층만 변경한다.

- 작성일: 2026-08-26
- 작성자: LatteBun
- 작성 도구: ChatGPT (GPT-5.6 Sol)
- 대상 화면: U4 던전 지도
- 대상 테마: `spider`

## 근거 문서

우선순위는 저장소의 공식 문서 규칙을 따른다.

1. `docs/GAME_PRINCIPLES.md`
2. `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
3. `docs/experience/SCREEN_LAYOUT.md`
4. `docs/experience/ONBOARDING_AND_INTERFACE.md`
5. `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
6. `docs/experience/U4_DUNGEON_MAP.md`
7. 기존 U4 구현과 에셋

핵심 근거는 다음과 같다.

- 플레이어는 던전을 미리 답사한 고블린 길잡이이며, 지도에서 전체 경로와 보스 위치를 읽고 다음 지점을 선택한다.
- U4는 `GameShell`, 60:40 구조, 1920×1080 고정 캔버스와 현재 상태 의미를 유지한다.
- 지도 배경은 방·통로·상태 오버레이보다 아래에 존재하는 표현 레이어다.
- 전체 완성 화면을 한 장의 이미지로 배경에 박지 않는다.
- 노드, 통로, 상태, 던전명, 위험도 등 실제 게임 정보는 DOM/UI 에셋으로 렌더링한다.

---

## 1. 문제

현재 U4에서 `themeId`가 존재하면 다음 U5 진행 장면 이미지를 지도 배경으로 재사용한다.

```text
/assets/u5/dungeon-progress-scenes/{themeId}/entry.png
```

이 방식은 거미굴이라는 장소 분위기를 전달하는 데는 효과적이지만, 플레이어가 보고 있는 화면이 **길잡이가 답사 결과를 펼쳐 보는 지도**라기보다 **던전 내부 장면 위에 노드가 떠 있는 화면**처럼 읽히기 쉽다.

또한 U5 장면 이미지는 원래 진행 장면을 위해 제작된 고밀도 배경이라, U4에서 어둡게 눌러도 노드와 통로 뒤에 실제 공간의 세부 묘사가 많이 남는다. 경로를 읽는 화면에서 배경이 정보 레이어와 시선을 경쟁한다.

따라서 거미굴 U4는 테마 현장감은 유지하되, 배경 자체의 역할을 **장면(scene)**에서 **답사 지도(map surface)**로 바꾼다.

---

## 2. 결정

거미굴 U4의 전용 배경으로 다음 PNG를 추가한다.

```text
public/assets/u4/map/map_background_spider_parchment.png
```

배경은 낡은 양피지와 동굴 벽이 결합된 다크 판타지 탐사 지도다.

### 시각 방향

- 중앙: 노드와 통로가 읽히는 저대비 양피지 면
- 가장자리: 어두운 동굴 석재와 그을음
- 상단 왼쪽 / 하단 오른쪽: 따뜻한 촛불 흔적
- 가장자리 일부: 거미줄
- 양피지 위: 희미한 동굴 윤곽, 손그림 탐사 흔적, 오래된 지도선
- 팔레트: 흑갈색, 암갈색, 빛바랜 황갈색, 낮은 채도의 금빛
- 현대적인 지도 앱, 플랫 벡터, 밝은 종이 UI처럼 보이지 않게 한다.

### 중앙 가독성

현재 U4 레이아웃은 대략 다음 안전 영역을 사용한다.

```text
x: 10% ~ 90%
y: 12% ~ 88%
```

새 배경은 이 영역에서 큰 소품이나 강한 명암 경계를 두지 않는다. 촛불·거미줄·석벽처럼 대비가 높은 장식은 주로 외곽에 남긴다.

배경의 희미한 동굴 스케치는 실제 `GeneratedMap`의 topology를 의미하지 않는다. 따라서 플레이 가능한 경로처럼 오인될 정도로 굵거나 밝은 연결선은 넣지 않는다.

### 실제 슬롯과 최종 자산 규격

U4 지도 면은 16:9 전체 캔버스가 아니라 `GameShell`의 좌측 60% 열에서 상단 상태
바, 셸 여백, 지도 제목 행을 제외한 영역이다. 현재 구현을 네 필수 viewport에서
측정하면 지도 면의 실제 비율은 `1.229:1 ~ 1.231:1`이며, 고정 캔버스 전체가
균일하게 축척되므로 viewport가 달라도 이 비율은 유지된다.

```text
1920×1080 viewport: 약 1113×905
2560×1440 viewport: 약 1484×1207
1440×900 viewport:  약 834×677
1280×1024 viewport: 약 741×602
```

따라서 구현에 사용하는 최종 PNG는 다음 계약을 지킨다.

- 목표 비율: 약 `1.23:1` (`1.22:1 ~ 1.24:1` 허용)
- 최소 해상도: `1500×1220`
- 권장 해상도: `1672×1360` 이상
- 표시 방식: `object-fit: cover`, `object-position: 50% 50%`
- 좌우의 찢긴 양피지 외곽, 촛불, 석벽을 의미 있게 잘라내지 않는다.
- 슬롯에 맞추려고 가로로 찌그러뜨리거나 상하 레터박스를 만들지 않는다.

PR #206에 먼저 추가된 `1672×941` 이미지는 팔레트, 재질, 조명, 소품 배치를
확정하는 **시각 기준본**이다. 구현 전에 이 기준본의 좌우 구성을 보존하면서 세로
방향으로 장면을 확장한 최종본으로 같은 경로의 파일을 교체한다. 단순 중앙 crop은
외곽 구성을 잃고, 비균일 scale은 양피지와 촛불을 찌그러뜨리므로 허용하지 않는다.

---

## 3. 합성 시안의 지위

이번 디자인 논의에서 제작한 **노드·통로·선택 상태까지 합성된 지도 시안**은 시각 방향을 확인하기 위한 참고 이미지다.

그 합성 시안을 런타임 배경으로 사용하지 않는다.

특히 다음 요소는 배경 PNG에 굽지 않는다.

- 던전명 또는 지도 제목
- 위험도 별
- Entry / Boss / 전투 / 휴식 / 상인 / 특수 사건 노드
- 현재 위치 초록 표시
- 선택 가능 금색 표시
- 선택 화살표
- 방문 상태
- 실제 경로와 통로

이 정보들은 현재 U4가 이미 보유한 DOM과 개별 에셋이 계속 소유한다.

즉, 합성 시안에서 계승하는 것은 **양피지 위에 던전 경로를 읽는 분위기와 명암 관계**뿐이다.

---

## 4. 테마별 배경 선택 계약

이번 변경은 거미굴 한 테마만 대상으로 한다.

| `themeId` | U4 배경 |
| --- | --- |
| `undefined` | 기존 `/assets/u4/map/map_background_base.png` 유지 |
| `spider` | 새 `/assets/u4/map/map_background_spider_parchment.png` |
| `desert` | 기존 `/assets/u5/dungeon-progress-scenes/desert/entry.png` 유지 |
| `graveyard` | 기존 `/assets/u5/dungeon-progress-scenes/graveyard/entry.png` 유지 |

거미굴 양피지를 사막이나 묘지에 공용으로 재사용하지 않는다. 테마별 지도 배경을 추가하려면 각 테마에 맞는 별도 에셋 승인을 거친다.

따라서 구현에서는 `themeId !== undefined` 하나로 모든 테마를 같은 경로에 넣지 않고, **거미굴 전용 분기**가 분명하게 드러나야 한다.

예상 형태는 다음과 같다.

```ts
const U4_MAP_BACKGROUND_BY_THEME = {
  spider: "/assets/u4/map/map_background_spider_parchment.png",
  desert: "/assets/u5/dungeon-progress-scenes/desert/entry.png",
  graveyard: "/assets/u5/dungeon-progress-scenes/graveyard/entry.png",
} as const satisfies Readonly<Record<ThemeId, string>>;
```

프리뷰처럼 `themeId`가 없는 경우만 기존 U4 기본 배경으로 돌아간다.

`satisfies Readonly<Record<ThemeId, string>>`로 닫힌 `ThemeId` 전체를 검사한다.
나중에 테마가 추가되면 U4 배경 계약도 함께 결정하지 않은 채 조용히 fallback하지
않고 타입 검사에서 멈춰야 한다.

---

## 5. 레이어 계약

기존 U4의 레이어 순서를 바꾸지 않는다.

```text
MapSurface
├─ background
├─ atmosphere
├─ vignette / surface shading
├─ corridor layer
└─ room / state layer
```

방과 통로가 항상 배경 장식보다 위에 있어야 한다.

### 거미굴 양피지 전용 처리

새 PNG 자체에 이미 다음 장식이 포함되어 있다.

- 동굴 석재 가장자리
- 촛불
- 거미줄
- 낡은 종이 가장자리

따라서 기존 `map_atmosphere_ruins_props.png`를 다시 강하게 겹치면 같은 역할의 장식이 중복된다.

`spider` 양피지 배경에서는 다음을 적용한다.

1. 공통 `.u4-map-surface__background`에 양피지 전용 `.is-parchment` modifier를
   추가하고, U5 장면용 `.is-themed`를 붙이지 않는다.
2. 새 배경에 blur를 추가하지 않는다. 양피지의 지도 질감은 읽을 수 있어야 한다.
3. `map_atmosphere_ruins_props.png`는 거미굴에서 CSS로 가리기만 하지 않고 DOM에
   렌더링하지 않는다.
4. 기존 vignette는 corridor/room 아래에 유지한다.
5. vignette가 외곽 촛불과 종이 가장자리를 지나치게 죽이면 배경 전용 modifier에서 vignette 강도만 낮춘다. 상태 노드나 통로의 필터 값은 이 작업에서 조정하지 않는다.
6. 배경, vignette 등 장식 레이어의 기존 `pointer-events: none`을 유지한다.

양피지 modifier와 관련 합성 값은 `app/u4-dungeon-map.css` 한 곳에서만 소유한다.
후행 로드되는 `app/u4-dungeon-map-fixes.css`에 같은 selector나 같은 속성을 다시
정의하지 않는다. 기존 후행 correction이 실제 최종값을 소유하는 속성을 반드시
바꿔야 한다면 먼저 기본 CSS의 중복 정의를 제거해 한 속성에 한 소유자만 남긴다.

핵심은 배경을 밝게 만드는 것이 아니라 **정보 레이어와 배경 레이어의 역할을 분리하는 것**이다.

---

## 6. 현재 U4 상태 표현 유지

배경 변경으로 다음 시각 의미를 바꾸지 않는다.

- current: 초록 + 현재 위치 marker
- selectable: 금색 + 선택 가능한 형태 단서
- selected: 금색 테두리 + 선택 marker
- visited: 저채도/회색
- inactive: 어두운 저명도
- boss: 기존 보스 방 종류와 상태 표현

배경이 황갈색이므로 selectable 금색이 이전보다 묻힐 가능성은 브라우저 캡처에서 확인한다. 문제 발생 시 배경의 명도/채도를 먼저 조정하고, 기존 상태 색의 의미를 임의로 바꾸지 않는다.

---

## 7. 게임 데이터와 로직 경계

이 변경은 다음을 수정하지 않는다.

- `GeneratedMap`
- NodeId
- `nextNodeIds`
- Depth 수
- 레이어 좌우 정렬
- 교차 최소화 알고리즘
- deterministic wobble
- Entry / Boss 위치
- `publicKindByNodeId`
- current / visited / selectable / inactive 판정
- 키보드 선택 순서
- 선택 확정 CTA
- 파티 상태

즉, 같은 시드와 같은 탐험 상태에서 **배경만 달라지고 지도 구조와 선택 결과는 완전히 동일**해야 한다.

### 기존 구조 재사용 경계

현재 데이터 흐름은 이미 필요한 테마를 제공한다.

```text
CampaignStore
→ CampaignState.dungeons
→ CampaignScreen이 active expedition의 dungeon을 조회
→ dungeon.theme
→ U4DungeonMapScreen.themeId
```

따라서 이 작업에서는 다음을 새로 만들지 않는다.

- Store state, action, selector
- `GeneratedMap` 또는 원정 타입의 theme 복제 필드
- rules/service 계층의 배경 선택 함수
- U4가 U5의 ViewModel에 의존하게 만드는 공용화
- 한 테마 예외만을 위한 새 전역 이미지 컴포넌트

배경 선택은 U4 표현 계층의 지역 상수 또는 순수 함수로 둔다. 사막·묘지 경로가
현재 U5 장면과 같더라도 U4에서 `u5-progress-model.ts`의 `sceneSrc`를 import하지
않는다. U4의 지도 배경 정책과 U5의 진행 장면 정책은 앞으로 독립적으로 바뀔 수
있으며, 문자열 세 개를 줄이려고 화면 모델 사이의 의존 방향을 새로 만들지 않는다.

---

## 8. 구현 대상

Spec 승인 뒤 구현에서 직접 다룰 파일은 다음 범위로 제한한다.

```text
public/assets/u4/map/map_background_spider_parchment.png
components/game/U4DungeonMapScreen.tsx
app/u4-dungeon-map.css
components/game/U4DungeonMapScreen.test.tsx
components/game/U4Assets.test.ts
components/game/U4FixedCanvas.test.ts
app/u4-test/page.tsx
components/game/U4Preview.tsx
app/u4-test/page.test.ts
e2e/u4-spider-parchment.spec.ts
docs/experience/U4_DUNGEON_MAP.md
docs/README.md
```

기존 테스트 파일에는 테마별 background source, class, 자산 존재, 레이어 단일
소유 계약을 추가한다. `/u4-test`는 query가 없으면 지금처럼 `themeId`를 주지 않는
기본 배경 프리뷰를 유지하고, `?theme=spider`일 때만 결정적인 거미굴 시각 검증
fixture를 제공한다. 이 query는 테스트/검토 경로일 뿐 캠페인 Store나 실제 원정
데이터 흐름을 대체하지 않는다.

다음 파일은 이 작업을 이유로 수정하지 않는다.

- `components/game/u4-dungeon-map-layout.ts`
- `components/game/u4-dungeon-map-model.ts`
- `components/game/campaign-adapters.ts`
- `lib/store/**`
- `lib/domain/**`
- `lib/rules/**`
- E1 지도 생성 규칙
- E3/E4 사건·전투 규칙
- U5 진행 장면 자산
- 우측 파티/답사/선택 패널
- `next/image` 전환 또는 U4 이미지 렌더링 전면 리팩터링
- `app/u4-dungeon-map-fixes.css`의 무관한 correction 규칙

---

## 9. 테스트 계약

구현 시 최소 다음 회귀를 자동 검증한다.

### 배경 선택

1. `themeId="spider"`이면 정확히 새 U4 양피지 PNG를 사용하고
   `.is-parchment`만 붙인다.
2. `themeId="desert"`이면 정확히 기존 desert entry 장면을 사용하고
   `.is-themed`를 유지한다.
3. `themeId="graveyard"`이면 정확히 기존 graveyard entry 장면을 사용하고
   `.is-themed`를 유지한다.
4. `themeId`가 없으면 기존 U4 기본 배경을 사용한다.
5. `U4_MAP_BACKGROUND_BY_THEME`의 key 집합은 `THEME_IDS`와 정확히 같다.
6. 새 양피지 파일이 존재하고 PNG signature와 최소 해상도·비율 계약을 만족한다.

### 레이어

7. 거미굴 양피지에서는 기존 ruins atmosphere가 DOM에 렌더링되지 않는다.
8. 사막·묘지·기본 프리뷰의 atmosphere 동작은 유지된다.
9. 양피지에 기존 `.is-themed`의 blur·brightness filter가 적용되지 않는다.
10. vignette, corridor, room의 기존 z-index 관계가 유지된다.
11. 배경과 장식 레이어는 `pointer-events: none`을 유지한다.
12. 양피지 합성 속성을 기본 CSS와 correction CSS가 중복 소유하지 않는다.

### 기존 동작 회귀

13. selectable room의 mouse click이 유지된다.
14. Tab / Enter / Space 선택이 실제 브라우저에서 유지된다.
15. 좌우 방향키 이동과 focus 이동이 실제 브라우저에서 유지된다.
16. `aria-pressed`와 `focus-visible`이 유지된다.
17. selected/current/visited/inactive 판정이 바뀌지 않는다.

현재 `U4DungeonMapScreen.test.tsx`는 `renderToStaticMarkup` 기반이므로 source와 DOM
계약을 검증하되 실제 key event를 실행할 수 없다. 14~16번은 Playwright에서
검증한다. 정적 테스트가 함수 호출만 확인하는 것을 키보드 상호작용 검증으로
간주하지 않는다.

---

## 10. 브라우저 시각 검증

기존 U4 고정 캔버스 규칙에 따라 다음 viewport를 확인한다.

- 1920×1080
- 2560×1440
- 1440×900
- 1280×1024

네 viewport에서 레이아웃은 동일하고 레터박스만 달라야 한다.

검증은 `/u4-test?theme=spider`의 결정적 fixture를 사용한다. 기존 공통
`canvas-layout.spec.ts`는 `/u4-test`를 포함하지 않고 `/campaign`에서도 지도까지
진입하지 않으므로, 거미굴 전용 Playwright spec에서 네 viewport를 명시적으로
순회한다. 별도로 실제 캠페인의 거미굴 계약 하나를 열어 production 데이터 흐름도
같은 U4 양피지 경로를 선택하는지 한 번 확인한다.

거미굴 화면에서 추가로 확인한다.

- Entry와 Boss가 양피지 안전 영역 안에 읽히는가
- current 초록 표시가 양피지 색에 묻히지 않는가
- selectable 금색 표시가 배경의 촛불/황갈색과 구분되는가
- inactive 갈래가 사라지지 않을 정도로 남는가
- 배경의 손그림 선이 실제 corridor로 오인되지 않는가
- 외곽 촛불과 거미줄이 방 아이콘을 침범하지 않는가
- 좌우 찢긴 양피지 외곽과 촛불이 슬롯 비율 때문에 잘리지 않는가
- 배경이 가로로 눌리거나 상하 레터박스를 만들지 않는가
- 우측 패널이나 TopStatusBar의 대비가 변하지 않는가
- 스크롤, clipping, 60:40 비율 변화가 없는가

---

## 11. 범위 밖

이번 Spec에는 다음을 포함하지 않는다.

- 사막 전용 양피지 지도 배경
- 묘지 전용 양피지 지도 배경
- 방 베이스/아이콘 재디자인
- corridor 재디자인
- 지도 topology 변경
- 경로 교차 최소화 알고리즘 변경
- 지도 제목 문구 변경
- 위험도 UI 변경
- 범례 추가
- 우측 패널 개편
- 배경 애니메이션
- 촛불 flicker 또는 거미줄 애니메이션

필요하면 거미굴 적용을 실제 화면에서 검증한 뒤 별도 작업으로 확장한다.

---

## 12. 완료 조건

이 작업의 구현은 다음을 모두 만족할 때 완료다.

- 거미굴 U4가 장면 사진이 아니라 낡은 답사 지도 위에서 경로를 읽는 화면으로 보인다.
- 최종 PNG가 약 1.23:1 슬롯 규격을 만족하고 좌우 양피지 외곽과 촛불을 보존한다.
- 새 배경 PNG만으로 topology나 상태 정보를 표현하지 않는다.
- 실제 노드·통로·상태는 기존 U4 UI가 계속 렌더링한다.
- 거미굴 이외 테마의 현재 배경 동작은 변경되지 않는다.
- U4의 지도 구조, 선택 규칙, 접근성, 우측 정보 구조가 그대로다.
- 네 고정 viewport에서 가독성·레이아웃 회귀가 없다.
- 전체 게임의 다크 판타지 재질과 따뜻한 금빛 조명 언어를 유지한다.

## Self-review

- `TBD`, `TODO`, 미확정 구현 항목 없음.
- 게임 규칙이나 데이터 계약을 새로 정의하지 않음.
- 합성 시안과 런타임 배경의 역할을 분리함.
- `spider`만 새 에셋을 사용하며 `desert`/`graveyard` fallback을 명시함.
- 실제 1.23:1 슬롯과 최종 에셋 해상도·crop 정책을 수치로 명시함.
- 현재 1672×941 기준본과 구현용 세로 확장 최종본의 지위를 분리함.
- 기존 U4의 고정 캔버스, 레이어, 접근성, 상태 의미와 충돌하지 않음.
- Store·domain·rules 비변경 경계와 U4→U5 ViewModel 의존 금지를 명시함.
- 정적 컴포넌트 테스트와 실제 브라우저 상호작용 테스트의 책임을 분리함.
