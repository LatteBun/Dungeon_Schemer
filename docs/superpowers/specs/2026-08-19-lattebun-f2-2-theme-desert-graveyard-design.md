# F2-2 테마 콘텐츠·사막·묘지 설계

작성 도구: Claude Code (Opus 5)

## 이 문서의 지위

[캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)의 `F2-2`를 구현한다. 규칙의 근거는 [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)에 있고, 형식 계약은 `F2-1`(거미굴)이 이미 구현한 타입·검증기를 그대로 따른다. 확정된 몬스터·보스 이름은 [F2-2 메모](2026-08-19-lattebun-f2-2-theme-desert-graveyard-notes.md)에서 가져왔다.

## 재사용하는 것

`F2-1`이 이미 만든 것을 다시 짓지 않는다.

- `lib/domain/dungeon.ts`의 `BossDef.minRiskLevel`·`ThemeContent.bosses` — 타입 변경 없음
- `lib/content/theme-validation.ts`의 `validateThemes` — 테마 배열을 받는 형태로 이미 짜여 있어 그대로 재사용
- `lib/content/themes.ts`의 `selectThemeBoss` — 변경 없음

이번에 하는 일은 `THEMES` 배열에 사막·묘지 두 항목을 더하는 것뿐이다.

## 보스 수치를 재사용하는 이유

`F2-1`이 쓴 위험도 구간별 수치(baseDamage 14/19/25/32, maxHp 100/150/210/280)를 사막·묘지에도 그대로 쓴다. 난이도를 정하는 축은 위험도 구간이고 테마는 그 구간을 무엇으로 부르느냐일 뿐이라는 전제다. 테마마다 다른 수치를 임의로 지어내면 그 차이가 무엇을 뜻하는지 설명할 근거가 없다. 세 테마의 체감이 실제로 달라야 한다면 그건 백테스트가 알려줄 일이지 지금 추측할 일이 아니다.

## 사막

### 생태 규칙 6개

테마 성격("더위와 갈증. 열기·물·발자국이 얽힌다")의 세 축(열기 / 물 / 발자국)마다 일반 규칙과 예외를 배치한다.

| `id` | `text` | `conditional` |
| --- | --- | :-: |
| `desert-heat` | 사막코브라는 낮의 열기를 피해 그늘에서만 움직인다 | — |
| `desert-lizard-heat` | 모래도마뱀은 오히려 뜨거운 모래 위에서 몸을 데운 뒤 낮에도 활발히 움직인다 | O |
| `desert-water` | 사막전갈은 물기가 있는 곳 근처에 굴을 파고 숨어 있다 | — |
| `desert-spirit-dry` | 모래정령은 물기가 전혀 없는 완전한 건조 지대에서만 나타난다 | O |
| `desert-mummy-silent` | 미이라는 발소리 없이 미끄러지듯 움직여 발자국을 남기지 않는다 | — |
| `desert-wind-track` | 사막에서는 바람이 발자국을 금방 지운다 | — |

`desert-water`만 아는 플레이어는 "물가를 조심하라"는 카드를 진실로 읽는다. 그 지점의 몬스터가 모래정령이라면 `desert-spirit-dry`가 활성 규칙일 때 같은 카드가 모순이 된다.

### 몬스터 5종

| `id` | `name` | `traits` |
| --- | --- | --- |
| `desert-scorpion` | 사막전갈 | 물가 근처에 굴을 팜, 밤에 활동 |
| `desert-lizard` | 모래도마뱀 | 열을 저장함, 낮에 활동 |
| `desert-cobra` | 사막코브라 | 그늘 선호, 열기에 예민 |
| `desert-spirit` | 모래정령 | 건조 지대 서식, 물기를 꺼림 |
| `desert-mummy` | 미이라 | 발자국을 남기지 않음, 무덤 수호 |

### 보스 4종 (`minRiskLevel` 오름차순)

| `minRiskLevel` | `name` | `description` |
| ---: | --- | --- |
| 1 | 거대 전갈 자카르 | 모래 아래 숨어 있다가 지나가는 발소리에 튀어나오는 거대 전갈이다 |
| 2 | 샌드웜 카르둠 | 모래 바다를 헤엄치듯 이동하며 진동으로 사냥감을 좇는다 |
| 3 | 모래거신 오벨론 | 무너진 신전의 돌더미가 뭉쳐 일어난 거대한 존재다 |
| 4 | 스핑크스 네프리스 | 사막 깊은 곳의 마지막 관문을 지키며 답을 요구한다 |

