import { U4Preview } from "@/components/game/U4Preview";

interface U4TestPageProps {
  searchParams: Promise<{
    dead?: string | string[];
    theme?: string | string[];
  }>;
}

export default async function U4TestPage({ searchParams }: U4TestPageProps) {
  const params = await searchParams;
  return (
    <U4Preview
      deadPreview={params.dead === "1"}
      themeId={params.theme === "spider" ? "spider" : undefined}
    />
  );
}
