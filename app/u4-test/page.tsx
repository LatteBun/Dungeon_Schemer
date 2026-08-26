import { U4Preview } from "@/components/game/U4Preview";
import { THEME_IDS, type ThemeId } from "@/lib/domain";

interface U4TestPageProps {
  searchParams: Promise<{
    dead?: string | string[];
    theme?: string | string[];
  }>;
}

function themeIdFrom(
  value: string | string[] | undefined,
): ThemeId | undefined {
  if (typeof value !== "string") return undefined;
  return THEME_IDS.find((themeId) => themeId === value);
}

export default async function U4TestPage({ searchParams }: U4TestPageProps) {
  const params = await searchParams;
  return (
    <U4Preview
      deadPreview={params.dead === "1"}
      themeId={themeIdFrom(params.theme)}
    />
  );
}
