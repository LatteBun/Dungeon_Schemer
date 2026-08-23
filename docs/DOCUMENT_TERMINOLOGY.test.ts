import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 공식 문서의 용어 감시.
 *
 * 캠페인 개편은 도메인 모델과 난이도 축을 동시에 바꾸므로 폐기된 용어가
 * 문서 곳곳에 남는다. 이전 개편에서 `docs/systems/`만 훑었다가
 * `docs/design/CORE_GAME_LOOP.md`의 옛 값을 놓친 적이 있다. 사람이 눈으로
 * 훑는 대신 여기서 고정한다.
 *
 * `CLEANED_DOCS`는 개정이 끝난 문서만 담는다. D2~D6이 자기 문서를 정리할
 * 때 이 목록에 줄을 더한다. 아직 정리하지 않은 문서를 미리 넣으면 이 검사가
 * 상시 빨간불이 되어 아무도 보지 않게 된다.
 *
 * 위반은 모아서 한 번에 보여준다. 루프 안에서 바로 단정하면 위반이 여럿일 때
 * 첫 번째만 드러나 여러 번 고쳐야 한다.
 */

const DOCS_ROOT = import.meta.dirname;

/** 개편으로 폐기한 표현. 정리된 문서에 남아 있으면 안 된다. */
const RETIRED_TERMS: readonly string[] = [
  "완성 파티",
  "예비 인원",
  "지속 파티",
  "자동 재편",
  "승급 점수",
  "던전 등급",
  "길잡이 자격 박탈",
  "C 6개",
  "C→B→A→S",
  "현재 명성 0",
  "음수가 될 수 있음",
  "C 2회",
  "대기 명단",
  "지원 최소 명성",
  "현재 HP × 0.05",
  "C·B 3명 / A 4명 / S 5명",
  "등급별 지도",
  "갈래별 지점",
  "등급별 데이터",
  "등급별 전체 횟수",
  "A·S급",
  "카드 유형과 플레이어가 아는 사실",
  "예상되는 이득과 발각 위험",
  "F2 콘텐츠 데이터 계약",
  "F2 카드 콘텐츠 계약",
  "Task 6~7",
  "/f2-test",
  "처형 엔딩",
  "파티 소진",
  "용사들의 시대가 끝나다",
  "제한 없음",
  "정보·치료제·독·가짜 지도 등을 구매한다",
  "식량과 개별 물품은 원정 자원 또는 아이템으로 별도 관리한다",
];

/** 개정이 끝난 문서. D2~D6이 진행되면서 늘어난다. */
const CLEANED_DOCS: readonly string[] = [
  "GAME_PRINCIPLES.md",
  "design/GAME_OVERVIEW.md",
  "design/CORE_GAME_LOOP.md",
  "systems/DUNGEON_EVENTS_AND_BOSSES.md",
  "systems/INFORMATION_AND_DECEPTION.md",
  "systems/DUNGEON_THEMES_AND_ECOLOGY.md",
  "systems/CHARACTERS_AND_TRUST.md",
  "systems/CHARACTER_POOL_AND_WORLDTURN.md",
  "experience/SCREEN_LAYOUT.md",
  "experience/ONBOARDING_AND_INTERFACE.md",
  "systems/PROGRESSION_AND_ENDINGS.md",
  "README.md",
  "diagram/README.md",
  "diagram/campaign-state.md",
  "diagram/campaign-sequence.md",
  "diagram/expedition-state.md",
  "diagram/expedition-sequence.md",
  "diagram/screens.md",
];

/**
 * 폐기 용어를 지우는 것만으로는 문장을 통째로 삭제해도 통과한다.
 * 새 규칙이 실제로 적혔는지 앵커로 확인한다.
 */
