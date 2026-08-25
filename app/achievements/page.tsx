import type { Metadata } from "next";
import { Achievements } from "@/components/game/AchievementScreen";

export const metadata: Metadata = {
  title: "길잡이 업적 기록 | Dungeon Schemer",
  description: "캠페인 엔딩과 누적 통계로 해금한 길잡이 업적을 확인합니다.",
};

type AchievementSearchParams = Promise<{ returnTo?: string | string[] }>;

export function safeAchievementReturnTo(
  value: string | readonly string[] | undefined,
): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";

  try {
    const base = new URL("https://dungeon-schemer.local");
    const destination = new URL(value, base);
    if (destination.origin !== base.origin) return "/";
    if (destination.pathname.startsWith("/achievements")) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

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
