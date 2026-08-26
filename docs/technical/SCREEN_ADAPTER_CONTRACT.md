# 화면·규칙 인수인계 계약

`U5`는 화면과 ViewModel 경계에서 아직 없는 사건 선택 규칙 한 자리를 결정적
fixture로 메우고 있다. `U5-2`와 `U6`은 실제 규칙을 소비하며, U6 프리뷰 데이터도
C4·C6·C8 규칙으로 결정적 정산·엔딩 상태를 만든다. 이 문서는 규칙 결과와 화면
View 사이의 현재 경계를 한곳에 모은다.

`C4`~`C8`과 `E3`·`E4`의 생산자와 화면 어댑터를 유지하는 사람이 화면 코드를
열어보지 않고도 현재 인수인계 모양을 알 수 있게 하는 것이 목적이다.

## 우선권은 로직에 있다

**이 문서는 요구서가 아니라 현황 보고다.**

여기 적힌 View 모양은 규칙 결과를 화면에 전달하는 현재 계약이다. 규칙과
어긋나면 **고치는 쪽은 화면이다.** 규칙 계층이 도메인의 진실을 가지므로,
이름·단위·분기·순서가 다르면 규칙 쪽이 맞고 화면 쪽 어댑터가 틀린 것이다.

따라서 `C4`~`C8`·`E3`·`E4`를 바꾸거나 확장할 때 이 문서에 맞추려고 규칙을
비틀지 않는다. 규칙의 자연스러운 모양이 바뀌면 화면이 그쪽으로 옮겨 간다.
옮기는 일은 어댑터 한 겹에서 끝나도록 아래처럼 경계를 잡아 두었다.

이 문서가 쓸모 있는 경우는 하나다. **규칙이 어느 쪽으로 가도 상관없는 자리**에서
화면이 이미 쓰고 있는 모양을 골라 주면 어댑터가 얇아진다. 그 이상은 아니다.

## 경계의 모양

세 화면 모두 같은 구조다.

```text
규칙 계층 결과  →  [어댑터 한 겹]  →  View 타입  →  화면 컴포넌트
   (C·E 소유)                          (U 소유)
```

화면 컴포넌트는 View 타입만 안다. 규칙 결과 모양이 바뀌면 어댑터 한 겹과,
fixture가 남은 경우 그 파일을 먼저 바꾼다.

View 타입도 규칙이 정한 모양에 따라 바뀔 수 있다. 그때는 화면 컴포넌트까지
따라 바뀐다. 그것이 정상이며, 그 비용을 줄이려고 규칙을 비틀지 않는다.

### 공통 상단 상태 — C5 승급과 C6 신뢰 누적

`components/game/campaign-adapters.ts`의 `statusFor(campaign, active)`가 `CampaignState`를 `TopStatusView`로 바꾸는 런타임 경계다. 어댑터는 집계 조건을 다시 쓰지 않고 C6 selector와 도메인 상수를 표시용 View로 옮긴다.

```ts
zeroTrust: {
  livingCount: countLivingZeroTrust(campaign),
  threshold: DENOUNCE_THRESHOLD,
}
```

`TopStatusBar`는 `CampaignState`, `TRUST_MIN`, `DENOUNCE_THRESHOLD`, C6 규칙을 import하지 않는다. 활성 원정 파티를 캠페인 풀에 합성하지 않고 현재 캠페인 풀에 반영된 확정 상태만 표시한다.

표시 레이블은 `의심 인원`이며 칩의 팝업은 이 View 값을 다시 계산하지 않고 누적 고발의 고정 설명만 제공한다.

## U5 던전 진행 ← E3

**이미 실제 규칙이 하는 것**은 조언 제시·반응 판정·생태 공개다. `E2`가 완료돼
있어 `components/game/u5-preview-data.ts`가 그대로 호출한다.

**fixture가 메우고 있는 자리는 하나다.** 같은 파일의 `pickEvent`, 곧 *어떤
사건이 나왔는가*. `E3`의 사건 물질화 결과가 그 자리에 들어온다.

- 바뀌는 파일: `components/game/u5-preview-data.ts`
- 그대로인 것: `U5ProgressScreen`, `u5-progress-model`, `u5-log`

## U5-2 자동 전투 ← E3 · E4

**둘 다 실제 규칙을 소비한다. fixture가 없다.**

일반 몬스터 전투는 `E3`의 `resolveMonsterEventBattle`, 보스전은 `E4`의
`resolveBossBattle`이 낸 결과를 쓴다.

어댑터는 필요 없었다. `BossBattleResolution.bossResult.battle`이 곧
`BattleResolution`이라 `createU5BattleReplay`에 그대로 들어간다.

`createU5BattleReplay`가 입력을 깐깐하게 검증한다는 점만 미리 알아 두면 좋다.
`damage`로 HP를 역산하지 않고 `targetHpBefore`·`targetHpAfter` 체인을 그대로
쓰므로, 체인이 어긋나거나 쓰러진 참가자가 다시 등장하면 설명 가능한 오류로
거부한다. 전투 기록이 스스로 앞뒤가 맞아야 한다는 뜻이다.

## U3 게시판·승급 ← C2 · C5

