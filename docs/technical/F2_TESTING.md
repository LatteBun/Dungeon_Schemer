# F2 콘텐츠 계약 테스트 안내

## 대상 범위

F2는 사건·정보 카드·아이템·보스의 데이터 계약과 생성 불변식만 제공한다. 효과 태그는 선언적 입력이며 HP·신뢰·골드·피해·생존 계산은 Task 6~7에서 해석한다.

- 일반 사건 12개: `monster`, `rest`, `merchant`, `special` 각 3개
- 보스 사건: 1개 이상, 사건별 선택지 2개 이상
- 정보 카드 12개: `truth`, `lie`, `neutral` 각 4개, 보스 주제 2개 이상
- 아이템 5종: 치료제·독·식량·정보 두루마리·유인용 미끼
- 보스 4종: C/B/A/S 각 1개, 양의 정수 기본 피해
- 중복·부족·빈 문구·잘못된 태그·잘못된 수치는 `INVALID_GENERATION`으로 거부

가짜 지도 아이템과 보스 대상 선택지는 F2 콘텐츠에서 제공하지 않는다. 기존 역사적 mock의 호환용 대상은 별도 이행 범위로 보존한다.

## 자동 검증

정상 풀과 음성 fixture를 빠르게 확인한다.

~~~bash
pnpm test lib/content/content.test.ts lib/rules/dungeon.test.ts
pnpm test app/f2-test/f2-test-snapshot.test.ts
~~~

F1 회귀까지 포함한 전체 검증은 다음 순서로 실행한다.

~~~bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git diff --check
~~~

## 브라우저 검증

저장소 루트에서 `pnpm dev`를 실행하고 `/f2-test?seed=alpha`를 연다.

1. `f2-f1-campaign`, `f2-f1-expedition`에서 seed `alpha`, board/C, F1 fixture 수량을 확인한다.
2. `f2-content-status`가 검증 성공인지 확인한다.
3. `f2-events`에서 일반 사건 12개, 네 분류별 3개, 사건별 선택지 2개 이상을 확인한다.
4. `f2-cards`에서 유형별 4개와 보스 주제 2개 이상을 확인한다.
5. `f2-items`에 유인용 미끼가 있고 가짜 지도가 없음을 확인한다.
6. `f2-bosses`와 `f2-capacity`에서 C/B/A/S와 6/8/10/12 요구량의 통과를 확인한다.
7. `f2-negative-cases`의 5개 fixture가 모두 `INVALID_GENERATION`으로 통과하는지 확인한다.
8. `f2-reproducibility`에서 같은 seed 재현이 통과하는지 확인하고 seed 입력을 키보드로 제출한다.
