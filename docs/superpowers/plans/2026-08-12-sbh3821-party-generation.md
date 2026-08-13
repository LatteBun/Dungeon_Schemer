# R1 파티 생성 규칙 실행 계획

- 작성일: 2026-08-12
- 작성자: sbh3821
- 근거 spec: [파티 생성 규칙 설계](../specs/2026-08-12-sbh3821-party-generation-design.md)

## 단계

1. **콘텐츠 데이터 추가**
   - `lib/content/classes.ts`: 초기 직업 5종 `ClassDef` 배열 (`CLASSES`)
   - `lib/content/names.ts`: 이름 풀 12개 이상 (`MEMBER_NAMES`)
2. **규칙 구현**
   - `lib/rules/party.ts`: 성격별 초기 신뢰 기본값 상수, `generateParty(rng, options?)` 구현
   - spec의 생성 절차 6단계를 따른다. 직업 풀이 인원보다 작으면 오류.
3. **테스트 작성**
   - `lib/rules/party.test.ts`: spec의 테스트 계획 7항목
   - 테스트 규약 준수: `@/` 임포트, `vitest` 명시 임포트, 한국어 설명
4. **공식 문서 갱신**
   - `docs/systems/PARTY_AND_TRUST.md` 파티 생성 절에 중복 불허 규칙 추가
5. **배정표 갱신**
   - R1 담당 `sbh3821`, 상태 갱신
6. **검증**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test` 통과 확인 (Codespaces)

## 완료 기준

- 같은 시드 → 같은 파티 재현 테스트 통과
- 중복 불허·신뢰 범위·인원 3~5 테스트 통과
- 병합 전 검증 명령 통과
