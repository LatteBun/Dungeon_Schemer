# 화면·규칙 인수인계 계약

`U5`·`U5-2`·`U6`은 화면과 ViewModel 경계까지 만들어 두고, 아직 없는 규칙 자리를
결정적 fixture로 메워 그리고 있다. 이 문서는 그 fixture 자리마다 **무엇이
들어올 자리인지**를 한곳에 모은다.

지금 `C4`~`C8`과 `E3`·`E4`를 쓰는 사람이 화면 코드를 열어보지 않고도 무엇을
내놓아야 하는지 알 수 있게 하는 것이 목적이다.

## 우선권은 로직에 있다

**이 문서는 요구서가 아니라 현황 보고다.**

여기 적힌 모양은 규칙이 없는 동안 화면이 임시로 가정한 것일 뿐이다. 규칙과
어긋나면 **고치는 쪽은 화면이다.** 규칙 계층이 도메인의 진실을 가지므로,
이름·단위·분기·순서가 다르면 규칙 쪽이 맞고 화면 쪽 가정이 틀린 것이다.

따라서 `C4`~`C8`·`E3`·`E4`를 구현할 때 이 문서에 맞추려고 규칙을 비틀지 않는다.
규칙이 자연스러운 모양으로 나오면 화면이 그쪽으로 옮겨 간다. 옮기는 일은
어댑터 한 겹에서 끝나도록 아래처럼 경계를 잡아 두었다.

이 문서가 쓸모 있는 경우는 하나다. **규칙이 어느 쪽으로 가도 상관없는 자리**에서
화면이 이미 쓰고 있는 모양을 골라 주면 어댑터가 얇아진다. 그 이상은 아니다.

## 경계의 모양

세 화면 모두 같은 구조다.

```text
규칙 계층 결과  →  [어댑터 한 겹]  →  View 타입  →  화면 컴포넌트
   (C·E 소유)                          (U 소유)
```

화면 컴포넌트는 View 타입만 안다. 규칙이 들어올 때 바뀌는 것은 어댑터 한 겹과
그 자리를 임시로 채우던 fixture 파일뿐이고, 화면 코드는 그대로다.

View 타입도 규칙이 정한 모양에 따라 바뀔 수 있다. 그때는 화면 컴포넌트까지
따라 바뀐다. 그것이 정상이며, 그 비용을 줄이려고 규칙을 비틀지 않는다.

## U5 던전 진행 ← E3

**이미 실제 규칙이 하는 것**은 조언 제시·반응 판정·생태 공개다. `E2`가 완료돼
있어 `components/game/u5-preview-data.ts`가 그대로 호출한다.

**fixture가 메우고 있는 자리는 하나다.** 같은 파일의 `pickEvent`, 곧 *어떤
사건이 나왔는가*. `E3`의 사건 물질화 결과가 그 자리에 들어온다.

- 바뀌는 파일: `components/game/u5-preview-data.ts`
- 그대로인 것: `U5ProgressScreen`, `u5-progress-model`, `u5-log`

## U5-2 자동 전투 ← E3 · E4

일반 몬스터 전투는 이미 `E3`의 `resolveMonsterEventBattle` 결과를 소비한다.
**보스전만 fixture다.**

- 필요한 것: `lib/rules/battle-engine`의 `BattleResolution`
- 지금 상태: `components/game/u5-battle-preview-data.ts`의
  `BOSS_FIXTURE_RESOLUTION`이 `resolveBossBattle`을 호출하지 않고 같은 모양을
  손으로 만든다. 화면에도 `E4 미연결 fixture`라고 표시한다.
- `E4`가 `BattleResolution`을 그대로 내주면 어댑터가 필요 없다. 다른 모양이면
  `createU5BattleReplay` 앞에 변환 한 겹이 붙는다.

`createU5BattleReplay`가 입력을 깐깐하게 검증한다는 점만 미리 알아 두면 좋다.
`damage`로 HP를 역산하지 않고 `targetHpBefore`·`targetHpAfter` 체인을 그대로
쓰므로, 체인이 어긋나거나 쓰러진 참가자가 다시 등장하면 설명 가능한 오류로
거부한다. 전투 기록이 스스로 앞뒤가 맞아야 한다는 뜻이다.

## U6 정산·승급·엔딩 ← C4 · C5 · C6 · C8

네 규칙이 다 없어서 `components/game/u6-preview-data.ts`가 통째로 fixture다.
화면이 지금 기대하는 모양은 다음 둘이다.

### `U6SettlementView` — C4 정산 · C5 승급

`components/game/u6-settlement-model.ts`에 있다. 주요 칸만 옮기면,

| 칸 | 뜻 | 어디서 오나 |
| --- | --- | --- |
| `survivors` | `0`이면 전멸 | C4 |
| `causeChain` | 정산 원인을 **순서대로**. 한 줄 요약이 아니다 | C4 |
| `riskBefore` · `riskAfter` · `riskCapped` | ★5 상한에 걸렸는지 구분 | C4 |
| `reputationDelta` · `goldDelta` | 증감분 | C4 |
| `relicGold` | 전멸에서만 회수, 그 외 `0` | C4 |
| `nextReward` | 전멸 뒤 다음 공고 보상, 클리어면 `null` | C4 |
| `promotion` | 최고 등급이면 `null` | C5 |

`U6PromotionView`의 `byReputation`과 `byGold`는 **따로 판정한다.** 하나로
합치면 어느 쪽으로 벌었는지가 지워지고, 화면이 두 버튼을 못 그린다.

### `U6EndingView` — C6 엔딩 · C8 통계

`components/game/u6-ending-model.ts`에 있다. `kind`(엔딩 5종)와 판정 이유
`reasons`, 그리고 `survivedCount`·`diedCount`·`zeroTrustCount`·`adviceTotal`·
`wipedExpeditions`·`turningPoint` 같은 누적 통계가 `C8`에서 온다.

`reasons`가 배열인 이유는 화면이 세 줄로 그리기 때문이다. `turningPoint`는
없을 수 있어 `null`을 받는다.

## 어긋났을 때

규칙 쪽 모양이 위와 다르면 **그대로 진행하고 화면 쪽에 알려 주기만 하면 된다.**
맞추는 작업은 어댑터와 View 타입에서 한다. 되도록 규칙이 나온 뒤 한 번에
옮기는 편이 낫다. 중간 모양에 맞춰 화면을 고치면 두 번 고치게 된다.

## 관련 문서

- [캠페인 개편 작업 배정표](CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
- [화면 규격](../experience/SCREEN_LAYOUT.md)
