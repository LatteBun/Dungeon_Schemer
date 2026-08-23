# U6 정산·승급·엔딩 화면 설계

## 문서 정보

- 작성자: sbh3821
- 작성 도구: Claude Code (Opus 5)
- 작성일: 2026-08-22
- 대상 작업: `U6` 정산·승급·엔딩 화면과 `/u6-test` 프리뷰
- 기준 브랜치: `main` (`3997b90`)

## 1. 목표

원정이 끝난 뒤와 캠페인이 끝난 뒤에 플레이어가 **자기가 무엇을 골라서 이렇게 됐는지**를 보는 화면을 만든다. 숫자를 나열하는 결과창이 아니라 원인을 따라가는 회고여야 한다.

완료 목표는 다음과 같다.

- 정산 화면이 `선택 → 개인 반응 → 피해 → 보상·손실 → 캠페인 변화`를 원인 순서로 보여준다.
- 우측에 위험도·보상 변화와 `승급하기` 버튼을 둔다. 승급은 이 버튼이 유일한 경로다.
- 엔딩 화면이 5종 중 무엇이 왜 성립했는지와 최종 등급을 가장 크게 보여준다.
- 누적 통계, 가장 큰 전환점, 원정 연대기를 함께 보여준다.
- `/u6-test`에서 두 화면과 엔딩 5종을 결정적 fixture 로 확인할 수 있다.
- 16:9 고정 캔버스와 공용 상태 바 규칙을 그대로 따른다.

## 2. 근거와 범위

근거 문서는 다음과 같다.

- `docs/systems/PROGRESSION_AND_ENDINGS.md` — 보상표, 전멸 정산, 승급, 엔딩 5종 우선순위
- `docs/experience/SCREEN_LAYOUT.md` — 정산·엔딩 화면 구조와 공용 요소 규칙
- `docs/diagram/screen-wireframes.md` 5·6절 — 정산과 엔딩의 표시 순서
- `docs/technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md` — `U6` 행과 선행 `C4 C5 C6 C8`
- `docs/superpowers/specs/2026-08-22-sanghwan-yoo-u4-dungeon-map-design.md` — 프리뷰 화면 선례

### 2.1 선행 작업이 아직 없다

**`U6`의 선행 `C4`·`C5`·`C6`·`C8`이 모두 미착수(⬜)다.** `lib/rules/`에 정산·승급·엔딩 판정·통계 누적 규칙이 없다.

| 선행 | 무엇을 만들어야 하나 | 지금 상태 |
| --- | --- | --- |
| `C4` | 정산·위험도 상승 | 없음 |
| `C5` | 승급 실행 | 상수만 있음 (`PROMOTION_REPUTATION`, `PROMOTION_GOLD`) |
| `C6` | 엔딩 5종 판정 | 타입만 있음 (`EndingKind`, `CampaignEnding`) |
| `C8` | 캠페인 통계 누적 | 없음 |

따라서 이번 작업은 **화면과 ViewModel 경계까지만** 만든다. `U4`가 `/u4-test`에서 deterministic fixture 로 화면을 검증한 선례를 따른다. 규칙이 들어오면 fixture 를 실제 `CampaignState` 로 바꾸는 것이 `I2`의 몫이다.

이 결정의 대가를 분명히 적는다. **이번 작업은 규칙의 정확성을 검증하지 못한다.** 보상 계산, 명성 손실, 엔딩 우선순위가 맞는지는 `C4`~`C6`이 들어와야 알 수 있다. 화면은 그 값을 받아 배치하는 책임만 진다.

### 2.2 다루지 않는 것

캠페인 규칙, 보상 수치, 상태 전이, 도메인 타입, 백테스트는 변경하지 않는다. 다른 화면(`U1`~`U5`)의 구조도 건드리지 않는다.

## 3. 화면은 둘이다

배정표의 `U6` 한 행이 실제로는 성격이 다른 두 화면을 담는다.

