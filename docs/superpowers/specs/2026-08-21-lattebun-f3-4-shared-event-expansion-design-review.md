# F3-4 Spec Self-Review Resolution

이 문서는 `2026-08-21-lattebun-f3-4-shared-event-expansion-design.md` 작성 직후 수행한 self-review 결과를 확정한다.

## 1. 확정 수정 — `shared-merchant-barter`

본 Spec 초안의 Section 6에서 `shared-merchant-barter` 편입 위치를 구현 Plan 단계로 미뤄둔 문장은 폐기한다.

최종 결정은 다음과 같다.

- 기존 `shared-merchant-barter`는 유지한다.
- merchant `가격/흥정` 상황군의 **M02**로 편입한다.
- 초안의 신규 M02 `두 개의 가격표` 사건은 삭제한다.
- 따라서 가격/흥정 상황군은 아래 정확히 5개다.
  1. M01 `저울` — 기존
  2. M02 `이름표` — 기존 `shared-merchant-barter`
  3. M03 `동전 세는 손` — 신규
  4. M04 `묶음 할인` — 신규
  5. M05 `마지막 하나` — 신규
- merchant 총량은 정확히 30으로 유지한다.

이 결정은 원본 Spec의 M02와 Section 6에 반영됐다. 런타임 사건 제목은 Section
표기의 편집 주석을 제외한 `이름표`다.

### M02 [직관] 이름표 — 기존 유지

**상황:** 상인이 물자와 바꾸자며 파티의 짐을 살핀다. 파티가 챙겨 나온 유품에는 아직 주인의 이름표가 달려 있다.

- H: `유품 말고 여분의 무기를 내주라고 하세요` → 여분 무기와 물자를 바꾸고 유품은 그대로 남긴다.
- X: `유품을 이름표째 넘기라고 하세요` → 이름표가 달린 유품이 시장에 돌아 길드에 소문이 들어간다.
- N: `교환하지 말라고 하세요` → 아무것도 바꾸지 않고 거래를 끝낸다.

## 2. 기존 15개 최종 편입

### rest 5

- `shared-rest-wound` → R01
- `shared-rest-ration` → R06
- `shared-rest-water` → R07
- `shared-rest-fire` → R16, 단서 보강
- `shared-rest-watch` → R21

### merchant 5

- `shared-merchant-scale` → M01
- `shared-merchant-barter` → M02
- `shared-merchant-potion` → M06
- `shared-merchant-credit` → M11
- `shared-merchant-scout` → M16

### special 5

- `shared-special-tripwire` → S01
- `shared-special-camp` → S06
- `shared-special-chasm` → S11
- `shared-special-scrawl` → S26
- `shared-special-contract` → **교체 대상**, S30 `무거운 전리품`으로 대체

즉 기존 15개 중 14개 소재를 유지하고, 1개(`shared-special-contract`)를 중복 트릭 제거 목적으로 교체한다.

## 3. Self-review 결과

- Placeholder scan: 구현 결정을 미룬 항목 제거 완료.
- Internal consistency: `30 × 3 = 90`, `6상황군 × 5개` 구조 유지.
- Scope check: F3-4 공용 사건 확장과 최소 파일 분리에 한정됨.
- Ambiguity check: 기존 15개 편입 위치 확정 완료.
- 런타임에 `difficulty` / `subcategory` 신규 필드를 추가하지 않는 원칙 유지.
- 기존 validator 계약을 완화하지 않는 원칙 유지.
- 모든 조언의 고블린 근거 대사(`line`)·effect tag와 모든 사건의 기본 결과
  (`defaultResultText`)는 기존 런타임 계약의 필수 필드로 명시했다.
- 전역 advice ID, 제목·묘사·선택 문구 중복, 빈 effect tag는 F3-4 콘텐츠 테스트로
  검증한다. 이는 validator 계약을 넓히지 않는다.

이 문서의 결정은 본 Spec 초안의 상충 문장보다 우선한다.
