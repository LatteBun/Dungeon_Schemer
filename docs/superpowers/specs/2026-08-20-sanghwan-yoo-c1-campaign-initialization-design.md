# C1 캠페인 초기화·생태 패키지 설계

## 문서 정보

- 작성자: SangHwan Yoo
- 작성 도구: Codex
- 최초 작성일: 2026-08-20
- 작업 항목: `C1`
- 상태: 승인됨
- 근거 문서: [게임 원칙](../../GAME_PRINCIPLES.md), [핵심 게임 루프](../../design/CORE_GAME_LOOP.md), [캐릭터 풀과 월드턴](../../systems/CHARACTER_POOL_AND_WORLDTURN.md), [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md), [성장과 엔딩](../../systems/PROGRESSION_AND_ENDINGS.md)

## 1. 목적과 범위

C1은 시드 하나로 첫 `CampaignState`를 만드는 순수 규칙이다. 고정된 던전 슬롯 15개에 테마 콘텐츠의 생태 패키지와 보스를 붙이고, 30명 캐릭터 풀과 시작 자원을 함께 만든다.

포함:

- 고정 ID·표시명·테마·초기 위험도를 가진 15개 던전 슬롯
- 규칙 3개와 출현 잡몹을 함께 묶은 생태 패키지의 위험도 호환 배정
- 캐릭터 풀, 보스, 시작 상태의 결정적 생성
- 콘텐츠 계약 오류의 구조화된 실패와 단위 테스트

제외:

- 공고 생성·임시 3인 편성·계약 전이 (`C2`)
- 카드 진위·개인 반응 (`E2`), 사건·몬스터 실행 (`E3`), 보스전 (`E4`)
- 상태 머신·Zustand·화면·저장

## 2. 데이터 경계

`lib/content/campaign-dungeons.ts`는 15개 고정 슬롯만 소유한다. 각 슬롯은 `DungeonId`, 표시명, `ThemeId`, `initialRiskLevel`을 가진다. ID와 이름은 모든 시드에서 같다.

`ThemeContent`에는 테마당 생태 패키지 5개를 추가한다. 패키지는 `EcologyProfileId`, 테마, 초기 위험도, 고유한 규칙 ID 3개, 같은 테마의 출현 잡몹 ID 1개 이상을 가진다. 패키지는 규칙과 잡몹의 의미 단위이므로 C1은 규칙 ID를 임의 조합하지 않는다.

`CampaignDungeon`에는 다음을 추가한다.

- `ecologyProfileId`: 배정된 패키지를 기록한다.
- `activeMonsterIds`: 그 던전의 사건·전투가 사용할 수 있는 잡몹 목록이다.

기존 `activeRuleIds`와 `bossId`는 유지한다. `E2`는 `activeRuleIds`를 읽고, `E3`은 `activeMonsterIds`만 후보로 사용한다.

## 3. 초기화 흐름

공개 API는 `initializeCampaign(seed: string): CampaignState`다. 시간·전역 상태·`Math.random()`을 읽지 않고 새 객체만 반환한다.

1. 고정 슬롯을 테마와 초기 위험도별로 묶는다.
2. 같은 테마·같은 초기 위험도를 가진 생태 패키지만 캠페인 시드와 테마 식별자로 만든 `ecology` 파생 RNG로 섞어 배정한다. 서로 다른 위험도 사이에서는 패키지를 옮기지 않는다.
3. 각 슬롯에 패키지의 `activeRuleIds`·`activeMonsterIds`와 `selectThemeBoss(theme, initialRiskLevel)`의 ID를 저장한다.
4. 기존 `generateCharacterPool(createRng(seed))`을 사용해 30명을 만든다.
5. `phase: "intro"`, C급, 명성 30, 골드 10, 누적 골드 0, `offers: []`, `worldTurn: 0`, `ending: null`인 상태를 반환한다.

같은 위험도 슬롯이 둘인 거미굴 ★1, 사막 ★2, 묘지 ★3만 시드에 따라 패키지 배정이 교환될 수 있다. 나머지 슬롯은 위험도 호환 패키지가 하나라 고정이다.

## 4. 검증과 오류 처리

테마 콘텐츠 검증기는 패키지의 수, 고유 ID, 정확히 규칙 3개, 규칙·잡몹의 테마 일치와 존재, 잡몹 목록의 비어 있지 않음·중복 없음, 위험도별 조건부 규칙 제약을 검사한다. C1은 슬롯 분포와 패키지 분포가 맞지 않거나 후보가 부족하면 `RuleError("INVALID_GENERATION")`으로 실패한다. 조용한 재추첨·대체는 금지한다.

테스트는 다음을 보장한다.

- 15개 슬롯·테마 5개씩·초기 위험도 3/4/4/3/1·고정 ID와 이름
- 패키지의 규칙 3개·출현 잡몹·보스가 슬롯 테마와 초기 위험도에 맞음
- ★1~3 조건부 규칙 없음, ★4~5 조건부 규칙 있음
- 동일 시드의 deep equal, 서로 다른 시드에서 같은 위험도 중복 슬롯의 유효한 패키지 교환
- 30명 풀과 시작 상태, 반환 값 간 참조 비공유
- 잘못된 패키지·부족한 패키지의 `INVALID_GENERATION` 실패

자동 검증은 관련 Vitest 테스트, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`다. C1은 UI를 렌더링하지 않으므로 브라우저 검증은 후속 화면·통합 작업의 책임이다.

## 5. 파일 경계

- 생성: `lib/content/campaign-dungeons.ts`, `lib/rules/campaign-init.ts`와 각 테스트
- 수정: `lib/domain/ids.ts`, `lib/domain/dungeon.ts`, `lib/domain/index.ts`, `lib/content/themes.ts`, `lib/content/theme-validation.ts`와 관련 테스트
- 문서: 이 spec, [던전 테마와 생태](../../systems/DUNGEON_THEMES_AND_ECOLOGY.md), [핵심 게임 루프](../../design/CORE_GAME_LOOP.md), [문서 색인](../../README.md), [작업 배정표](../../technical/CAMPAIGN_REWORK_WORK_ASSIGNMENT.md)

기존 F1 계약은 `activeMonsterIds`와 `ecologyProfileId`라는 최소 필드만 보완한다. 새 규칙·잡몹·보스 이름을 만들지 않으며, C2 이후 영역의 동작을 앞당겨 구현하지 않는다.
