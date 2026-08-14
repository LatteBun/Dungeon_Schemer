import type { BossDef, BossId, Grade } from "@/lib/domain";

function boss(
  id: string,
  grade: Grade,
  name: string,
  description: string,
  baseDamage: number,
): BossDef {
  return { id: id as BossId, grade, name, description, baseDamage };
}

export const BOSSES: readonly BossDef[] = [
  boss("boss-c", "C", "동굴의 수문장", "낮은 등급 던전의 입구를 지키는 보스다.", 8),
  boss("boss-b", "B", "검은 뿔의 사냥꾼", "흔적을 따라 파티를 추적하는 보스다.", 12),
  boss("boss-a", "A", "심연의 감시자", "정보를 숨긴 채 길목을 통제하는 보스다.", 17),
  boss("boss-s", "S", "무너뜨리는 군주", "가장 깊은 층에서 모든 경로를 압박하는 보스다.", 24),
];
