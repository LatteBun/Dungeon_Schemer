import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
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

export const metadata: Metadata = {
  title: "Dungeon Schemer",
  description: "Dungeon Schemer prototype",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-ink font-sans text-parchment antialiased">
        <div className="game-canvas">{children}</div>
      </body>
    </html>
  );
}
