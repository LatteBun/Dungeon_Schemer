import { CampaignScreen } from "@/components/game/CampaignScreen";
import { CampaignStoreProvider } from "@/components/game/CampaignStoreProvider";
import { resolveCampaignSeed } from "./seed";

/**
 * 캠페인 한 판.
 *
 * 화면을 주소로 가르지 않는다. `phase` 가 정한다. 뒤로가기로 되살아난 문서도
 * 다시 그릴 때 현재 단계를 보므로 낡은 화면이 살아남지 못한다.
 *
 * `/uN-test` 는 그대로 둔다. 화면 하나를 여러 상태로 보는 자리는 통합 뒤에도
 * 필요하다.
 */
type CampaignSearchParams = Promise<{ seed?: string | string[] }>;

async function CampaignPage({ searchParams }: { searchParams: CampaignSearchParams }) {
  const { seed } = await searchParams;
  const value = resolveCampaignSeed(seed);

  return (
    <CampaignStoreProvider seed={value} explicitSeed={typeof seed === "string" && seed.length > 0}>
      <CampaignScreen />
    </CampaignStoreProvider>
  );
}

export default CampaignPage;
