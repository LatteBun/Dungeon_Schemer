import { createSeed } from "@/lib/rng";

export function resolveCampaignSeed(
  seed: string | string[] | undefined,
  generateSeed: () => string = createSeed,
): string {
  return typeof seed === "string" && seed.length > 0 ? seed : generateSeed();
}
