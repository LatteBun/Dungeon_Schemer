import { U1Preview } from "@/components/game/U1Preview";

type U1TestSearchParams = Promise<{
  screen?: string | string[];
}>;

async function U1TestPage({
  searchParams,
}: {
  searchParams: U1TestSearchParams;
}) {
  const { screen } = await searchParams;
  const initialScreen = screen === "board" ? "board" : "intro";

  return <U1Preview initialScreen={initialScreen} />;
}

export default U1TestPage;