## 묘지

### 생태 규칙 6개

테마 성격("정숙과 부정. 빛·소리·매장물이 얽힌다")의 세 축(소리 / 빛 / 매장물)마다 일반 규칙과 예외를 배치한다.

| `id` | `text` | `conditional` |
| --- | --- | :-: |
| `graveyard-silence` | 썩은 좀비는 소리에 둔감해 조용히 지나가도 쉽게 알아채지 못한다 | — |
| `graveyard-ghoul-sound` | 구울은 아주 작은 소리에도 민감하게 반응해 숨죽여도 쉽게 들킨다 | O |
| `graveyard-light` | 해골 마법사는 빛을 향해 다가온다 | — |
| `graveyard-archer-light` | 스켈레톤 궁수는 빛에 노출되면 오히려 그림자 속으로 숨어버린다 | O |
| `graveyard-guard` | 부장품이 그대로 남아 있는 무덤은 스켈레톤 병사가 지키고 있을 가능성이 크다 | — |
| `graveyard-desecration` | 매장물을 훔쳐 가면 그 무덤을 지키던 존재가 더 사납게 반응한다 | — |

`graveyard-silence`만 아는 플레이어는 "조용히 움직이라"는 카드를 항상 진실로 읽는다. 그 지점의 몬스터가 구울이라면 `graveyard-ghoul-sound`가 활성 규칙일 때 같은 카드가 모순이 된다.

### 몬스터 5종

| `id` | `name` | `traits` |
| --- | --- | --- |
| `graveyard-zombie` | 썩은 좀비 | 소리에 둔감, 느림 |
| `graveyard-ghoul` | 구울 | 소리에 민감, 시체를 먹음 |
| `graveyard-soldier` | 스켈레톤 병사 | 부장품 수호, 정지 상태로 매복 |
| `graveyard-archer` | 스켈레톤 궁수 | 빛을 피함, 원거리 공격 |
| `graveyard-mage` | 해골 마법사 | 빛에 이끌림, 원거리 마법 |

### 보스 4종 (`minRiskLevel` 오름차순)

| `minRiskLevel` | `name` | `description` |
| ---: | --- | --- |
| 1 | 스켈레톤 장군 바르칸 | 부하 해골들을 정렬시켜 무덤 입구를 지키는 지휘관이다 |
| 2 | 리치 모르비안 | 죽음의 마법으로 주변 시체를 조종하는 언데드 마법사다 |
| 3 | 사신 아즈라엘 | 정해진 자를 거두러 온다는 소문이 도는 존재다 |
| 4 | 데스나이트 발드라크 | 생전의 맹세에 묶여 무덤 가장 깊은 곳을 떠나지 못하는 기사다 |

## 검증

`F2-1`의 `lib/content/theme-validation.test.ts`가 이미 계약 위반마다의 실패를 확인하므로 다시 쓰지 않는다. `lib/content/themes.test.ts`에 다음을 추가한다.

- `THEMES.length`가 3이 되었는지, `desert`·`graveyard` ID가 있는지
- 사막·묘지 각각 `validateThemes([...THEMES])` 통과
- `selectThemeBoss`가 사막·묘지에서도 ★1~★5에 올바른 보스를 고르는지(★4·★5가 같은 보스로 묶이는지 포함)

## 이번 범위 밖

- 카드 풀과 진위 조합 검증 → `F3`
- 사건·아이템 콘텐츠 → `F5`
- 캠페인 초기화에서 테마별 던전 5개를 실제로 배정하는 것 → `C1`
- 활성 규칙 추첨과 카드 정합·모순 판정 → `E2`
- 보스전 턴 진행과 피해 계산 → `E4`

## 관련 문서

- [F2-1 거미굴 설계](2026-08-19-lattebun-f2-1-theme-spider-design.md)
- [F2-2 사막·묘지 메모](2026-08-19-lattebun-f2-2-theme-desert-graveyard-notes.md)
- [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md)
- [캠페인 개편 작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)