| 화면 | 언제 | 좌측 | 우측 |
| --- | --- | --- | --- |
| 정산 | 원정 1회가 끝날 때마다 | 원인 사슬 | 위험도·보상 변화, `승급하기` |
| 엔딩 | 캠페인이 끝날 때 한 번 | 엔딩 판정과 최종 등급 | 누적 통계, 전환점, 연대기 |

둘은 `GameShell` 의 3:2 열 비율을 공유하되 좌우 내용이 다르다. 한 컴포넌트에 분기를 넣지 않고 `U6SettlementScreen` 과 `U6EndingScreen` 으로 나눈다. 정산은 15번 보고 엔딩은 1번 보므로, 한쪽 변경이 다른 쪽을 흔들면 안 된다.

## 4. 정산 화면

### 4.1 좌측 — 원인 사슬

숫자를 나열하지 않고 번호가 붙은 원인 순서로 나열한다. 각 단계는 한 줄 제목과 그 결과를 함께 둔다.

```text
1  선택        내가 건넨 조언과 그때 감춘 것
2  개인 반응    파티원별 수용 · 의심 · 적발
3  피해        생존 3/2/1명 또는 전멸, HP 와 신뢰 변화
4  보상·손실    계약 보상 또는 명성 손실, 유품 회수
5  캠페인 변화  위험도 변화와 그것이 다음 보상에 미치는 영향
```

전멸이면 4단계의 성격이 바뀐다. 계약 보상이 없고, **상승 전 위험도**의 3명 생존 명성만큼 명성이 줄고, 사망자 소지 골드가 유품으로 들어온다. 명성 손실을 상승 전 값으로 계산하는 이유(계약 화면에서 본 위험이 정산에서 달라지면 안 된다)를 화면이 문구로 밝힌다.

### 4.2 우측 — 변화와 승급

- 던전 위험도 변화: `★2 → ★3` 처럼 전후를 함께 보여준다. ★5 상한에 걸리면 오르지 않았음을 밝힌다.
- 다음 보상 변화: 전멸로 위험도가 오르면 오른 다음 보상을 보여준다. 클리어는 다음 계약이 없으므로 표시하지 않는다.
- `승급하기` 버튼: 요건을 만족할 때만 활성이다.

승급은 두 경로가 나란히 있어야 한다. 하나로 합치면 어느 쪽으로 벌었는지가 지워진다.

| 경로 | 조건 | 표시 |
| --- | --- | --- |
| 명성 승급 | 현재 명성 ≥ 요구 명성 | `명성 60 / 현재 74` |
| 골드 승급 | 현재 골드 ≥ 요구 골드 | `골드 150 소비` |

명성 승급은 명성을 소비하지 않는다. 요구 명성은 문턱이지 비용이다가 아니다. 골드 승급은 골드를 소비하고 명성을 보지 않는다. 두 조건 모두 못 미치면 버튼은 비활성이고 무엇이 모자라는지 적는다.

## 5. 엔딩 화면

### 5.1 좌측 — 판정과 최종 등급

엔딩 5종 중 무엇이 왜 성립했는지를 가장 크게 둔다. `CampaignEnding.reason` 이 이미 사람이 읽는 문장이므로 그대로 쓴다.

| 순서 | `kind` | 엔딩 | 조건 |
| ---: | --- | --- | --- |
| 1 | `distrust` | 불신의 대가 | 생존 파티원 1명 이상이고 그들 전원의 신뢰가 0 |
| 2 | `denounced` | 누적 고발 | 신뢰 0 캐릭터가 5명 |
| 3 | `completed` | 원정 종료 | 던전 15개를 모두 클리어 |
| 4 | `exhausted` | 인력 소진 | 서로 다른 직업 3명을 편성할 수 없음 |
| 5 | `unemployed` | 실직 | 게시판의 모든 공고가 진입 불가 |

먼저 성립한 것만 적용한다. 화면은 판정 순서를 알 필요가 없고 `kind` 와 `reason` 을 받아 표시만 한다.

최종 등급은 `finalRank` 를 등급 문장 이미지로 크게 보여준다. 던전 15개를 모두 클리어했다면 어느 등급이든 정상 완주다. 조기 종료와 완주를 색으로만 구분하지 않고 문구로 함께 밝힌다.

