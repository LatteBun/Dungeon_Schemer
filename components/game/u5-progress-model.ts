import type { ThemeId } from "@/lib/domain";

/**
 * U5 던전 진행 화면의 모델 경계.
 *
 * 화면은 ExpeditionState 를 직접 읽지 않는다. 사건 물질화(E3)가 아직 없지만
 * 조언 판정(E2)은 이미 있으므로, 이 파일은 화면이 받을 모양만 정하고 값은
 * E2 의 실제 함수와 E3 가 낼 사건에서 온다.
 */

/**
 * 장면 슬롯이 고르는 지점 성격.
 *
 * EventKind 는 monster·rest·merchant·special 넷이지만, entry 와 boss 는 사건
 * 종류가 아니라 지점 성격이다. 그래서 장면 선택은 EventKind 가 아니라 이
 * 타입으로 정한다.
 */
export const U5_SCENE_KINDS = [
  "entry",
  "monster",
  "rest",
  "merchant",
  "special",
  "boss",
] as const;

export type U5SceneKind = (typeof U5_SCENE_KINDS)[number];

/**
 * 자산 폴더 이름을 도메인 ThemeId 와 같게 맞춰 두었으므로 변환 없이 잇는다.
 * 매핑 표를 다시 만들지 않는다. 표가 생기는 순간 도메인과 자산이 또 갈라진다.
 */
export function sceneSrc(theme: ThemeId, kind: U5SceneKind): string {
  return `/assets/u5/dungeon-progress-scenes/${theme}/${kind}.png`;
}
