# U4 전 테마 공용 양피지 지도 배경 설계

## 문서 지위

이 문서는 [U4 거미굴 양피지 지도 배경 설계](2026-08-26-lattebun-u4-spider-parchment-map-background-design.md)의 후속 설계다. 기존 문서의 자산 규격, 레이어 순서, 데이터 경계, 접근성, 고정 캔버스 계약은 유지하고, **테마별 배경 선택과 atmosphere 계약만 이 문서가 대체한다.**

- 작성일: 2026-08-26
- 작성자: LatteBun
- 작성 도구: ChatGPT (GPT-5)
- 대상 화면: U4 던전 지도
- 대상 테마: `spider`, `desert`, `graveyard`

## 근거 문서

1. `docs/GAME_PRINCIPLES.md`
2. `docs/systems/DUNGEON_EVENTS_AND_BOSSES.md`
3. `docs/experience/SCREEN_LAYOUT.md`
4. `docs/experience/ONBOARDING_AND_INTERFACE.md`
5. `docs/experience/UI_IMPLEMENTATION_GUIDE.md`
6. `docs/experience/U4_DUNGEON_MAP.md`
7. 기존 U4 거미굴 양피지 지도 Spec과 구현

---

## 1. 문제

PR #206은 거미굴 U4만 전용 양피지 지도 배경으로 바꾸고, 사막과 묘지는 U5의 장면형 entry 이미지를 유지했다. 그 결과 같은 U4 지도 화면에서도 거미굴은 답사 지도처럼 보이지만 사막과 묘지는 던전 내부 장면 위에 노드가 놓인 화면처럼 보인다.

사용자는 세 테마 모두 같은 지도 이미지로 통일하기로 결정했다. 이 결정은 U4의 역할을 테마 장면 감상보다 전체 경로를 읽는 답사 지도로 일관되게 만드는 데 우선순위를 둔다.

## 2. 결정

세 `ThemeId` 모두 현재 승인된 다음 PNG를 사용한다.

```text
/assets/u4/map/map_background_spider_parchment.png
```

파일명에 `spider`가 남아 있지만 이번 후속 작업에서는 파일을 복제하거나 이름을 바꾸지 않는다. 경로 변경은 캐시·문서·테스트 범위를 불필요하게 넓히고, 사용자가 요청한 것은 기존 이미지의 공용 적용이기 때문이다. 이 파일은 구현 관점에서 U4 전 테마 공용 양피지 지도 배경이 된다.

| `themeId` | U4 배경 | modifier | ruins atmosphere |
| --- | --- | --- | --- |
| `undefined` | `/assets/u4/map/map_background_base.png` | 없음 | 렌더링 |
| `spider` | `/assets/u4/map/map_background_spider_parchment.png` | `.is-parchment` | 미렌더링 |
| `desert` | `/assets/u4/map/map_background_spider_parchment.png` | `.is-parchment` | 미렌더링 |
| `graveyard` | `/assets/u4/map/map_background_spider_parchment.png` | `.is-parchment` | 미렌더링 |

`undefined`는 던전 데이터가 없는 기본 프리뷰의 기존 fallback 의미를 유지한다. 실제 캠페인의 세 테마는 모두 양피지를 사용한다.

## 3. 배경 선택 구조

배경 선택은 계속 `U4DungeonMapScreen` 표현 계층이 소유한다. Store, domain, rules, service에 배경 경로나 표현 상태를 추가하지 않는다.

```ts
const U4_PARCHMENT_MAP_BACKGROUND =
  "/assets/u4/map/map_background_spider_parchment.png";

export const U4_MAP_BACKGROUND_BY_THEME = {
  spider: U4_PARCHMENT_MAP_BACKGROUND,
  desert: U4_PARCHMENT_MAP_BACKGROUND,
  graveyard: U4_PARCHMENT_MAP_BACKGROUND,
} as const satisfies Readonly<Record<ThemeId, string>>;
```

같은 문자열을 세 번 직접 적기보다 지역 상수 하나를 재사용하되, `Record<ThemeId, string>`의 닫힌 key 검사는 유지한다. 이후 `ThemeId`가 추가되면 새 테마에도 공용 양피지를 자동 적용하지 않고 타입 검사에서 멈춰 U4 배경 정책을 다시 결정하게 한다.

렌더링 판단은 다음 의미를 따른다.

```text
themeId === undefined
→ 기존 base 배경 + 기존 atmosphere

themeId !== undefined
→ 공용 parchment 배경 + .is-parchment + atmosphere 미렌더링
```

U5 entry 경로와 `.is-themed`는 U4의 실제 테마 화면에서 더 이상 사용하지 않는다. U5 진행 화면과 해당 자산은 수정하지 않는다.

## 4. 레이어와 시각 계약

세 테마 모두 같은 PNG를 사용하므로 다음 합성 계약도 동일하게 적용한다.

- `.is-parchment`는 blur와 brightness filter를 적용하지 않는다.
- `object-fit: cover`, `object-position: 50% 50%`를 유지한다.
- PNG에 이미 석벽, 촛불, 거미줄, 찢긴 종이 가장자리가 있으므로 `map_atmosphere_ruins_props.png`를 중복 렌더링하지 않는다.
- vignette < corridor < room의 최종 z-index를 유지한다.
- 배경과 장식 레이어의 `pointer-events: none`을 유지한다.
- current, selectable, selected, visited, inactive, boss의 기존 색·marker·형태를 변경하지 않는다.

사막과 묘지에서도 이미지에 포함된 거미줄 장식을 그대로 허용한다. 이번 결정은 테마별 배경 장식 차이보다 답사 지도 표현의 통일을 우선하며, 별도 사막·묘지 양피지 제작은 범위 밖이다.

