import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppAudioProvider } from "@/components/game/AppAudioProvider";
import { AppBattlePlaybackRateProvider } from "@/components/game/AppBattlePlaybackRateProvider";
import { AppFrame } from "@/components/game/AppFrame";
import { PlayerProgressProvider } from "@/components/game/PlayerProgressProvider";
import { ScreenFit } from "@/components/game/ScreenFit";
import "./globals.css";
import "./main-menu.css";
import "../components/game/u3-promotion-motion.css";
import "./u2-intro.css";
import "./u3-board.css";
import "./u3-card-theme.css";
import "./u3-large-screen.css";
import "./u3-contract-layout.css";
import "./u3-responsive-layout.css";
import "./party-card.css";
import "./u5-progress.css";
import "./u5-battle.css";
import "./u6-result.css";
import "./u4-dungeon-map.css";
import "./u4-dungeon-map-fixes.css";
import "./achievements.css";
import "./app-frame.css";
import "./screen-fit.css";

export const metadata: Metadata = {
  title: "Dungeon Schemer",
  description: "Dungeon Schemer prototype",
  /* iOS 는 manifest 의 display 를 읽지 않는다. 홈 화면 앱 여부를 따로 말해 준다. */
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Dungeon Schemer" },
  /*
   * Next 는 표준형 `mobile-web-app-capable` 만 낸다. 예전 iOS 는 apple 접두사가
   * 붙은 쪽만 읽으므로 둘 다 둔다 — 이것이 없으면 홈 화면에서 열어도 주소창이 남는다.
   */
  other: { "apple-mobile-web-app-capable": "yes" },
};

/*
 * 판은 화면에 꼭 맞고, 손가락으로 늘리지 않는다.
 *
 * 고정 비율 판이라 확대·축소가 뜻이 없고, 두 손가락이 미끄러지면 판이 어긋난
 * 채로 남는다. `viewportFit: "cover"` 는 노치 있는 기기에서 판이 가장자리까지
 * 가게 한다.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#120e0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-ink font-sans text-parchment antialiased">
        <div className="game-canvas">
          <PlayerProgressProvider>
            <AppAudioProvider>
              <AppBattlePlaybackRateProvider>
                <AppFrame>{children}</AppFrame>
              </AppBattlePlaybackRateProvider>
            </AppAudioProvider>
          </PlayerProgressProvider>
        </div>
        {/* 캔버스 바깥이다. 세로에서는 캔버스가 읽을 수 없을 만큼 작아진다. */}
        <ScreenFit />
      </body>
    </html>
  );
}
