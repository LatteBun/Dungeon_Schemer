import type { BossDef, BossId, Grade } from "@/lib/domain";

function boss(
  id: string,
  grade: Grade,
  name: string,
  description: string,
  baseDamage: number,
  maxHp: number,
): BossDef {
  return { id: id as BossId, grade, name, description, baseDamage, maxHp };
}

/**
 * 등급별 보스 데이터다.
 *
 * `baseDamage`는 한 턴에 주는 피해이고 `maxHp`는 파티가 깎아야 하는 양이다. 두
 * 값이 함께 전투 길이를 정한다. 3인 파티의 공격력 합이 대략 30 안팎이므로 HP는
 * C 약 3턴, S 약 8턴이 되도록 잡았다.
 *
 * 턴제로 바뀌기 전 `baseDamage`는 전투 내내 한 번 주는 값이었고 C 26 · B 34 ·
 * A 44 · S 52였다. 그대로 매 턴 적용하면 S급이 확정 전멸이라 낮췄다. 이 수치는
 * 백테스트 재실행 전의 첫 시도다.
 * docs/superpowers/specs/2026-08-17-sbh3821-turn-based-boss-fight-design.md
 */
export const BOSSES: readonly BossDef[] = [
  boss("boss-c", "C", "동굴의 수문장", "낮은 등급 던전의 입구를 지키는 보스다.", 14, 100),
  boss("boss-b", "B", "검은 뿔의 사냥꾼", "흔적을 따라 파티를 추적하는 보스다.", 19, 150),
  boss("boss-a", "A", "심연의 감시자", "정보를 숨긴 채 길목을 통제하는 보스다.", 25, 210),
  boss("boss-s", "S", "무너뜨리는 군주", "가장 깊은 층에서 모든 경로를 압박하는 보스다.", 32, 280),
];