### 5.2 우측 — 회고

- 생존·사망 캐릭터 수, 신뢰 0 누적 인원
- 최종 명성과 누적 골드
- 조언 전달과 반응의 누적 통계
- 가장 큰 전환점 하나
- 원정 연대기: 원정별 던전·결과 한 줄 요약

`정상 완주와 조기 종료 모두 "어떤 선택이 이 결말을 만들었는가?"를 회고한다`는 것이 이 패널의 목적이다. 수치 나열이 아니라 문장이 먼저 오고 수치가 근거로 따라온다.

## 6. ViewModel 경계

화면은 `CampaignState` 를 직접 읽지 않는다. `C4`~`C8` 이 들어올 자리를 타입으로 먼저 고정한다.

```ts
// components/game/u6-settlement-model.ts
export interface U6CauseStep {
  order: 1 | 2 | 3 | 4 | 5;
  label: string;
  detail: string;
}

export interface U6SettlementView {
  dungeonName: string;
  themeId: ThemeId;
  survivors: number;              // 0~3, 0 이면 전멸
  causeChain: readonly U6CauseStep[];
  riskBefore: RiskLevel;
  riskAfter: RiskLevel;
  riskCapped: boolean;            // ★5 라 오르지 않았다
  reputationDelta: number;
  goldDelta: number;
  relicGold: number;              // 전멸 유품. 그 외에는 0
  nextReward: { reputation: number; gold: number } | null; // 전멸 뒤에만 다음 계약 보상
  promotion: U6PromotionView | null;   // 최고 등급이면 null
}

export interface U6PromotionView {
  from: GuideRank;
  to: GuideRank;
  reputationRequired: number;
  goldRequired: number;
  currentReputation: number;
  currentGold: number;
  byReputation: boolean;          // 명성 경로가 열렸나
  byGold: boolean;                // 골드 경로가 열렸나
}
```

```ts
// components/game/u6-ending-model.ts
export interface U6EndingView {
  kind: EndingKind;
  title: string;
  reason: string;
  finalRank: GuideRank;
  completed: boolean;             // completed 엔딩인가
  survivedCount: number;
  diedCount: number;
  zeroTrustCount: number;
  finalReputation: number;
  cumulativeGold: number;
  adviceStats: readonly { label: string; given: number; caught: number }[];
  turningPoint: { label: string; detail: string } | null;
  chronicle: readonly { worldTurn: number; dungeonName: string; outcome: string }[];
}
```

`C4`~`C8` 이 들어오면 `createU6SettlementView(campaign, result)` 와 `createU6EndingView(campaign)` 이 이 타입을 만든다. 그때까지는 `u6-preview-data.ts` 가 결정적 상수로 만든다. **화면 코드는 그 전환에 영향을 받지 않는다.**

## 7. 자산 매핑

`public/assets/u6/DUNGEON_SCHEMER_RESULT_ASSETS_ALL/` 에 39개가 이미 있다.

| 갈래 | 파일 | 쓰임 |
| --- | --- | --- |
| `ranks` | `rank_c/b/a/s.png` | 최종 등급과 승급 전후 |
| `stats` | `icon_advice` `icon_survived` `icon_dead` `icon_trust` `icon_gold` `icon_reputation` `icon_expeditions` `icon_turning_point` | 회고 패널의 항목 아이콘 |
| `achievements` | `achievement_conquest` `achievement_guild` `achievement_return` `achievement_together` | 엔딩 종류별 표제 문양 |
| `emblems` | `emblem_banner_*` `laurel_left/right` `star_large/small` `wax_seal` | 엔딩 표제 장식, 위험도 별 |
| `decorations` | `divider_main/line/small` `ornament_diamond/arrow` `corner_deco` | 구획 구분 |
| `controls` | `icon_check_on/off` `icon_arrow` `icon_button_handshake` `button_back` `quote_left/right` | 승급 조건 충족 표시, CTA |

`_source/result_asset_sheet.png` 는 원본 시트이므로 화면에서 쓰지 않는다.

