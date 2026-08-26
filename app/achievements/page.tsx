import type { Metadata } from "next";
import { Achievements } from "@/components/game/AchievementScreen";
import { safeAchievementReturnTo } from "@/lib/achievements/achievement-return-to";

export const metadata: Metadata = {
  title: "길잡이 업적 기록 | Dungeon Schemer",
  description: "캠페인 엔딩과 누적 통계로 해금한 길잡이 업적을 확인합니다.",
};

type AchievementSearchParams = Promise<{ returnTo?: string | string[] }>;

export default async function AchievementPage({ searchParams }: {
  readonly searchParams: AchievementSearchParams;
}) {
  const { returnTo } = await searchParams;
  return (
    <Achievements
      backAction={{ kind: "link", href: safeAchievementReturnTo(returnTo) }}
    />
  );
}
