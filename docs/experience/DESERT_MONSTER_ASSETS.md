# 사막 몬스터 UI 에셋

## 목적

사막 테마의 잡몹·보스 이미지를 향후 UI에서 재사용하기 위한 자산 카탈로그다. 게임 규칙과 출현 여부는 [던전 테마와 생태](../systems/DUNGEON_THEMES_AND_ECOLOGY.md)가 소유하고, 이 문서는 그 콘텐츠를 표시할 때 사용할 정적 파일의 경로와 시각 규칙을 소유한다.

## 정적 경로

저장소 디렉터리 이름은 도메인의 `ThemeId`와 같은 `desert`를 쓴다. 처음에는 기존 경로와의 호환성을 위해 오타인 `dessert`를 유지했지만, 화면이 테마로 자산을 찾기 시작하면서 도메인 이름과 폴더 이름이 어긋나는 값이 늘었다. 그 어긋남을 코드에서 매번 잇는 대신 한 번 바로잡았다. 같은 이유로 `tomb`도 `graveyard`로 바꿨다.

브라우저에서 사용하는 정적 경로는 다음 형식이다.

```text
/assets/monsters/desert/<파일명>.png
```

## 공식 매핑

| 구분 | 공식 콘텐츠 | 정적 경로 | 원본 해상도 |
| --- | --- | --- | --- |
| 잡몹 | 사막전갈 | `/assets/monsters/desert/monster-desert-scorpion.png` | 1024×1024 |
| 잡몹 | 모래도마뱀 | `/assets/monsters/desert/monster-desert-lizard.png` | 1024×1024 |
| 잡몹 | 사막코브라 | `/assets/monsters/desert/monster-desert-cobra.png` | 1254×1254 |
| 잡몹 | 모래정령 | `/assets/monsters/desert/monster-desert-spirit.png` | 1254×1254 |
| 잡몹 | 미이라 | `/assets/monsters/desert/monster-desert-mummy.png` | 1254×1254 |
| 보스 ★1 | 거대 전갈 자카르 | `/assets/monsters/desert/boss-desert-01-zakar.png` | 1254×1254 |
| 보스 ★2 | 샌드웜 카르둠 | `/assets/monsters/desert/boss-desert-02-kardum.png` | 1024×1024 |
| 보스 ★3 | 모래거신 오벨론 | `/assets/monsters/desert/boss-desert-03-obelon.png` | 1024×1024 |
| 보스 ★4~5 | 스핑크스 네프리스 | `/assets/monsters/desert/boss-desert-04-nephris.png` | 1254×1254 |

보스의 위험도 구간은 초기 위험도에 따른 공식 테마 계약을 따른다. 이미지 파일명이나 표시 순서만으로 위험도·피해·체력·출현 패키지를 새로 계산하지 않는다.

## 검수 manifest

자동 검수와 향후 UI 자산 매핑이 필요할 때는 [`DESERT_MONSTER_ASSETS`](../../components/game/DesertMonsterAssets.ts)의 9종 manifest를 먼저 사용한다. 이 manifest는 `id`, 공식 이름, `kind`, 정적 경로, 설명을 제공하지만 게임 도메인의 출현 규칙이나 위험도를 정의하지 않는다.

manifest와 이 문서의 경로가 달라지면 실제 `public/assets/monsters/desert/` 파일을 기준으로 수정하고, PNG 계약 테스트와 카탈로그를 함께 확인한다.

## 향후 UI 사용 규칙

### 진행 화면

진행 화면의 장면 슬롯이나 몬스터 정보 영역에서 현재 사건·전투가 가리키는 사막 몬스터 또는 보스를 표시할 때 이 카탈로그의 경로를 사용한다. 활성 패키지에 없는 몬스터를 장식용으로 추가하지 않는다.

### 정보·보스 패널

향후 사막 몬스터 상세, 보스 정보, 보스전 준비 패널을 만들 때 공식 도메인 데이터의 `MonsterId`·`BossId`에 해당하는 이미지만 매핑한다. 콘텐츠 이름과 이미지가 어긋나지 않도록 데이터 매핑을 UI 컴포넌트 안에서 임의로 재작성하지 않는다.

### 게시판·정산 UI

현재 화면 규격은 게시판 카드에 몬스터 이미지를 필수로 요구하지 않는다. 이후 공고 미리보기나 정산 결과에 몬스터·보스 이미지를 배치하도록 승인되면 이 카탈로그를 먼저 사용하고, 해당 UI 작업 문서에 슬롯 비율과 표시 크기를 기록한다.

## 표시 기준

- 모든 원본은 정사각형이다. 기본 표시 방식은 비율 왜곡이 없는 `object-fit: contain`으로 한다.
- 원본을 임의로 다시 저장하거나 리사이즈하지 않는다. 목표 슬롯보다 원본이 큰 경우 UI 표시 크기에서 축소한다.
- `cover` crop이 필요한 화면은 해당 UI 작업 문서에서 피사체가 잘리지 않는지 확인하고 별도로 승인한다.
- 색상이나 이미지 자체를 게임 규칙의 단서로 추가하지 않는다. 플레이어가 알아야 할 생태 규칙과 환경 특성은 공식 테마 문서와 화면 설계에 따른다.
- 사막 에셋을 새로 만들거나 교체할 때는 [UI 구현 가이드](UI_IMPLEMENTATION_GUIDE.md)와 [화면 규격](SCREEN_LAYOUT.md)을 함께 확인한다.

## 관련 문서

- [던전 테마와 생태](../systems/DUNGEON_THEMES_AND_ECOLOGY.md)
- [UI 구현 가이드](UI_IMPLEMENTATION_GUIDE.md)
- [화면 규격](SCREEN_LAYOUT.md)

이 카탈로그는 콘텐츠 규칙을 새로 정의하지 않는다. 몬스터·보스 목록, 생태 패키지, 위험도 구간은 [던전 테마와 생태](../systems/DUNGEON_THEMES_AND_ECOLOGY.md)를 기준으로 한다.
