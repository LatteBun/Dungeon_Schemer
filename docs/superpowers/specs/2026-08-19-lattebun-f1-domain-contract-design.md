# F1 도메인 계약 재정의 설계

작성 도구: Claude Code (Opus 5)

## 이 문서의 지위

[캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)의 `F1`을 어떻게 구현할지 정한다. 규칙의 근거는 [캠페인 개편 설계](2026-08-19-lattebun-campaign-rework-design.md)와 `D1`~`D6`이 개정을 마친 `docs/systems/` 문서들에 있다.

이 문서는 **그 규칙을 타입으로 어떻게 옮기고, 옛 모델을 언제 걷어내는지**만 다룬다. 규칙 자체를 새로 정하지 않는다.

## 왜 이 문서가 필요한가

`F1`의 완료 기준에 `파티 영속·던전 등급 타입 제거`가 있다. 그런데 `Grade`는 비테스트 파일 30개에 걸쳐 있고, 지우면 그 파일들이 함께 깨진다.

두 가지가 섞이기 쉬워 먼저 갈라 둔다.

| 구분 | 범위 | 성격 |
| --- | --- | --- |
| 타입 제거가 **강제하는** 것 | 비테스트 30개 파일 수정 | 대부분 1~4곳이고 표기 자리다 |
| 이번에 **함께 하기로 한** 것 | 옛 구현과 그 테스트의 철거 | 타입 때문이 아니라 선택이다 |

후자를 하는 이유는 배정표의 「재사용 자산과 새로 만드는 것」이 `C1`~`C8`·`E1`~`E4`·`U1`~`U6`·`I1`을 모두 "반드시 새로 만드는 것"으로 지정했기 때문이다. 두 모델을 공존시키면 개편이 끝날 때까지 어느 쪽이 진짜인지 매번 확인해야 한다. 이번 개편이 문서에서 고치려던 문제와 같은 문제다.

**이 구분을 문서에 남기는 이유가 있다.** 나중에 이 커밋을 보는 사람이 삭제 범위를 "타입 제거 때문에 불가피했다"로 읽으면, 다음에 비슷한 상황에서 같은 규모의 삭제를 근거 없이 반복한다.

## 감수하는 것

- `/play`와 검증 페이지가 사라진다. **`U`·`I` 항목이 끝나기 전까지 데모를 보일 수 없다**
- 테스트가 크게 줄어든다. 한동안 자동 안전망은 타입 검사와 문서 검사다
- 옛 구현을 참조하려면 git 히스토리를 봐야 한다

빈 화면이나 404는 두지 않는다. `/`를 자리 표시 화면으로 바꿔 무엇이 없는 것이고 어디를 보면 되는지 말하게 한다. 저장소를 처음 받은 사람이 고장인지 진행 중인지 구분할 수 있어야 한다.

## 남기는 것

`Grade` 참조가 0건임을 확인한 자산이다.

| 자산 | 남기는 이유 |
| --- | --- |
| `lib/rng/` | 재현성 규약이 바뀌지 않는다. 스트림 *이름*만 새로 정한다 |
| `lib/domain/errors.ts` | 생성 오류를 `RuleError`로 보고하는 규약이 그대로다 |
| `lib/rules/trust.ts` | 성격 5종과 행동별 신뢰 증감표가 그대로다 |
| `lib/rules/personality-profile.ts` · `trust-history.ts` | 위 표를 읽는 얇은 계층이다 |
| `lib/content/info-cards.ts` | 주제 6종 × 진위 3종 × 2장 구조가 유지된다. `F3`이 태그를 더한다 |
| `components/ui/` | 게임 도메인을 모르는 범용 프레임이다 |

이 자산들이 쓰는 `MemberId`는 `CharacterId`로, `PartyMember`는 `Character`로 이름을 바꾸고 해당 import만 고친다. 단위가 파티원이 아니라 캐릭터이기 때문이다.

## 새 도메인 구조

```text
lib/domain/
  ids.ts         브랜드 ID (RuleId·MonsterId 추가)
  character.ts   캐릭터·성격·직업·신뢰·출전 가능 판정
  pool.ts        캐릭터 풀과 임시 파티
  dungeon.ts     위험도·테마·생태 규칙·몬스터·보스·지도
  campaign.ts    길잡이 등급·명성·승급·엔딩 5종·단계
  worldturn.ts   월드턴 배정과 결과
  expedition.ts  원정 상태와 보스전 턴 기록
  info.ts        카드와 반응 (구조 유지)
  content.ts     아이템과 사건 태그
  seeds.ts       시드 스트림 이름
  errors.ts      생성 오류 (유지)
  index.ts       배럴
  __checks__.ts  컴파일 타임 계약
```

### 등급이 둘로 쪼개진다

`Grade`가 던전 난이도와 길잡이 자격을 함께 뜻하고 있었다. 이번 개편에서 둘은 다른 축이 된다.

| 옛 개념 | 새 타입 | 뜻 | 근거 문서 |
| --- | --- | --- | --- |
| `Grade` (던전) | `RiskLevel` | ★1~5. 지도 크기·보상·정보 기회를 정한다 | `DUNGEON_EVENTS_AND_BOSSES.md` |
| `Grade` (길잡이) | `GuideRank` | C·B·A·S. 진입 한계만 정한다 | `PROGRESSION_AND_ENDINGS.md` |