자산은 화면에 넣기 전에 **투명 여백을 걷어낸다.** 여백이 좌우로 어긋나면 그림이 치우쳐 보인다. 예외 규칙은 `docs/experience/SCREEN_LAYOUT.md` 의 「자산의 투명 여백」을 따른다.

## 8. 공용 규칙 준수

- 상단 상태 바를 화면 CSS 에서 다시 선언하지 않는다. `globals.css` 의 정의를 그대로 쓴다.
- CTA 아이콘은 `--cta-icon-optical-lift` 로 글자의 광학 중심선에 맞춘다.
- 크기는 `rem` 과 `cqw`·`cqh` 로 쓰고 `vw`·`vh` 와 미디어 쿼리를 쓰지 않는다.
- 색만으로 의미를 전달하지 않는다. 엔딩 종류, 승급 가능 여부, 전멸 여부 모두 문구를 함께 둔다.

## 9. `/u6-test`

`U6Preview` 가 다음을 전환한다.

- `정산 · 부분 생존` — 2명 생존, 위험도 유지
- `정산 · 전멸` — 명성 손실과 유품, 위험도 상승
- `정산 · 승급 가능` — 명성 경로와 골드 경로가 함께 열린 상태
- `엔딩 · 원정 종료` `엔딩 · 불신의 대가` `엔딩 · 누적 고발` `엔딩 · 인력 소진` `엔딩 · 실직`

프리뷰 seed 는 상수로 고정해 새로고침해도 같은 화면이 나온다. `U1Preview` 의 화면 전환 버튼 방식을 그대로 쓴다.

## 10. 테스트 계약

- `u6-settlement-model.test.ts` — 원인 사슬이 1~5 순서를 빠뜨리지 않는다. 전멸이면 계약 보상이 0 이고 명성 손실이 **상승 전** 위험도를 쓴다. ★5 는 더 오르지 않는다.
- `u6-promotion-model.test.ts` — 명성 경로와 골드 경로가 독립으로 열린다. 명성 승급이 명성을 줄이지 않는다. 최고 등급에서 `promotion` 이 `null` 이다.
- `u6-ending-model.test.ts` — 엔딩 5종이 각각 `kind`·`reason`·`finalRank` 를 표시한다. `completed` 만 정상 완주로 표시된다.
- `U6SettlementScreen.test.ts` `U6EndingScreen.test.ts` — landmark 와 접근성 속성, 색 외 단서 문구.
- `U6Assets.test.ts` — 쓰는 자산이 실제 PNG 이고 투명 여백 계약을 지킨다.
- `U6FixedCanvas.test.ts` — 화면 CSS 에 `vw`·`vh`·`@media` 가 없고 상태 바를 다시 선언하지 않는다.
- `pnpm test` `pnpm lint` `pnpm typecheck` `pnpm build`

`pnpm backtest` 는 실행하지 않는다. 이번 변경은 `lib/rules`, `lib/backtest`, 보상 상수, 상태 전이를 건드리지 않는다.

브라우저 검증은 1920×1080, 2560×1440, 1440×900, 1280×1024 네 비율에서 `/u6-test` 의 여덟 상태를 확인한다.

## 11. 완료 조건

- `/u6-test` 에서 여덟 상태가 모두 렌더링되고 서로 전환된다.
- 네 창 비율에서 레이아웃이 동일하고 스크롤이 없다.
- 정산 좌측이 원인 순서를 번호로 보여준다.
- 승급 버튼이 두 경로를 나란히 보여주고 요건 미달 시 무엇이 모자란지 밝힌다.
- 엔딩 좌측이 판정 근거 문장과 최종 등급을 보여준다.
- 자동 검증 전부 통과.

## 12. 변경하지 않는 것

- 캠페인 규칙, 보상 수치, 상태 머신, 도메인 타입
- `lib/backtest` 와 `pnpm backtest` 설정
- `U1`~`U5` 화면 구조
- 공용 상태 바와 고정 캔버스 계약
- 배정표의 `C4`~`C8` 상태 — 이번 작업은 그 선행을 대신하지 않는다
