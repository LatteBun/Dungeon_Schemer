import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./u2-intro.css";
import "./u3-board.css";
import "./u3-u2-status-sync.css";

export const metadata: Metadata = {
  title: "Dungeon Schemer",
  description: "Dungeon Schemer prototype",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body className="min-h-screen bg-ink font-sans text-parchment antialiased">
        {children}
      </body>
    </html>
  );
}