const REQUIRED_ANCHORS: Readonly<Record<string, readonly string[]>> = {
  "GAME_PRINCIPLES.md": ["캐릭터 30명", "위험도", "테마 3종", "상인 사건", "현재 골드"],
  "design/GAME_OVERVIEW.md": ["캐릭터 30명", "위험도", "테마 3종"],
  "design/CORE_GAME_LOOP.md": [
    "월드턴",
    "위험도",
    "캐릭터 30명",
    "pending merchant effect",
    "일반 Depth",
    "방문한 사건",
  ],
  "systems/DUNGEON_EVENTS_AND_BOSSES.md": [
    "위험도별 지도",
    "재도전",
    "★5",
    "생태 규칙",
    "다음 전투",
    "정보 판매",
    "일반 Depth",
    "Depth 슬롯",
  ],
  "systems/INFORMATION_AND_DECEPTION.md": [
    "현재 위험도",
    "활성 규칙",
    "참조 규칙",
  ],
  "systems/DUNGEON_THEMES_AND_ECOLOGY.md": [
    "생태 규칙",
    "활성 규칙",
    "조건부 규칙",
    "거미굴",
  ],
  "systems/CHARACTERS_AND_TRUST.md": [
    "신뢰 0 누적",
    "출전 가능",
    "직업별 최대 HP",
  ],
  "systems/CHARACTER_POOL_AND_WORLDTURN.md": [
    "캐릭터 30명",
    "월드턴",
    "중상",
    "임시 파티",
  ],
  "experience/SCREEN_LAYOUT.md": [
    "3:2",
    "1920×1080",
    "레터박스",
    "화면 루트",
    "전체 점유",
    "data-canvas-layout",
    "색만으로",
  ],
  "experience/ONBOARDING_AND_INTERFACE.md": [
    "인트로",
    "위험도",
    "월드턴",
    "골드 부족",
    "효과 중복 불가",
    "여러 Depth",
  ],
  "systems/PROGRESSION_AND_ENDINGS.md": [
    "위험도별 보상",
    "하한 0",
    "인력 소진",
    "누적 고발",
  ],  "README.md": ["위험도", "테마 3종", "회의 기록"],
  "diagram/README.md": ["엔딩 5종", "화면 일곱 장", "생태 규칙", "REFERENCE_UI_01_CAMPAIGN_BOARD.png"],
  "diagram/campaign-state.md": ["엔딩 5종", "월드턴", "인력 소진"],
  "diagram/campaign-sequence.md": ["캐릭터 30", "월드턴", "승급하기"],
  "diagram/expedition-state.md": ["위험도", "월드턴", "활성 생태 규칙"],
  "diagram/expedition-sequence.md": ["활성 생태 규칙", "유형 비공개", "턴 단위"],
  /* D8 에서 인트로와 자동 전투가 더해져 여섯 장이 일곱 장이 됐다. */
  "diagram/screens.md": ["위험도", "활성 생태 규칙", "화면 일곱 장"],
};

function read(relativePath: string): string {
  // Windows에서 core.autocrlf가 CRLF로 체크아웃해도 검사가 동작하도록 통일한다.
  return readFileSync(join(DOCS_ROOT, relativePath), "utf8").replace(
    /\r\n/g,
    "\n",
  );
}

describe("공식 문서 용어", () => {
  it("정리된 문서에 폐기 용어가 없다", () => {
    const violations: string[] = [];

    for (const path of CLEANED_DOCS) {
      const text = read(path);
      for (const term of RETIRED_TERMS) {
        const count = text.split(term).length - 1;
        if (count > 0) {
          violations.push(`${path}: "${term}" ${count}건`);
        }
      }
    }

    expect(violations, "남아 있는 폐기 용어").toEqual([]);
  });

  it("정리된 문서에 새 규칙의 앵커가 있다", () => {
    const missing: string[] = [];

    for (const path of CLEANED_DOCS) {
      const text = read(path);
      for (const anchor of REQUIRED_ANCHORS[path] ?? []) {
        if (!text.includes(anchor)) {
          missing.push(`${path}: "${anchor}" 없음`);
        }
      }
    }

    expect(missing, "빠진 앵커").toEqual([]);
  });

  it("정리 목록의 모든 문서에 앵커가 정의돼 있다", () => {
    const undefinedAnchors = CLEANED_DOCS.filter(
      (path) => REQUIRED_ANCHORS[path] === undefined,
    );
    expect(undefinedAnchors, "앵커가 없는 정리 문서").toEqual([]);
  });
});