이름을 `Grade`에서 바꾸는 것이 중요하다. 같은 글자를 남기면 옛 의미가 따라온다.

### 설계에서 붙잡을 두 가지

**`initialRiskLevel`과 `riskLevel`을 따로 둔다.** 지점 수는 초기 위험도로 고정되고 보상·정보 기회·규칙 공개 수는 현재 위험도를 따른다. 한 필드로 두면 실패가 던전을 길게 만드는 잘못된 규칙이 된다.

**영속 파티 타입을 만들지 않는다.** `ExpeditionParty`는 원정 1회짜리다. 타입을 남겨 두면 어딘가에서 다시 캠페인 상태에 얹힌다. 원정이 끝나면 남는 것은 각 인물의 상태뿐이다.

### 시드 스트림

`pool` · `board` · `party` · `map` · `ecology` · `card` · `event` · `boss` · `trust` · `worldturn`

`ecology`와 `worldturn`이 새로 생긴다. 활성 규칙 추첨과 월드턴 배정이 다른 스트림을 소비해야, 한쪽 규칙을 고쳐도 다른 쪽 재현성이 흔들리지 않는다.

## 함께 갱신하는 설정집

배정표의 관리 원칙이 "규칙 수치를 바꾸면 근거 문서를 같은 변경 단위에서 함께 고친다"이므로 아래를 이 작업에 포함한다.

`docs/technical/DEVELOPMENT_ENVIRONMENT.md`
- 「난수와 재현성」에 **스트림 10개 목록**을 적는다. 지금은 분리 원칙만 있고 목록이 없어, 스트림 이름의 근거가 코드에만 존재하게 된다
- 예시 코드의 `PartyMember`를 `Character`로 고친다
- 「테스트」 절이 가리키는 예시 파일을 새 도메인 계약 테스트로 바꾼다

`docs/technical/F1_TESTING.md`는 **손대지 않는다.** 옛 개편의 스트림 11개 목록이 있지만 그때의 검증 기록이다. 지금 값으로 덮어쓰면 기록이 아니라 위조가 된다. `D6`이 `superpowers/`를 보존한 것과 같은 기준이다.

## 지우는 것

배정표가 다시 만들기로 한 영역이다.

| 영역 | 다시 만드는 항목 |
| --- | --- |
| `lib/rules/` 중 등급·영속 파티 전제 16개 | `C1`~`C8`, `E1`~`E4` |
| `lib/content/` 중 8개 (`info-cards.ts` 제외) | `F2`~`F5` |
| `lib/flow/`, `lib/stores/` | `I1` |
| `lib/backtest/` | `C7` |
| `lib/mock/`, `lib/dev-tools/` | 각 항목의 픽스처 |
| `components/game/` | `U1`~`U6` |
| `app/play/`와 검증 페이지들 | `U1`~`U6`, `I2` |

`lib/rules/trust*.ts`와 그 테스트는 이 목록에 없다. 한꺼번에 지우다 함께 날아가기 쉬우므로 삭제 뒤 남아 있는지 확인한다.

## 검증

`F1`은 규칙도 화면도 만들지 않으므로 동작을 확인할 대상이 없다. 합격 기준을 다음으로 둔다.

- `pnpm typecheck`·`pnpm lint`·`pnpm build` 통과
- 남은 테스트가 모두 통과하고, 줄어든 개수를 PR에 적는다
- `lib/domain/__checks__.ts`가 닫힌 목록이 실제로 닫혀 있는지를 타입으로 고정한다
- **그 계약이 실제로 발동하는지 확인한다.** 엔딩 하나를 순서 배열에서 빼 타입 검사가 깨지는 것을 보고 되돌린다

컴파일 타임 계약이 이번 `F1`의 유일한 자동 안전망이다. 규칙 테스트는 `C`·`E` 항목이 자기 규칙과 함께 가져온다.

선언 자리에서 이미 강제되는 계약(`RANK_RISK_LIMIT`의 `Record<GuideRank, RiskLevel>` 같은)은 `__checks__.ts`에 다시 적지 않는다. 같은 계약을 두 곳에 두면 한쪽만 고쳐진다.

## 이번 범위 밖

- 테마·카드·캐릭터·사건 콘텐츠 데이터 → `F2`~`F5`
- 규칙 구현 → `C`·`E` 항목
- 화면과 스토어 → `U`·`I` 항목
- 다이어그램 이미지 → `D7`

## 관련 문서

- [캠페인 개편 설계](2026-08-19-lattebun-campaign-rework-design.md)
- [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
- [캐릭터와 신뢰](../../systems/CHARACTERS_AND_TRUST.md)
- [캐릭터 풀과 월드턴](../../systems/CHARACTER_POOL_AND_WORLDTURN.md)
- [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)
- [던전 이벤트와 보스](../../systems/DUNGEON_EVENTS_AND_BOSSES.md)
- [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)
- [개발 환경](../../technical/DEVELOPMENT_ENVIRONMENT.md)
