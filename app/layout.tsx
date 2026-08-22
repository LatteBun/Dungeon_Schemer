import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./u2-intro.css";
import "./u3-board.css";
import "./u3-u2-status-sync.css";
import "./u3-card-theme.css";
import "./u3-large-screen.css";
import "./u3-contract-layout.css";
import "./u3-responsive-layout.css";
import "./u4-dungeon-map.css";

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