`components/game/U3Preview.tsx`가 C2 게시판 View와 C5 승급 규칙을 연결하는
`U3PromotionView`를 만든다. 실제 캠페인 Store가 연결될 때도 화면은 다음 계약만
소비한다.

### `U3PromotionView` — C5 승급

| 칸 | 뜻 | 어디서 오나 |
| --- | --- | --- |
| `eligibility` | 현재 등급의 다음 승급 등급·두 비용·각 경로 가능 여부. S에서는 `null` | C5 `getGuidePromotionEligibility` |
| `isOpen` | 게시판에서 승급 선택 오버레이가 열렸는지 | C5 phase |
| `result` | 확정한 한 단계 승급의 전후 등급·사용 경로·골드 변화·새 위험도 | C5 `promoteGuide` |

U3은 `eligibility`의 요구치와 가능 여부를 다시 계산하지 않는다. C·B·A의 상단
등급 버튼은 조건 미달이어도 선택 화면을 열며, `canPromoteByReputation`과
`canPromoteByGold`는 상단 버튼의 강조와 각 경로 버튼 활성화에만 사용한다. 명성·
골드의 현재값·요구값·부족 사유는 각각 보여준다. S에서는 eligibility가 `null`이므로
승급 진입을 제공하지 않는다.
확정 결과를 확인하면 C2의 `createBoardOffers`를 같은 `seed`·`worldTurn`으로
호출해 새 등급의 공고를 만든다. 승급은 게시판 안에서만 열고 취소·확정 뒤에도
`board` phase로 돌아온다.

## U6 정산·엔딩 ← C4 · C6 · C8

U6는 C4 정산, C6 신뢰 누적·엔딩 판정, C8 캠페인 통계를 실제 규칙에서 받는다.
`components/game/u6-preview-data.ts`도 이 규칙들을 호출해 부분 생환·전멸·승급
가능 클리어의 결정적 상태를 만든다. 화면이 소비하는 경계는 다음 둘이다.

### `U6SettlementView` — C4 정산과 C6 신뢰 누적

U6 정산은 실제 `SettlementResult`와 정산 뒤 `CampaignState`를 소비한다. 규칙은 보상·유품·위험도·인물 전후 상태와 원정 근거를 구조화된 값으로 내고, 어댑터가 화면용 결과 표제와 상태 union을 만든다.

```ts
createU6SettlementView(
  campaignAfterSettlement: CampaignState,
  settlement: SettlementResult,
  dungeonName: string,
  themeId: ThemeId,
): U6SettlementView
```

화면은 생존자 수로 클리어·전멸을 재판정하지 않는다. `SettlementResult.status`를 보존한 `outcome.kind`와 `dungeonOutcome`을 사용한다. `causeInputs`의 선택과 반응은 화면 원인 요약으로 옮기고, 피해는 `memberChanges`의 인물별 결과에서 보여준다. 살아 있는 신뢰 0 정산 전후 인원은 같은 정산에서 나온 캠페인과 `memberChanges.before`로 만들며, 현재 보정은 C6의 `getCampaignTrustModifier`를 그대로 옮긴다. `memberChanges`와 사망자 이름은 계약 파티 순서를 유지한다.

`reputationDelta`와 `goldDelta`는 계약 시 확정된 보상에 생존 결과를 적용한 실제 증감이며, `relicGold`는 전멸에서만 별도로 회수한다. 전멸 뒤 다음 공고 보상은 아직 생성되지 않은 값이므로 `SettlementResult`와 `U6SettlementView`에 포함하지 않는다. U6은 승급 버튼·선택 오버레이·결과 ViewModel을 제공하지 않으며, 승급의 유일한 진입점은 U3 게시판 상단 등급 버튼이다.

### `U6EndingView` — C6 엔딩 · C8 통계

`components/game/u6-ending-model.ts`에 있다. `kind`(엔딩 5종)와 판정 이유
`reasons`는 C6에서 오며, C8-A는 `totalExpeditions`·`clearedExpeditions`·
`wipedExpeditions`·`totalDeaths`·`totalGoldEarned`·`highestDungeonCleared`의
정산 누계를 제공한다.

`survivedCount`와 `zeroTrustCount`는 최종 `CampaignState.pool`에서, `diedCount`는
C8-A의 `statistics.totalDeaths`에서 읽는다. `adviceTotal`은
`campaign.history.events`의 `ADVICE_RESOLVED`만 세고, `turningPoint`는 C8-B가
기록한 `history.turningPoints`를 `selectHighlightedTurningPoint`로 골라 옮기며
없으면 `null`이다. `chronicleSummary`만 엔딩 종류별 화면 산문인 `PROSE`가
소유하고, `reasons`는 C6 판정 근거 한 줄과 화면 산문 두 줄을 담는다.

## 어긋났을 때

규칙 쪽 모양이 위와 다르면 **그대로 진행하고 화면 쪽에 알려 주기만 하면 된다.**
맞추는 작업은 어댑터와 View 타입에서 한다. 되도록 규칙이 나온 뒤 한 번에
옮기는 편이 낫다. 중간 모양에 맞춰 화면을 고치면 두 번 고치게 된다.

## 관련 문서

- [캠페인 개편 작업 배정표](CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
- [화면 규격](../experience/SCREEN_LAYOUT.md)
