# F1 기반 계약 테스트 안내

## F1의 범위

F1은 캠페인 전체를 플레이하는 기능이 아니라, 이후 C1~I1이 공유할 기반 계약을 고정한다.

- CampaignState와 ExpeditionState의 상태 경계
- C/B/A/S 등급과 캠페인 단계 목록
- 던전·파티·공고·아이템의 브랜드 ID
- 개인 HP·신뢰·소지 골드·기억을 보존하는 CampaignMember
- 지도 노드·경로·정보 기회·보스 결과 계약
- 카드 수신자를 용사 개인으로 제한하는 Target
- RuleError의 코드·메시지·상세 정보
- 캠페인 영역별 결정적 RNG stream 이름

F1 페이지에서 게시판 선택이나 전투를 진행하지 않는 것은 누락이 아니다. 실제 한 사이클은 C1~I1 통합 범위에서 연결한다.

## 브라우저에서 확인하기

저장소 루트에서 다음을 실행한다.

~~~bash
pnpm dev
~~~

브라우저에서 http://localhost:3000/f1-test 를 연다.

페이지에서 다음을 확인한다.

1. 계약 로드 성공 배지가 보인다.
2. 캠페인 상태에 board / C, 명성 0, 현재 골드 10, 누적 골드 0이 표시된다.
3. fixture 수량이 던전 1개, 완성 파티 1팀, 예비 인원 0명으로 표시된다.
4. 탐험 상태에 dungeon-001, party-001, 지도 지점 2개가 표시된다.
5. 지도 표에서 입구가 정보 기회를 가지고 보스 관련 카드 1개를 보장하는지 확인한다.
6. 난수 스트림 11개(dungeon, party, reserve, carriedGold, board, map, card, trust, event, boss, regroup)가 모두 보인다.
7. 구조화 오류에 INVALID_TRANSITION, 메시지, phase와 expected 상세 정보가 보인다.
8. 시드 입력에 alpha를 넣고 제출한 뒤 URL이 /f1-test?seed=alpha가 되는지 확인한다.
9. 같은 alpha를 다시 제출했을 때 시드와 나머지 계약 화면이 동일한지 확인한다.

## 자동 검증

F1만 빠르게 검증하려면:

~~~bash
pnpm test lib/domain/campaign.test.ts lib/domain/expedition.test.ts lib/domain/errors.test.ts lib/rng/streams.test.ts
~~~

기존 도메인·난수 회귀까지 포함하려면:

~~~bash
pnpm test lib/domain lib/rng
~~~

PR 전 전체 검증은 다음 순서로 실행한다.

~~~bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
git diff --check
~~~

타입 오류는 CampaignState와 ExpeditionState의 계약이 기존 단일 런 타입과 섞였는지 먼저 확인한다. F1은 기존 RunState를 삭제하지 않고 다음 이행 작업을 위해 보존한다.

## F2 연동 화면

F1 fixture를 F2 콘텐츠 풀과 함께 확인하려면 `/f2-test?seed=alpha`를 연다. `f2-f1-campaign`과 `f2-f1-expedition`의 seed·phase·rank·fixture 수량이 이 페이지의 값과 같아야 하며, F2의 콘텐츠 검증·음성 fixture·재현성은 [F2 콘텐츠 계약 테스트 안내](F2_TESTING.md)를 따른다. 기존 `/f1-test`의 계약 값과 화면은 F2 연동 링크 추가 외에 바뀌지 않아야 한다.