## 5. 데이터와 아키텍처 경계

기존 데이터 흐름을 그대로 사용한다.

```text
CampaignStore
→ CampaignState.dungeons
→ CampaignScreen이 현재 dungeon 조회
→ dungeon.theme
→ U4DungeonMapScreen.themeId
→ U4 지역 배경 매핑
```

다음은 수정하지 않는다.

- `GeneratedMap`, NodeId, `nextNodeIds`, Depth와 topology
- `u4-dungeon-map-layout.ts`, `u4-dungeon-map-model.ts`, 지도 교차 최소화
- Store, domain, rules, service
- `campaign-adapters.ts`와 캠페인 전이
- U5 ViewModel 및 U5 장면 자산
- 우측 패널, 파티 상태, 답사 규칙, 목적지 CTA
- 방·통로·상태 에셋과 접근성 동작
- 양피지 PNG 자체

## 6. 결정적 프리뷰

`/u4-test`의 `theme` query는 세 `ThemeId`를 모두 허용한다.

```text
/u4-test?theme=spider
/u4-test?theme=desert
/u4-test?theme=graveyard
```

세 URL은 동일한 배경 이미지를 렌더링하되, `themeId` 전달 계약을 각각 검증할 수 있어야 한다. query가 없거나 유효하지 않거나 배열이면 `undefined` fallback으로 처리한다. 테스트 query는 실제 캠페인 Store를 대체하지 않는다.

## 7. 구현 범위

직접 수정 대상은 다음으로 제한한다.

```text
components/game/U4DungeonMapScreen.tsx
components/game/U4DungeonMapScreen.test.tsx
app/u4-test/page.tsx
app/u4-test/page.test.ts
e2e/u4-spider-parchment.spec.ts
docs/experience/U4_DUNGEON_MAP.md
docs/README.md
```

CSS와 PNG는 기존 계약이 이미 요구사항을 만족하므로 변경하지 않는다. 구현 중 실제 회귀가 발견되지 않는 한 `app/u4-dungeon-map.css`, `app/u4-dungeon-map-fixes.css`, `public/assets/u4/map/map_background_spider_parchment.png`를 수정하지 않는다.

## 8. 테스트 계약

### 정적 컴포넌트

1. `U4_MAP_BACKGROUND_BY_THEME`의 key 집합은 `THEME_IDS`와 정확히 같다.
2. `spider`, `desert`, `graveyard`의 값은 모두 공용 양피지 경로다.
3. 세 테마 모두 `.is-parchment`를 사용하고 `.is-themed`를 사용하지 않는다.
4. 세 테마 모두 ruins atmosphere를 DOM에 렌더링하지 않는다.
5. `themeId`가 없으면 base 배경과 atmosphere를 유지한다.

### 프리뷰 page

6. 세 유효 query가 모두 양피지 경로와 atmosphere 부재를 렌더링한다.
7. query 없음과 유효하지 않은 query는 base fallback을 렌더링한다.

### 브라우저

8. 기존 네 viewport 시각 검증은 공용 PNG 대표로 `theme=spider`에서 유지한다.
9. `theme=spider|desert|graveyard` 각각이 양피지 source, `.is-parchment`, atmosphere 부재를 만족한다.
10. 기존 mouse, Tab, Enter, Space, 방향키, `aria-pressed`, focus 검증을 유지한다.
11. 실제 캠페인 거미굴 검증은 기존 데이터 전달 경로 회귀로 유지한다. 사막·묘지 production 흐름은 동일한 닫힌 매핑의 정적 테스트와 query 브라우저 테스트로 검증한다.

## 9. 문서 갱신

`docs/experience/U4_DUNGEON_MAP.md`의 테마별 표를 세 테마 공용 배경과 modifier 계약으로 바꾼다. `docs/README.md`에 이 후속 설계와 구현 계획을 연결한다. 기존 거미굴 전용 Spec은 당시 결정을 기록하는 선행 문서로 보존하고, 이 문서가 테마 선택 계약을 대체함을 링크로 명시한다.

## 10. 범위 밖

- 사막 전용 양피지 이미지 생성
- 묘지 전용 양피지 이미지 생성
- 공용 PNG 이름 변경 또는 파일 복제
- U5 배경 변경
- 지도 topology·방·통로·상태·선택 로직 변경
- 새 전역 이미지 컴포넌트 또는 Store 필드
- 배경 애니메이션

## 11. 완료 조건

- 실제 캠페인의 세 테마 U4가 모두 같은 양피지 PNG를 사용한다.
- 세 테마 모두 장면 필터와 ruins atmosphere를 사용하지 않는다.
- 기본 프리뷰 fallback은 기존 돌바닥과 atmosphere를 유지한다.
- 지도 구조, 선택 결과, 접근성, 우측 패널, U5 화면은 바뀌지 않는다.
- 기존 1.23:1 자산 규격과 네 viewport 레이아웃 계약이 유지된다.
- 공식 U4 문서와 자동화 테스트가 새 공용 계약을 설명하고 검증한다.

## Self-review

- 기존 Spec과 충돌하는 테마 선택·atmosphere 항목을 명시적으로 대체함.
- 세 테마 동일 PNG 사용과 거미줄 장식 허용을 모호하지 않게 기록함.
- `undefined` fallback과 유효하지 않은 query 처리를 분리함.
- 같은 경로를 쓰더라도 `ThemeId` 닫힌 매핑을 유지하는 이유를 명시함.
- CSS·PNG·Store·domain·rules·U5 비변경 경계를 명시함.
- 정적 테스트와 브라우저 테스트의 책임을 분리함.
- `TBD`, `TODO`, 미확정 구현 항목 없음.
