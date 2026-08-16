import type { ReactNode } from "react";
import { PlayChrome } from "./play-chrome";
import { PlayCampaignProvider } from "./play-campaign-provider";

export default function PlayLayout({ children }: { children: ReactNode }) {
  return (
    <PlayCampaignProvider>
      <PlayChrome>{children}</PlayChrome>
    </PlayCampaignProvider>
  );
}
