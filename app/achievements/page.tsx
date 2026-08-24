import type { Metadata } from "next";
import { Achievements } from "@/components/game/AchievementScreen";

export const metadata: Metadata = {
  title: "길잡이 업적 기록 | Dungeon Schemer",
  description: "캠페인 엔딩과 누적 통계로 해금한 길잡이 업적을 확인합니다.",
};

export default function AchievementPage() {
  return <Achievements />;
}
