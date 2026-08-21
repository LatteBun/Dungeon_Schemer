# F3-5 테마 전용 사건 확장 Spec 자기검토 보정

이 문서는 `2026-08-21-lattebun-f3-5-themed-event-expansion-design.md`의 자기검토 결과를 고정한다. 충돌 시 이 문서의 결정이 우선한다.

## 1. Placeholder / 범위 검토

- TBD/TODO 없음.
- F3-5는 기존 테마 사건 20개를 유지하고 신규 10개만 더한다.
- 새 도메인 field, ecology rule, monster, boss, clue 타입, validator 의미를 추가하지 않는다.
- 신규 30개는 보스 정보 사건이 아니며 `targetBossId`/`bossDamageModifier`를 사용하지 않는다.

## 2. 복합 special의 ecology source 고정

복합 special은 플레이어가 두 규칙을 함께 생각하도록 장면을 구성하지만, 현재 `AdviceOption.source`는 단일 ecology rule을 참조한다. 따라서 구현 시 H/X에 아래 **대표 source**를 사용한다. N은 기존 테마 중립 계약대로 ecology source 없이 `relation: "unrelated"`를 사용한다.

| 사건 | H 대표 source | X 대표 source | 복합 판단에 함께 쓰는 규칙 |
| --- | --- | --- | --- |
| `spider-special-carrion-dark-store` | `spider-shadow` / consistent | `spider-carrion` / contradictory | `spider-carrion` + `spider-shadow` |
| `spider-special-fire-shadow-lane` | `spider-shadow` / consistent | `spider-shadow` / contradictory | `spider-fire` + `spider-shadow` |
| `spider-special-vibration-carrion-floor` | `spider-vibration` / consistent | `spider-vibration` / contradictory | `spider-vibration` + `spider-carrion` |
| `spider-special-fire-brood-trap` | `spider-brood-light` / consistent | `spider-brood-light` / contradictory | `spider-fire` + `spider-brood-light` |
| `desert-special-water-dry-split` | `desert-spirit-dry` / consistent | `desert-water` / contradictory | `desert-water` + `desert-spirit-dry` |
| `desert-special-heat-water-well` | `desert-water` / consistent | `desert-water` / contradictory | `desert-heat` + `desert-water` |
| `desert-special-mummy-wind-trace` | `desert-wind-track` / consistent | `desert-wind-track` / contradictory | `desert-mummy-silent` + `desert-wind-track` |
| `desert-special-heat-lizard-trap` | `desert-lizard-heat` / consistent | `desert-lizard-heat` / contradictory | `desert-heat` + `desert-lizard-heat` |
| `graveyard-special-guard-desecration-tomb` | `graveyard-desecration` / consistent | `graveyard-desecration` / contradictory | `graveyard-guard` + `graveyard-desecration` |
| `graveyard-special-sound-light-hall` | `graveyard-ghoul-sound` / consistent | `graveyard-ghoul-sound` / contradictory | `graveyard-ghoul-sound` + `graveyard-light` |
| `graveyard-special-mage-archer-light` | `graveyard-light` / consistent | `graveyard-archer-light` / contradictory | `graveyard-light` + `graveyard-archer-light` |
| `graveyard-special-zombie-ghoul-sound-trap` | `graveyard-ghoul-sound` / consistent | `graveyard-ghoul-sound` / contradictory | `graveyard-silence` + `graveyard-ghoul-sound` |

대표 source 하나만 저장된다고 해서 복합 사건이 단일 규칙 문제가 되는 것은 아니다. **두 번째 규칙은 description과 선택의 의미를 해석하는 데 필요한 콘텐츠 단서**이며, 이를 위한 새 런타임 타입은 만들지 않는다.

## 3. monster source 규칙

신규 monster 18개는 원본 Spec의 `규칙` 항목을 그대로 H/X 대표 source로 사용한다.

- H: 해당 rule + `relation: "consistent"`
- X: 해당 rule + `relation: "contradictory"`
- N: source 없음 + `relation: "unrelated"`

이 규칙으로 각 테마의 신규 monster 6개가 ecology rule 6개에 정확히 하나씩 대응한다.

## 4. 문구 보정

원본 Spec의 묘지 신규 monster 제목 하나에 영문이 섞였다.

- 변경 전: `GR-M05 [직관] untouched grave goods`
- 최종 제목: `GR-M05 [직관] 손대지 않은 부장품`

제안 event ID `graveyard-guard-intact-offerings`와 나머지 내용은 유지한다.

## 5. 난이도 분포 재검산

각 테마 신규 10개는 다음을 정확히 만족한다.

### 거미굴
- monster: 직관 SP-M01, SP-M05 / 추론 SP-M03, SP-M04, SP-M06 / 함정 SP-M02
- special: 직관 SP-S01 / 추론 SP-S02, SP-S03 / 함정 SP-S04

### 사막
- monster: 직관 DE-M01, DE-M05 / 추론 DE-M03, DE-M04, DE-M06 / 함정 DE-M02
- special: 직관 DE-S01 / 추론 DE-S02, DE-S03 / 함정 DE-S04

### 묘지
- monster: 직관 GR-M01, GR-M05 / 추론 GR-M03, GR-M04, GR-M06 / 함정 GR-M02
- special: 직관 GR-S01 / 추론 GR-S02, GR-S03 / 함정 GR-S04

따라서 테마별 신규 10개 총 난이도는 `직관 3 / 추론 5 / 함정 2`로 일치한다.

## 6. 구현 우선순위

1. 기존 테스트를 먼저 30개 목표로 확장해 RED를 만든다.
2. 거미굴 +10.
3. 사막 +10.
4. 묘지 +10.
5. 전역 ID/문구 중복과 기존 clue·보스 정보 계약 회귀를 확인한다.
6. 작업 배정표 F3-5를 완료 처리한다.

이 보정까지 적용한 상태를 F3-5 구현 계획의 입력으로 사용한다.
